import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildApiAnalyticsDashboard,
  buildApplicationOperationsDashboard,
  buildExecutiveOverviewDashboard,
  buildFinanceDashboard,
  buildOperatorPerformanceDashboard,
  buildPartnerManagementDashboard,
  buildServicePerformanceDashboard,
  DASHBOARD_CONTRACT_VERSION,
} from "../../src/dashboards/index.js";
import { makeAuthorizedQuery, makeEvent } from "../helpers/synthetic-fixtures.js";

describe("Dashboard Response Contracts & Builders", () => {
  it("builds all 7 dashboard contracts deterministically from a synthetic tenant dataset", () => {
    const query = makeAuthorizedQuery(
      "tenant_alpha",
      "2026-10-10T00:00:00.000Z",
      "2026-10-12T00:00:00.000Z",
    );

    const events = [
      makeEvent(
        "application.submitted",
        { serviceCode: "SVC_CERT", channel: "web", regionCode: "IN-KA" },
        {
          eventTimestamp: "2026-10-10T09:00:00.000Z",
          references: { applicationRef: "app_100" },
        },
      ),
      makeEvent(
        "application.completed",
        {
          serviceCode: "SVC_CERT",
          finalStatus: "approved",
          processingDurationMs: 40_000,
          slaTargetMs: 60_000,
        },
        {
          eventTimestamp: "2026-10-10T10:00:00.000Z",
          references: { applicationRef: "app_100" },
        },
      ),
      makeEvent(
        "payment.succeeded",
        {
          currency: "INR",
          amountMinor: 50_000,
          feeMinor: 1_000,
          netAmountMinor: 49_000,
          paymentMethodCategory: "upi",
          settlementDurationMs: 800,
        },
        { eventTimestamp: "2026-10-10T09:05:00.000Z" },
      ),
      makeEvent(
        "partner.assigned",
        { partnerRef: "ptr_1", serviceCode: "SVC_CERT", assignmentType: "auto" },
        { eventTimestamp: "2026-10-10T09:10:00.000Z" },
      ),
      makeEvent(
        "partner.completed_work",
        {
          partnerRef: "ptr_1",
          serviceCode: "SVC_CERT",
          durationMs: 25_000,
          outcome: "completed",
          commissionMinor: 3_000,
          currency: "INR",
        },
        { eventTimestamp: "2026-10-10T09:35:00.000Z" },
      ),
      makeEvent(
        "operator.action_recorded",
        {
          operatorRef: "op_1",
          actionType: "approved",
          serviceCode: "SVC_CERT",
          queueCode: "Q_KA",
          durationMs: 4_000,
        },
        { eventTimestamp: "2026-10-10T09:50:00.000Z" },
      ),
      makeEvent(
        "api.request_recorded",
        {
          routeTemplate: "/v1/applications",
          method: "POST",
          statusCode: 201,
          latencyMs: 35,
        },
        { eventTimestamp: "2026-10-10T09:00:01.000Z" },
      ),
    ];

    const opts = { generatedAt: "2026-10-12T00:00:00.000Z", timeZone: "Asia/Kolkata" };

    const exec = buildExecutiveOverviewDashboard(events, query, opts);
    assert.equal(exec.metadata.contractVersion, DASHBOARD_CONTRACT_VERSION);
    assert.equal(exec.metadata.dashboardKind, "executive_overview");
    assert.equal(exec.funnel.approvedCount, 1);
    assert.equal(exec.revenue.byCurrency[0]?.netRevenueAfterRefundsMinor, 49_000);
    assert.equal(exec.apiHealth.totalRequests, 1);

    const ops = buildApplicationOperationsDashboard(events, query, opts);
    assert.equal(ops.metadata.dashboardKind, "application_operations");
    assert.equal(ops.statusDistribution.trackedApplicationsCount, 1);

    const fin = buildFinanceDashboard(events, query, opts);
    assert.equal(fin.metadata.dashboardKind, "finance");
    assert.equal(fin.paymentMetrics.successRateBps, 10000);

    const ptr = buildPartnerManagementDashboard(events, query, opts);
    assert.equal(ptr.metadata.dashboardKind, "partner_management");
    assert.equal(ptr.partnerPerformance.partners[0]?.commissionsByCurrencyMinor["INR"], 3_000);

    const opPerf = buildOperatorPerformanceDashboard(events, query, opts);
    assert.equal(opPerf.metadata.dashboardKind, "operator_performance");
    assert.equal(opPerf.operatorWorkload.totalActionsRecorded, 1);

    const svcPerf = buildServicePerformanceDashboard(events, query, opts);
    assert.equal(svcPerf.metadata.dashboardKind, "service_performance");
    assert.equal(svcPerf.servicePerformance.services[0]?.serviceCode, "SVC_CERT");

    const apiDash = buildApiAnalyticsDashboard(events, query, opts);
    assert.equal(apiDash.metadata.dashboardKind, "api_analytics");
    assert.equal(apiDash.apiMetrics.totalRequests, 1);
  });
});
