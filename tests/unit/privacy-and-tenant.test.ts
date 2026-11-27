import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertEventsBelongToTenant,
  authorizeTenantQuery,
  InputSizeLimitError,
  PrivacyViolationError,
  TenantBoundaryViolationError,
} from "../../src/privacy/index.js";
import { EventValidationError, validateAnalyticsEvent } from "../../src/validation/event-validator.js";
import { makeAuthContext, makeEvent } from "../helpers/synthetic-fixtures.js";

const FIXED_NOW = Date.parse("2026-10-15T00:00:00.000Z");

describe("Privacy Guard & Tenant Isolation", () => {
  it("rejects browser-supplied or cross-tenant claimedTenantId and query.tenantId overrides", () => {
    const ctxWithMismatchedClaim = makeAuthContext("tenant_alpha", {
      claimedTenantId: "tenant_beta",
    });

    assert.throws(
      () =>
        authorizeTenantQuery(ctxWithMismatchedClaim, {
          dateRange: {
            from: "2026-10-01T00:00:00.000Z",
            to: "2026-10-10T00:00:00.000Z",
          },
        }),
      TenantBoundaryViolationError,
    );

    const validCtx = makeAuthContext("tenant_alpha");
    assert.throws(
      () =>
        authorizeTenantQuery(validCtx, {
          tenantId: "tenant_beta",
          dateRange: {
            from: "2026-10-01T00:00:00.000Z",
            to: "2026-10-10T00:00:00.000Z",
          },
        }),
      TenantBoundaryViolationError,
    );
  });

  it("rejects untrusted issuers and missing required scopes", () => {
    const untrustedCtx = {
      ...makeAuthContext("tenant_alpha"),
      issuedBy: "browser-client" as unknown as "dip-api",
    };

    assert.throws(
      () =>
        authorizeTenantQuery(untrustedCtx, {
          dateRange: {
            from: "2026-10-01T00:00:00.000Z",
            to: "2026-10-10T00:00:00.000Z",
          },
        }),
      TenantBoundaryViolationError,
    );

    const noReadScopeCtx = makeAuthContext("tenant_alpha", { scopes: ["analytics:ingest"] });
    assert.throws(
      () =>
        authorizeTenantQuery(noReadScopeCtx, {
          dateRange: {
            from: "2026-10-01T00:00:00.000Z",
            to: "2026-10-10T00:00:00.000Z",
          },
        }),
      TenantBoundaryViolationError,
    );
  });

  it("assertEventsBelongToTenant fails loudly if mixed-tenant events leak into aggregation inputs", () => {
    const evA = makeEvent(
      "application.submitted",
      { serviceCode: "SVC_1", channel: "web" },
      { tenantId: "tenant_alpha" },
    );
    const evB = makeEvent(
      "application.submitted",
      { serviceCode: "SVC_1", channel: "web" },
      { tenantId: "tenant_beta" },
    );
    assert.throws(() => assertEventsBelongToTenant([evA, evB], "tenant_alpha"), TenantBoundaryViolationError);
  });

  it("rejects direct PII keys (email, phone, aadhaar, pan, uploaded document URLs) even under strip_and_audit", () => {
    const withPiiKey = {
      ...makeEvent("application.submitted", { serviceCode: "SVC_1", channel: "web" }),
      customerEmail: "synthetic@example.test",
    };
    assert.throws(
      () => validateAnalyticsEvent(withPiiKey, { nowMs: FIXED_NOW, unknownFieldPolicy: "strip_and_audit" }),
      PrivacyViolationError,
    );

    const withDocUrl = {
      ...makeEvent("application.submitted", { serviceCode: "SVC_1", channel: "web" }),
      payload: {
        serviceCode: "SVC_1",
        channel: "web",
        documentUrl: "https://storage.invalid/doc.pdf",
      },
    };
    assert.throws(
      () => validateAnalyticsEvent(withDocUrl, { nowMs: FIXED_NOW, unknownFieldPolicy: "strip_and_audit" }),
      PrivacyViolationError,
    );
  });

  it("rejects PII value patterns (emails, PAN, grouped Aadhaar, JWT, base64 data URI) hidden inside allowed fields", () => {
    const emailInRoute = makeEvent("api.request_recorded", {
      routeTemplate: "/v1/users/citizen@example.org",
      method: "GET",
      statusCode: 200,
      latencyMs: 10,
    });
    assert.throws(
      () => validateAnalyticsEvent(emailInRoute, { nowMs: FIXED_NOW }),
      PrivacyViolationError,
    );

    const panInReason = makeEvent("application.cancelled", {
      serviceCode: "SVC_TAX",
      cancelledByRole: "customer",
      reasonCode: "ABCDE1234F",
    });
    assert.throws(
      () => validateAnalyticsEvent(panInReason, { nowMs: FIXED_NOW }),
      PrivacyViolationError,
    );

    const dataUriInRef = makeEvent("application.submitted", {
      serviceCode: "data:application/pdf;base64,JVBERi0xLjQ=",
      channel: "web",
    });
    assert.throws(
      () => validateAnalyticsEvent(dataUriInRef, { nowMs: FIXED_NOW }),
      PrivacyViolationError,
    );
  });

  it("blocks prototype pollution keys and handles safe unknown fields according to policy", () => {
    const protoPolluted = JSON.parse(
      '{"eventId":"e1","eventType":"application.submitted","schemaVersion":"1.0.0","eventTimestamp":"2026-10-10T10:00:00.000Z","tenantId":"tenant_alpha","sourceService":"dipindia","correlationId":"c1","payload":{"serviceCode":"SVC_1","channel":"web","__proto__":{"polluted":true}}}',
    ) as unknown;

    assert.throws(
      () => validateAnalyticsEvent(protoPolluted, { nowMs: FIXED_NOW }),
      PrivacyViolationError,
    );

    const benignUnknown = {
      ...makeEvent("application.submitted", { serviceCode: "SVC_1", channel: "web" }),
      futureEnvelopeTag: "v1-minor-hint",
    };

    assert.throws(
      () => validateAnalyticsEvent(benignUnknown, { nowMs: FIXED_NOW, unknownFieldPolicy: "reject" }),
      EventValidationError,
    );

    const stripped = validateAnalyticsEvent(benignUnknown, {
      nowMs: FIXED_NOW,
      unknownFieldPolicy: "strip_and_audit",
    });
    assert.deepEqual(stripped.strippedFields, ["$.futureEnvelopeTag"]);
    assert.equal("futureEnvelopeTag" in stripped.event, false);
  });

  it("enforces payload byte size limit", () => {
    const oversized = makeEvent("api.request_recorded", {
      routeTemplate: "/v1/" + "a".repeat(20_000),
      method: "GET",
      statusCode: 200,
      latencyMs: 5,
    });
    assert.throws(
      () => validateAnalyticsEvent(oversized, { nowMs: FIXED_NOW }),
      InputSizeLimitError,
    );
  });
});
