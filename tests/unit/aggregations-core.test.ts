import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateApiMetrics,
  aggregateApplicationFunnel,
  aggregateApplicationStatusDistribution,
  aggregateOperatorWorkload,
  aggregatePartnerPerformance,
  aggregateProcessingAndSla,
  aggregateServicePerformance,
} from "../../src/aggregations/index.js";
import { makeAuthorizedQuery, makeEvent } from "../helpers/synthetic-fixtures.js";

describe("Core Analytics Aggregations", () => {
  it("handles empty datasets cleanly without NaN or Infinity", () => {
    const query = makeAuthorizedQuery("tenant_alpha");

    const funnel = aggregateApplicationFunnel([], query);
    assert.equal(funnel.submittedCount, 0);
    assert.equal(funnel.completionRateBps, null);
    assert.equal(funnel.approvalRateOfCompletedBps, null);

    const sla = aggregateProcessingAndSla([], query);
    assert.equal(sla.slaComplianceRateBps, null);
    assert.equal(sla.processingDuration.p95Ms, null);

    const api = aggregateApiMetrics([], query);
    assert.equal(api.totalRequests, 0);
    assert.equal(api.errorRateBps, null);
    assert.equal(api.overallLatency.avgMs, null);
  });

  it("computes application funnel, status distribution (even out-of-order), and partial data flags", () => {
    const query = makeAuthorizedQuery("tenant_alpha");
    // Deliberately supply completion BEFORE submission in array order to verify deterministic sorting
    const events = [
      makeEvent(
        "application.completed",
        {
          serviceCode: "SVC_CERT",
          finalStatus: "approved",
          processingDurationMs: 100_000,
          slaTargetMs: 120_000,
        },
        {
          eventId: "e_3",
          eventTimestamp: "2026-10-10T12:00:00.000Z",
          references: { applicationRef: "app_1" },
        },
      ),
      makeEvent(
        "application.status_changed",
        {
          serviceCode: "SVC_CERT",
          previousStatus: "submitted",
          nextStatus: "in_review",
        },
        {
          eventId: "e_2",
          eventTimestamp: "2026-10-10T11:00:00.000Z",
          references: { applicationRef: "app_1" },
        },
      ),
      makeEvent(
        "application.submitted",
        { serviceCode: "SVC_CERT", channel: "web" },
        {
          eventId: "e_1",
          eventTimestamp: "2026-10-10T10:00:00.000Z",
          references: { applicationRef: "app_1" },
        },
      ),
      makeEvent(
        "application.submitted",
        { serviceCode: "SVC_CERT", channel: "mobile" },
        {
          eventId: "e_4",
          eventTimestamp: "2026-10-10T13:00:00.000Z",
          references: { applicationRef: "app_2" },
        },
      ),
      makeEvent(
        "application.cancelled",
        { serviceCode: "SVC_CERT", cancelledByRole: "customer" },
        {
          eventId: "e_5",
          eventTimestamp: "2026-10-10T14:00:00.000Z",
          references: { applicationRef: "app_2" },
        },
      ),
      // Duplicate of e_1 should be deduplicated automatically
      makeEvent(
        "application.submitted",
        { serviceCode: "SVC_CERT", channel: "web" },
        {
          eventId: "e_1",
          eventTimestamp: "2026-10-10T10:00:00.000Z",
          references: { applicationRef: "app_1" },
        },
      ),
    ];

    const funnel = aggregateApplicationFunnel(events, query);
    assert.equal(funnel.submittedCount, 2);
    assert.equal(funnel.completedCount, 1);
    assert.equal(funnel.approvedCount, 1);
    assert.equal(funnel.cancelledCount, 1);
    assert.equal(funnel.completionRateBps, 5000);
    assert.equal(funnel.approvalRateOfCompletedBps, 10000);
    assert.equal(funnel.partialData, false);

    const statusDist = aggregateApplicationStatusDistribution(events, query);
    assert.equal(statusDist.trackedApplicationsCount, 2);
    const statuses = Object.fromEntries(
      statusDist.currentStatuses.map((s) => [s.status, s.applicationCount]),
    );
    assert.deepEqual(statuses, { approved: 1, cancelled: 1 });
  });

  it("caps high-cardinality dimensions into __other__ for services, partners, operators, and API endpoints", () => {
    const query = makeAuthorizedQuery("tenant_alpha");
    const events = [
      makeEvent("api.request_recorded", {
        routeTemplate: "/v1/hot",
        method: "GET",
        statusCode: 200,
        latencyMs: 10,
      }),
      makeEvent("api.request_recorded", {
        routeTemplate: "/v1/hot",
        method: "GET",
        statusCode: 500,
        latencyMs: 30,
        errorCode: "INTERNAL",
      }),
      makeEvent("api.request_recorded", {
        routeTemplate: "/v1/cold1",
        method: "GET",
        statusCode: 200,
        latencyMs: 15,
      }),
      makeEvent("api.request_recorded", {
        routeTemplate: "/v1/cold2",
        method: "POST",
        statusCode: 400,
        latencyMs: 25,
        errorCode: "BAD_INPUT",
      }),
    ];

    const api = aggregateApiMetrics(events, query, { maxEndpoints: 1 });
    assert.equal(api.totalRequests, 4);
    assert.equal(api.errorRateBps, 5000);
    assert.equal(api.serverErrorRateBps, 2500);
    assert.equal(api.truncatedEndpointCount, 2);
    assert.equal(api.endpoints.length, 2);
    assert.equal(api.endpoints[1]?.routeKey, "__other__");
    assert.equal(api.endpoints[1]?.requestCount, 2);

    const partnerEvents = [
      makeEvent("partner.assigned", {
        partnerRef: "p1",
        serviceCode: "S1",
        assignmentType: "auto",
      }),
      makeEvent("partner.completed_work", {
        partnerRef: "p1",
        serviceCode: "S1",
        durationMs: 1000,
        outcome: "completed",
        commissionMinor: 2500,
        currency: "INR",
      }),
      makeEvent("partner.completed_work", {
        partnerRef: "p2",
        serviceCode: "S1",
        durationMs: 2000,
        outcome: "returned",
      }),
    ];
    const partners = aggregatePartnerPerformance(partnerEvents, query, { maxPartners: 1 });
    assert.equal(partners.truncatedPartnerCount, 1);
    assert.equal(partners.partners[0]?.partnerRef, "p1");
    assert.equal(partners.partners[0]?.commissionsByCurrencyMinor["INR"], 2500);

    const operatorEvents = [
      makeEvent("operator.action_recorded", {
        operatorRef: "op1",
        actionType: "verified",
        queueCode: "Q1",
        durationMs: 500,
      }),
      makeEvent("operator.action_recorded", {
        operatorRef: "op2",
        actionType: "approved",
        queueCode: "Q2",
        durationMs: 700,
      }),
    ];
    const ops = aggregateOperatorWorkload(operatorEvents, query, { maxOperators: 1 });
    assert.equal(ops.totalActionsRecorded, 2);
    assert.equal(ops.truncatedOperatorCount, 1);

    const svcEvents = [
      makeEvent("application.completed", {
        serviceCode: "S_A",
        finalStatus: "approved",
        processingDurationMs: 100,
      }),
      makeEvent("application.completed", {
        serviceCode: "S_B",
        finalStatus: "rejected",
        processingDurationMs: 200,
      }),
    ];
    const svc = aggregateServicePerformance(svcEvents, query, { maxServices: 1 });
    assert.equal(svc.truncatedServiceCount, 1);
    assert.equal(svc.services.length, 2);
  });

  it("computes deterministic SLA compliance and stage bottlenecks", () => {
    const query = makeAuthorizedQuery("tenant_alpha");
    const events = [
      makeEvent("application.completed", {
        serviceCode: "S1",
        finalStatus: "approved",
        processingDurationMs: 50_000,
        slaTargetMs: 60_000,
      }),
      makeEvent("application.completed", {
        serviceCode: "S1",
        finalStatus: "approved",
        processingDurationMs: 90_000,
        slaTargetMs: 60_000,
      }),
      makeEvent("sla.threshold_breached", {
        serviceCode: "S1",
        stageCode: "VERIFY",
        elapsedMs: 90_000,
        thresholdMs: 60_000,
        severity: "critical",
      }),
    ];
    const sla = aggregateProcessingAndSla(events, query);
    assert.equal(sla.slaComplianceRateBps, 5000);
    assert.equal(sla.criticalBreaches, 1);
    assert.equal(sla.stageBottlenecks[0]?.maxOverrunMs, 30_000);
  });
});
