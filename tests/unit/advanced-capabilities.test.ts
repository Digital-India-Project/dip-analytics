import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateAccountCohortRetention,
  aggregateBacklogAging,
  aggregateServiceUnitEconomics,
  aggregateTimeSeries,
  detectTimeSeriesAnomalies,
  StreamingAnalyticsProcessor,
} from "../../src/aggregations/index.js";
import { EventUpcasterRegistry, SchemaUpcastError } from "../../src/contracts/upcasters.js";
import {
  buildDipIndiaEvent,
  DipApiAnalyticsHandler,
  DipAutomationScheduledRunner,
} from "../../src/ecosystem/index.js";
import { exportAggregateRowsToCsv, exportAggregateRowsToNdjson } from "../../src/reporting/exporters.js";
import { InMemoryAnalyticsStore } from "../../src/storage/in-memory-store.js";
import { validateAnalyticsEvent } from "../../src/validation/event-validator.js";
import { makeAuthContext, makeAuthorizedQuery, makeEvent } from "../helpers/synthetic-fixtures.js";

describe("Advanced Analytics, Suppression, Checkpointing, Upcasters & Ecosystem Bridges", () => {
  it("computes opaque account cohort retention curves across weeks", () => {
    const query = makeAuthorizedQuery(
      "tenant_alpha",
      "2026-10-05T00:00:00.000Z",
      "2026-10-26T00:00:00.000Z",
    );

    const events = [
      // Week 1 cohort: acct_1 and acct_2
      makeEvent(
        "application.submitted",
        { serviceCode: "SVC_1", channel: "web" },
        { eventTimestamp: "2026-10-06T10:00:00.000Z", references: { accountRef: "acct_1" } },
      ),
      makeEvent(
        "application.submitted",
        { serviceCode: "SVC_1", channel: "web" },
        { eventTimestamp: "2026-10-07T10:00:00.000Z", references: { accountRef: "acct_2" } },
      ),
      // Week 2: acct_1 returns and pays; acct_3 joins
      makeEvent(
        "payment.succeeded",
        { currency: "INR", amountMinor: 30_000, paymentMethodCategory: "upi" },
        { eventTimestamp: "2026-10-13T10:00:00.000Z", references: { accountRef: "acct_1" } },
      ),
      makeEvent(
        "application.submitted",
        { serviceCode: "SVC_1", channel: "api" },
        { eventTimestamp: "2026-10-14T10:00:00.000Z", references: { accountRef: "acct_3" } },
      ),
    ];

    const report = aggregateAccountCohortRetention(events, query, { granularity: "week" });
    assert.equal(report.trackedAccountsCount, 3);
    assert.equal(report.cohorts.length, 2);

    const w1 = report.cohorts[0]!;
    assert.equal(w1.cohortSize, 2);
    assert.equal(w1.periods[0]?.retentionRateBps, 10000);
    assert.equal(w1.periods[1]?.activeAccountsCount, 1);
    assert.equal(w1.periods[1]?.retentionRateBps, 5000);
    assert.equal(w1.periods[1]?.revenueByCurrencyMinor["INR"], 30_000);
  });

  it("detects deterministic rolling-baseline spikes in SLA breaches and API error rates", () => {
    const query = makeAuthorizedQuery(
      "tenant_alpha",
      "2026-10-01T00:00:00.000Z",
      "2026-10-06T00:00:00.000Z",
    );

    const events = [
      // Days 1-3 steady baseline: 1 SLA breach/day
      makeEvent(
        "sla.threshold_breached",
        { serviceCode: "S1", stageCode: "DOC", elapsedMs: 120, thresholdMs: 100, severity: "warning" },
        { eventTimestamp: "2026-10-01T10:00:00.000Z" },
      ),
      makeEvent(
        "sla.threshold_breached",
        { serviceCode: "S1", stageCode: "DOC", elapsedMs: 120, thresholdMs: 100, severity: "warning" },
        { eventTimestamp: "2026-10-02T10:00:00.000Z" },
      ),
      makeEvent(
        "sla.threshold_breached",
        { serviceCode: "S1", stageCode: "DOC", elapsedMs: 120, thresholdMs: 100, severity: "warning" },
        { eventTimestamp: "2026-10-03T10:00:00.000Z" },
      ),
      // Day 4 spike: 4 SLA breaches
      ...[1, 2, 3, 4].map((n) =>
        makeEvent(
          "sla.threshold_breached",
          { serviceCode: "S1", stageCode: "DOC", elapsedMs: 250, thresholdMs: 100, severity: "critical" },
          { eventId: `spike_${n}`, eventTimestamp: "2026-10-04T10:00:00.000Z" },
        ),
      ),
    ];

    const series = aggregateTimeSeries(events, query, { granularity: "day" });
    const anomalies = detectTimeSeriesAnomalies(series, { baselineWindowSize: 3 });
    const slaAlert = anomalies.alerts.find(
      (a) => a.metric === "sla_breaches" && a.bucketKey === "2026-10-04",
    );
    assert.ok(slaAlert);
    assert.equal(slaAlert.severity, "critical");
    assert.equal(slaAlert.observedValue, 4);
    assert.equal(slaAlert.baselineMean, 1);
    assert.equal(slaAlert.deviationBps, 30000);
  });

  it("computes service unit economics and net contribution margin per currency", () => {
    const query = makeAuthorizedQuery("tenant_alpha");
    const events = [
      makeEvent("application.completed", {
        serviceCode: "SVC_PERMIT",
        finalStatus: "approved",
        processingDurationMs: 15_000,
      }),
      makeEvent("application.completed", {
        serviceCode: "SVC_PERMIT",
        finalStatus: "approved",
        processingDurationMs: 20_000,
      }),
      makeEvent(
        "payment.succeeded",
        {
          currency: "INR",
          amountMinor: 100_000,
          feeMinor: 2_000,
          netAmountMinor: 98_000,
          paymentMethodCategory: "upi",
        },
        { references: { serviceCode: "SVC_PERMIT" } },
      ),
      makeEvent(
        "payment.refunded",
        {
          currency: "INR",
          refundAmountMinor: 10_000,
          reasonCategory: "customer_request",
          partial: true,
        },
        { references: { serviceCode: "SVC_PERMIT" } },
      ),
      makeEvent("partner.completed_work", {
        partnerRef: "ptr_1",
        serviceCode: "SVC_PERMIT",
        durationMs: 10_000,
        outcome: "completed",
        commissionMinor: 8_000,
        currency: "INR",
      }),
    ];

    const econ = aggregateServiceUnitEconomics(events, query);
    assert.equal(econ.rows.length, 1);
    const row = econ.rows[0]!;
    assert.equal(row.grossRevenueMinor, 100_000);
    assert.equal(row.gatewayFeesMinor, 2_000);
    assert.equal(row.refundedMinor, 10_000);
    assert.equal(row.partnerCommissionMinor, 8_000);
    assert.equal(row.netContributionMinor, 80_000);
    assert.equal(row.netMarginBps, 8000);
    assert.equal(row.netContributionPerCompletedMinor, 40_000);
    assert.equal(row.formattedNetContribution, "800.00");
  });

  it("computes open-application backlog aging histogram across SLA bands", () => {
    const query = makeAuthorizedQuery(
      "tenant_alpha",
      "2026-10-01T00:00:00.000Z",
      "2026-10-20T00:00:00.000Z",
    );
    const asOfIso = "2026-10-15T12:00:00.000Z";

    const events = [
      // Closed app (should NOT appear in open backlog)
      makeEvent(
        "application.submitted",
        { serviceCode: "S1", channel: "web" },
        { eventTimestamp: "2026-10-10T00:00:00.000Z", references: { applicationRef: "app_done" } },
      ),
      makeEvent(
        "application.completed",
        { serviceCode: "S1", finalStatus: "approved", processingDurationMs: 1000 },
        { eventTimestamp: "2026-10-10T01:00:00.000Z", references: { applicationRef: "app_done" } },
      ),
      // Open < 1h (30m ago)
      makeEvent(
        "application.submitted",
        { serviceCode: "S1", channel: "web" },
        { eventTimestamp: "2026-10-15T11:30:00.000Z", references: { applicationRef: "app_fresh" } },
      ),
      // Open > 7d (10 days ago)
      makeEvent(
        "application.submitted",
        { serviceCode: "S2", channel: "api" },
        { eventTimestamp: "2026-10-05T12:00:00.000Z", references: { applicationRef: "app_stale" } },
      ),
    ];

    const backlog = aggregateBacklogAging(events, query, { asOfIso });
    assert.equal(backlog.openApplicationsCount, 2);
    assert.equal(backlog.buckets.under_1h, 1);
    assert.equal(backlog.buckets.over_7d, 1);
    assert.equal(backlog.oldestOpenAgeMs, 10 * 24 * 60 * 60 * 1000);
  });

  it("enforces K-anonymity small-cell suppression on CSV and NDJSON exports", () => {
    const auth = makeAuthContext("tenant_alpha");
    const rows = [
      { regionCode: "IN-DL", submittedCount: 25 },
      { regionCode: "IN-GA", submittedCount: 2 },
      { regionCode: "IN-SK", submittedCount: 1 },
    ];

    const suppressedCsv = exportAggregateRowsToCsv(rows, auth, {
      columns: ["regionCode", "submittedCount"],
      smallCellSuppression: { countField: "submittedCount", minCount: 5, mode: "suppress" },
    });
    assert.equal(suppressedCsv.suppressedRowCount, 2);
    assert.equal(suppressedCsv.rowCount, 1);
    assert.equal(suppressedCsv.csv.includes("IN-GA"), false);

    const rolledNdjson = exportAggregateRowsToNdjson(rows, auth, {
      smallCellSuppression: {
        countField: "submittedCount",
        minCount: 5,
        mode: "rollup_other",
        labelField: "regionCode",
      },
    });
    assert.equal(rolledNdjson.suppressedRowCount, 2);
    assert.equal(rolledNdjson.rowCount, 2);
    assert.ok(rolledNdjson.ndjson.includes("__suppressed_small_cells__"));
    assert.ok(rolledNdjson.ndjson.includes('"submittedCount":3'));
  });

  it("checkpoints and resumes StreamingAnalyticsProcessor without duplicate counting", () => {
    const ev1 = makeEvent(
      "application.submitted",
      { serviceCode: "SVC_1", channel: "web" },
      { eventId: "cp_1", eventTimestamp: "2026-10-10T10:00:00.000Z" },
    );
    const ev2 = makeEvent(
      "payment.succeeded",
      { currency: "INR", amountMinor: 5_000, paymentMethodCategory: "upi" },
      { eventId: "cp_2", eventTimestamp: "2026-10-10T11:00:00.000Z" },
    );

    const p1 = new StreamingAnalyticsProcessor({ tenantId: "tenant_alpha", granularity: "day" });
    p1.processEvent(ev1);
    const checkpoint = p1.exportCheckpoint(1);

    const p2 = StreamingAnalyticsProcessor.fromCheckpoint(checkpoint);
    // Replaying ev1 must be deduplicated, ev2 accepted
    assert.equal(p2.processEvent(ev1), false);
    assert.equal(p2.processEvent(ev2), true);

    const snap = p2.snapshot();
    assert.equal(snap.processedEventsCount, 2);
    assert.equal(snap.duplicatesSkippedCount, 1);
    assert.equal(snap.totals.submittedCount, 1);
    assert.equal(snap.totals.revenueByCurrencyMinor["INR"], 5_000);
  });

  it("upcasts legacy events via EventUpcasterRegistry and detects cycles", () => {
    const fixedNow = Date.parse("2026-10-15T00:00:00.000Z");
    const registry = new EventUpcasterRegistry().register({
      fromVersion: "0.9.0",
      toVersion: "1.0.0",
      upcast: (raw) => ({
        ...raw,
        correlationId: raw["correlationId"] ?? `upcast_${String(raw["eventId"])}`,
      }),
    });

    const legacy = {
      eventId: "leg_1",
      eventType: "application.submitted",
      schemaVersion: "0.9.0",
      eventTimestamp: "2026-10-10T10:00:00.000Z",
      tenantId: "tenant_alpha",
      sourceService: "dipindia",
      payload: { serviceCode: "SVC_1", channel: "web" },
    };

    const { event, appliedVersions } = registry.upcastTo(legacy, "1.0.0");
    assert.deepEqual(appliedVersions, ["0.9.0", "1.0.0"]);
    const validated = validateAnalyticsEvent(event, { nowMs: fixedNow });
    assert.equal(validated.event.schemaVersion, "1.0.0");

    const cyclic = new EventUpcasterRegistry()
      .register({ fromVersion: "0.8.0", toVersion: "0.9.0", upcast: (e) => e })
      .register({ fromVersion: "0.9.0", toVersion: "0.8.0", upcast: (e) => e });
    assert.throws(
      () => cyclic.upcastTo({ schemaVersion: "0.8.0" }, "1.0.0"),
      SchemaUpcastError,
    );
  });

  it("executes DIPINDIA emitter, dip-api handler, and dip-automation scheduled runner end-to-end", async () => {
    const fixedNow = Date.parse("2026-10-15T12:00:00.000Z");
    const store = new InMemoryAnalyticsStore(() => fixedNow);
    const auth = makeAuthContext("tenant_alpha");

    const ev = buildDipIndiaEvent({
      eventId: "dip_evt_1",
      eventType: "application.submitted",
      tenantId: "tenant_alpha",
      correlationId: "corr_dip_1",
      eventTimestamp: "2026-10-15T10:00:00.000Z",
      references: { applicationRef: "app_dip_1", regionCode: "IN-MH" },
      payload: { serviceCode: "SVC_DIP", channel: "web", regionCode: "IN-MH" },
    });

    const api = new DipApiAnalyticsHandler({ ingestion: store, store });
    const ingestRes = await api.handleIngestBatch([ev], auth);
    assert.equal(ingestRes.statusCode, 200);

    const dashRes = await api.handleDashboardQuery({
      authContext: auth,
      dashboardKind: "executive_overview",
      dateRange: {
        from: "2026-10-01T00:00:00.000Z",
        to: "2026-11-01T00:00:00.000Z",
      },
    });
    assert.equal(dashRes.statusCode, 200);

    // Cross-tenant query returns HTTP 403 mapped from TENANT_BOUNDARY_VIOLATION
    const forbiddenRes = await api.handleDashboardQuery({
      authContext: auth,
      dashboardKind: "executive_overview",
      requestedTenantId: "tenant_beta",
      dateRange: {
        from: "2026-10-01T00:00:00.000Z",
        to: "2026-11-01T00:00:00.000Z",
      },
    });
    assert.equal(forbiddenRes.statusCode, 403);

    const automation = new DipAutomationScheduledRunner({
      store,
      snapshots: store,
      retention: store,
    });
    const snap = await automation.runScheduledRollup({
      authContext: auth,
      dateRange: {
        from: "2026-10-01T00:00:00.000Z",
        to: "2026-11-01T00:00:00.000Z",
      },
    });
    assert.equal(snap.data.totals.submittedCount, 1);

    const ret = await automation.runScheduledRetention({
      authContext: auth,
      policy: { rawEventRetentionDays: 30, aggregateRetentionDays: 365 },
      asOfIso: "2026-10-15T12:00:00.000Z",
      dryRun: true,
    });
    assert.equal(ret.retainedRawEventCount, 1);
  });
});
