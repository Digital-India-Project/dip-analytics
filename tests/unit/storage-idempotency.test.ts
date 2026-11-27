import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authorizeTenantQuery } from "../../src/privacy/tenant-boundary.js";
import { IdempotencyConflictError, InMemoryAnalyticsStore } from "../../src/storage/index.js";
import { makeAuthContext, makeEvent } from "../helpers/synthetic-fixtures.js";

describe("In-Memory Storage, Idempotency & Retention Contracts", () => {
  it("accepts valid events, detects idempotent replays, and rejects conflicting eventId payloads", async () => {
    const fixedNow = Date.parse("2026-10-15T12:00:00.000Z");
    const store = new InMemoryAnalyticsStore(() => fixedNow);
    const auth = makeAuthContext("tenant_alpha");

    const ev = makeEvent(
      "application.submitted",
      { serviceCode: "SVC_1", channel: "web" },
      { eventId: "evt_idemp_1", eventTimestamp: "2026-10-15T10:00:00.000Z" },
    );

    const first = await store.ingest(ev, auth);
    assert.equal(first.status, "accepted");

    const replay = await store.ingest(ev, auth);
    assert.equal(replay.status, "duplicate");

    const conflicting = {
      ...ev,
      payload: { serviceCode: "SVC_2", channel: "mobile" as const },
    };
    const rejected = await store.ingest(conflicting, auth);
    assert.equal(rejected.status, "rejected");
    assert.equal(rejected.errorCode, "IDEMPOTENCY_CONFLICT");

    await assert.rejects(
      () => store.append(conflicting),
      IdempotencyConflictError,
    );
  });

  it("prevents cross-tenant ingestion and cross-tenant reads", async () => {
    const fixedNow = Date.parse("2026-10-15T12:00:00.000Z");
    const store = new InMemoryAnalyticsStore(() => fixedNow);
    const authAlpha = makeAuthContext("tenant_alpha");
    const authBeta = makeAuthContext("tenant_beta");

    const evBeta = makeEvent(
      "application.submitted",
      { serviceCode: "SVC_1", channel: "web" },
      { tenantId: "tenant_beta", eventTimestamp: "2026-10-15T10:00:00.000Z" },
    );

    const crossIngest = await store.ingest(evBeta, authAlpha);
    assert.equal(crossIngest.status, "rejected");
    assert.equal(crossIngest.errorCode, "TENANT_BOUNDARY_VIOLATION");

    await store.ingest(evBeta, authBeta);

    const alphaQuery = authorizeTenantQuery(authAlpha, {
      dateRange: {
        from: "2026-10-01T00:00:00.000Z",
        to: "2026-11-01T00:00:00.000Z",
      },
    });
    const alphaResults = await store.queryByTenant(alphaQuery);
    assert.equal(alphaResults.length, 0);
  });

  it("enforces retention policy dryRun and deletion scoped to tenant", async () => {
    const fixedNow = Date.parse("2026-10-20T00:00:00.000Z");
    const store = new InMemoryAnalyticsStore(() => fixedNow);
    const auth = makeAuthContext("tenant_alpha");

    await store.ingestBatch(
      [
        makeEvent(
          "api.request_recorded",
          { routeTemplate: "/v1/old", method: "GET", statusCode: 200, latencyMs: 5 },
          { eventId: "old_1", eventTimestamp: "2026-01-01T00:00:00.000Z" },
        ),
        makeEvent(
          "api.request_recorded",
          { routeTemplate: "/v1/new", method: "GET", statusCode: 200, latencyMs: 5 },
          { eventId: "new_1", eventTimestamp: "2026-10-19T00:00:00.000Z" },
        ),
      ],
      auth,
    );

    const dry = await store.applyRetention(
      auth,
      { rawEventRetentionDays: 30, aggregateRetentionDays: 365 },
      "2026-10-20T00:00:00.000Z",
      true,
    );
    assert.equal(dry.deletedRawEventCount, 1);
    assert.equal(dry.retainedRawEventCount, 1);

    const exec = await store.applyRetention(
      auth,
      { rawEventRetentionDays: 30, aggregateRetentionDays: 365 },
      "2026-10-20T00:00:00.000Z",
      false,
    );
    assert.equal(exec.deletedRawEventCount, 1);

    const query = authorizeTenantQuery(auth, {
      dateRange: {
        from: "2025-12-01T00:00:00.000Z",
        to: "2026-11-01T00:00:00.000Z",
      },
    });
    const remaining = await store.queryByTenant(query);
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0]?.eventId, "new_1");
  });
});
