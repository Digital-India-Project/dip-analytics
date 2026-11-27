import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateAccountActivity,
  aggregateCustomStageFunnel,
  aggregateGeographicAnalytics,
  aggregateOperatorWorkload,
  aggregatePaymentReconciliation,
  compareExecutivePeriods,
  compareMetricValue,
  mergeTenantRollups,
  StreamingAnalyticsProcessor,
} from "../../src/aggregations/index.js";
import type { AnyAnalyticsEvent } from "../../src/contracts/events.js";
import { PrivacyViolationError } from "../../src/privacy/pii-guard.js";
import { exportAggregateRowsToNdjson } from "../../src/reporting/exporters.js";
import { InMemoryAnalyticsStore } from "../../src/storage/in-memory-store.js";
import { DateRangeViolationError, enumerateBucketKeys } from "../../src/utils/time.js";
import { makeAuthContext, makeAuthorizedQuery, makeEvent } from "../helpers/synthetic-fixtures.js";

describe("Universal Scalable Business Analytics Capabilities", () => {
  it("computes geographic regional analytics with currency-separated revenue and cardinality cap", () => {
    const query = makeAuthorizedQuery("tenant_alpha");
    const events = [
      makeEvent("application.submitted", {
        serviceCode: "SVC_REG",
        channel: "web",
        regionCode: "IN-KA",
      }),
      makeEvent("application.completed", {
        serviceCode: "SVC_REG",
        finalStatus: "approved",
        processingDurationMs: 20_000,
        regionCode: "IN-KA",
      }),
      makeEvent(
        "payment.succeeded",
        { currency: "INR", amountMinor: 40_000, paymentMethodCategory: "upi" },
        { references: { regionCode: "IN-KA" } },
      ),
      makeEvent("application.submitted", {
        serviceCode: "SVC_REG",
        channel: "mobile",
        regionCode: "IN-MH",
      }),
      makeEvent("application.submitted", {
        serviceCode: "SVC_REG",
        channel: "api",
        regionCode: "IN-TN",
      }),
    ];

    const geo = aggregateGeographicAnalytics(events, query, { maxRegions: 2 });
    assert.equal(geo.trackedEventsCount, 5);
    assert.equal(geo.truncatedRegionCount, 1);
    const ka = geo.regions.find((r) => r.regionCode === "IN-KA");
    assert.ok(ka);
    assert.equal(ka.submittedCount, 1);
    assert.equal(ka.approvedCount, 1);
    assert.equal(ka.completionRateBps, 10000);
    assert.equal(ka.revenueByCurrencyMinor["INR"], 40_000);
    assert.equal(geo.regions.some((r) => r.regionCode === "__other__"), true);
  });

  it("reconciles payment lifecycles (settled, unsettled, orphaned refund, over-refund)", () => {
    const query = makeAuthorizedQuery("tenant_alpha");
    const events = [
      // Settled payment
      makeEvent(
        "payment.initiated",
        { currency: "INR", amountMinor: 50_000, paymentMethodCategory: "upi" },
        { references: { paymentRef: "pay_1" } },
      ),
      makeEvent(
        "payment.succeeded",
        {
          currency: "INR",
          amountMinor: 50_000,
          feeMinor: 1_000,
          netAmountMinor: 49_000,
          paymentMethodCategory: "upi",
        },
        { references: { paymentRef: "pay_1" } },
      ),
      // Unsettled initiated payment
      makeEvent(
        "payment.initiated",
        { currency: "INR", amountMinor: 20_000, paymentMethodCategory: "card" },
        { references: { paymentRef: "pay_2" } },
      ),
      // Over-refunded payment
      makeEvent(
        "payment.succeeded",
        {
          currency: "INR",
          amountMinor: 10_000,
          feeMinor: 0,
          netAmountMinor: 10_000,
          paymentMethodCategory: "upi",
        },
        { references: { paymentRef: "pay_3" } },
      ),
      makeEvent(
        "payment.refunded",
        {
          currency: "INR",
          refundAmountMinor: 15_000,
          reasonCategory: "reconciliation_adjustment",
          partial: false,
        },
        { references: { paymentRef: "pay_3" } },
      ),
      // Orphaned refund
      makeEvent(
        "payment.refunded",
        {
          currency: "INR",
          refundAmountMinor: 5_000,
          reasonCategory: "customer_request",
          partial: false,
        },
        { references: { paymentRef: "pay_orphan" } },
      ),
    ];

    const recon = aggregatePaymentReconciliation(events, query);
    assert.equal(recon.settledCount, 2);
    assert.equal(recon.unsettledInitiatedCount, 1);
    assert.equal(recon.overRefundedCount, 1);
    assert.equal(recon.orphanedRefundCount, 1);
    assert.equal(recon.settlementRateBps, 6667);
    const inr = recon.byCurrency[0];
    assert.ok(inr);
    assert.equal(inr.settledGrossMinor, 60_000);
    assert.equal(inr.settledFeesMinor, 1_000);
    assert.equal(inr.settledNetMinor, 59_000);
    assert.equal(inr.refundedMinor, 20_000);
    assert.equal(inr.reconciledNetMinor, 39_000);
    assert.equal(inr.unsettledInitiatedMinor, 20_000);
  });

  it("tracks opaque customer/business account activity and repeat rates without PII", () => {
    const query = makeAuthorizedQuery("tenant_alpha");
    const events = [
      makeEvent(
        "application.submitted",
        { serviceCode: "SVC_1", channel: "web" },
        { references: { accountRef: "acct_biz_1" } },
      ),
      makeEvent(
        "payment.succeeded",
        { currency: "INR", amountMinor: 25_000, paymentMethodCategory: "bank_transfer" },
        { references: { accountRef: "acct_biz_1" } },
      ),
      makeEvent(
        "application.submitted",
        { serviceCode: "SVC_1", channel: "api" },
        { references: { accountRef: "acct_biz_2" } },
      ),
    ];

    const report = aggregateAccountActivity(events, query);
    assert.equal(report.activeAccountsCount, 2);
    assert.equal(report.repeatAccountsCount, 1);
    assert.equal(report.singleActivityAccountsCount, 1);
    assert.equal(report.repeatAccountRateBps, 5000);
    assert.equal(report.accounts[0]?.spendByCurrencyMinor["INR"], 25_000);
  });

  it("computes queue-level workload and approval/escalation rates for operators and managers", () => {
    const query = makeAuthorizedQuery("tenant_alpha");
    const events = [
      makeEvent("operator.action_recorded", {
        operatorRef: "op_1",
        actionType: "approved",
        queueCode: "Q_SOUTH",
        durationMs: 2000,
      }),
      makeEvent("operator.action_recorded", {
        operatorRef: "op_1",
        actionType: "escalated",
        queueCode: "Q_SOUTH",
        durationMs: 5000,
      }),
    ];

    const workload = aggregateOperatorWorkload(events, query);
    assert.equal(workload.operators[0]?.approvalDecisionRateBps, 10000);
    assert.equal(workload.operators[0]?.escalationRateBps, 5000);
    assert.equal(workload.byQueue[0]?.queueCode, "Q_SOUTH");
    assert.equal(workload.byQueue[0]?.escalationsCount, 1);
  });

  it("computes universal custom-stage funnels and period-over-period comparisons", () => {
    const query = makeAuthorizedQuery("tenant_alpha");
    const events = [
      makeEvent(
        "application.submitted",
        { serviceCode: "S1", channel: "web" },
        { references: { applicationRef: "a1" } },
      ),
      makeEvent(
        "application.status_changed",
        { serviceCode: "S1", previousStatus: "submitted", nextStatus: "kyc_verified" },
        { references: { applicationRef: "a1" } },
      ),
      makeEvent(
        "application.completed",
        { serviceCode: "S1", finalStatus: "approved", processingDurationMs: 1000 },
        { references: { applicationRef: "a1" } },
      ),
      makeEvent(
        "application.submitted",
        { serviceCode: "S1", channel: "web" },
        { references: { applicationRef: "a2" } },
      ),
    ];

    const custom = aggregateCustomStageFunnel(events, query, [
      "submitted",
      "kyc_verified",
      "approved",
    ]);
    assert.equal(custom.stages[0]?.reachedCount, 2);
    assert.equal(custom.stages[1]?.reachedCount, 1);
    assert.equal(custom.stages[1]?.conversionFromStartBps, 5000);
    assert.equal(custom.stages[2]?.reachedCount, 1);

    const delta = compareMetricValue(150, 100);
    assert.equal(delta.absoluteDelta, 50);
    assert.equal(delta.changeRateBps, 5000);
    assert.equal(delta.direction, "up");

    const zeroPrev = compareMetricValue(20, 0);
    assert.equal(zeroPrev.changeRateBps, null);

    const execComp = compareExecutivePeriods({
      currentFunnel: {
        tenantId: "tenant_alpha",
        submittedCount: 10,
        inProgressTouchedCount: 10,
        completedCount: 8,
        approvedCount: 7,
        rejectedCount: 1,
        cancelledCount: 1,
        completionRateBps: 8000,
        approvalRateOfCompletedBps: 8750,
        cancellationRateBps: 1000,
        dropOffBeforeCompletionCount: 1,
        byChannel: [],
        partialData: false,
      },
      previousFunnel: {
        tenantId: "tenant_alpha",
        submittedCount: 5,
        inProgressTouchedCount: 5,
        completedCount: 4,
        approvedCount: 3,
        rejectedCount: 1,
        cancelledCount: 0,
        completionRateBps: 8000,
        approvalRateOfCompletedBps: 7500,
        cancellationRateBps: 0,
        dropOffBeforeCompletionCount: 1,
        byChannel: [],
        partialData: false,
      },
      currentRevenue: { tenantId: "tenant_alpha", byCurrency: [], multiCurrencyDetected: false },
      previousRevenue: { tenantId: "tenant_alpha", byCurrency: [], multiCurrencyDetected: false },
      currentApi: {
        tenantId: "tenant_alpha",
        totalRequests: 100,
        status2xxCount: 95,
        status4xxCount: 4,
        status5xxCount: 1,
        totalErrorCount: 5,
        errorRateBps: 500,
        serverErrorRateBps: 100,
        overallLatency: {
          sampleCount: 0,
          minMs: null,
          maxMs: null,
          avgMs: null,
          p50Ms: null,
          p90Ms: null,
          p95Ms: null,
          p99Ms: null,
        },
        endpoints: [],
        truncatedEndpointCount: 0,
        topErrorCodes: [],
      },
      previousApi: {
        tenantId: "tenant_alpha",
        totalRequests: 50,
        status2xxCount: 50,
        status4xxCount: 0,
        status5xxCount: 0,
        totalErrorCount: 0,
        errorRateBps: 0,
        serverErrorRateBps: 0,
        overallLatency: {
          sampleCount: 0,
          minMs: null,
          maxMs: null,
          avgMs: null,
          p50Ms: null,
          p90Ms: null,
          p95Ms: null,
          p99Ms: null,
        },
        endpoints: [],
        truncatedEndpointCount: 0,
        topErrorCodes: [],
      },
    });
    assert.equal(execComp.submittedApplications.changeRateBps, 10000);
    assert.equal(execComp.apiRequests.absoluteDelta, 50);
  });

  it("streams 10,000 events via AsyncIterable in single pass and associatively merges distributed rollups", async () => {
    const fixedNow = Date.parse("2026-10-15T12:00:00.000Z");
    const store = new InMemoryAnalyticsStore(() => fixedNow);
    const query = makeAuthorizedQuery(
      "tenant_alpha",
      "2026-10-01T00:00:00.000Z",
      "2026-11-01T00:00:00.000Z",
    );

    const batch: AnyAnalyticsEvent[] = [];
    for (let i = 0; i < 10_000; i++) {
      batch.push(
        i % 2 === 0
          ? makeEvent(
              "application.submitted",
              { serviceCode: "SVC_SCALE", channel: "api", regionCode: "IN-DL" },
              {
                eventId: `scale_evt_${i}`,
                eventTimestamp:
                  i < 5_000 ? "2026-10-10T10:00:00.000Z" : "2026-10-11T10:00:00.000Z",
              },
            )
          : makeEvent(
              "payment.succeeded",
              { currency: "INR", amountMinor: 100, paymentMethodCategory: "upi" },
              {
                eventId: `scale_evt_${i}`,
                eventTimestamp:
                  i < 5_000 ? "2026-10-10T10:00:00.000Z" : "2026-10-11T10:00:00.000Z",
              },
            ),
      );
    }
    await store.appendBatch(batch);

    const streamProc = new StreamingAnalyticsProcessor({
      tenantId: "tenant_alpha",
      granularity: "day",
      timeZone: "UTC",
    });
    const accepted = await streamProc.processStream(store.iterateByTenant(query));
    assert.equal(accepted, 10_000);

    const fullSnap = streamProc.snapshot();
    assert.equal(fullSnap.totals.submittedCount, 5_000);
    assert.equal(fullSnap.totals.revenueByCurrencyMinor["INR"], 500_000);

    // Worker 1 processes first 5,000, Worker 2 processes second 5,000 -> merge
    const w1 = new StreamingAnalyticsProcessor({ tenantId: "tenant_alpha", granularity: "day" });
    const w2 = new StreamingAnalyticsProcessor({ tenantId: "tenant_alpha", granularity: "day" });
    w1.processBatch(batch.slice(0, 5_000));
    w2.processBatch(batch.slice(5_000));
    const merged = mergeTenantRollups([w1.snapshot(), w2.snapshot()]);

    assert.equal(merged.totals.totalEvents, fullSnap.totals.totalEvents);
    assert.equal(merged.totals.submittedCount, fullSnap.totals.submittedCount);
    assert.equal(merged.totals.revenueByCurrencyMinor["INR"], fullSnap.totals.revenueByCurrencyMinor["INR"]);
    assert.deepEqual(merged.buckets, fullSnap.buckets);
  });

  it("exports NDJSON aggregates safely, blocks circular PII objects, and enforces bucket caps", () => {
    const auth = makeAuthContext("tenant_alpha");
    const ndjson = exportAggregateRowsToNdjson(
      [{ serviceCode: "SVC_1", total: 10 }, { serviceCode: "SVC_2", total: 20 }],
      auth,
      { pagination: { page: 1, pageSize: 1 } },
    );
    assert.equal(ndjson.rowCount, 1);
    assert.equal(ndjson.hasNextPage, true);
    assert.equal(ndjson.ndjson, '{"serviceCode":"SVC_1","total":10}');

    const cyclic: Record<string, unknown> = { serviceCode: "SVC_1" };
    cyclic["self"] = cyclic;
    assert.throws(
      () => exportAggregateRowsToNdjson([cyclic], auth),
      PrivacyViolationError,
    );

    assert.throws(
      () =>
        enumerateBucketKeys(
          Date.parse("2026-01-01T00:00:00.000Z"),
          Date.parse("2026-06-01T00:00:00.000Z"),
          "hour",
          "UTC",
          100,
        ),
      DateRangeViolationError,
    );
  });
});
