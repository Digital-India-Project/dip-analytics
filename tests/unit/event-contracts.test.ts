import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANALYTICS_EVENT_TYPES,
  checkSchemaCompatibility,
  CURRENT_EVENT_SCHEMA_VERSION,
} from "../../src/contracts/events.js";
import {
  EVENT_ENVELOPE_JSON_SCHEMA,
  EVENT_PAYLOAD_JSON_SCHEMAS,
  getPayloadJsonSchema,
} from "../../src/schemas/event-schemas.js";
import {
  buildEventTelemetryAttributes,
  parseW3CTraceparent,
  TelemetryValidationError,
} from "../../src/telemetry/context.js";
import { EventValidationError, validateAnalyticsEvent } from "../../src/validation/event-validator.js";
import { makeEvent } from "../helpers/synthetic-fixtures.js";

describe("Event Contracts & Schema Validation", () => {
  it("validates all 13 supported synthetic analytics event types", () => {
    const fixedNow = Date.parse("2026-10-15T00:00:00.000Z");

    const samples = [
      makeEvent("application.submitted", {
        serviceCode: "SVC_PASSPORT_ASSIST",
        channel: "web",
        regionCode: "IN-DL",
      }),
      makeEvent("application.status_changed", {
        serviceCode: "SVC_PASSPORT_ASSIST",
        previousStatus: "submitted",
        nextStatus: "in_review",
        stageOrder: 1,
      }),
      makeEvent("application.completed", {
        serviceCode: "SVC_PASSPORT_ASSIST",
        finalStatus: "approved",
        processingDurationMs: 120_000,
        slaTargetMs: 180_000,
      }),
      makeEvent("application.cancelled", {
        serviceCode: "SVC_PASSPORT_ASSIST",
        cancelledByRole: "customer",
        reasonCode: "WITHDRAWN",
      }),
      makeEvent("payment.initiated", {
        currency: "INR",
        amountMinor: 50_000,
        paymentMethodCategory: "upi",
      }),
      makeEvent("payment.succeeded", {
        currency: "INR",
        amountMinor: 50_000,
        feeMinor: 1_000,
        netAmountMinor: 49_000,
        paymentMethodCategory: "upi",
        settlementDurationMs: 1500,
      }),
      makeEvent("payment.failed", {
        currency: "INR",
        amountMinor: 50_000,
        failureCategory: "gateway_timeout",
        paymentMethodCategory: "card",
        retryable: true,
      }),
      makeEvent("payment.refunded", {
        currency: "INR",
        refundAmountMinor: 25_000,
        originalAmountMinor: 50_000,
        reasonCategory: "application_cancelled",
        partial: true,
      }),
      makeEvent("partner.assigned", {
        partnerRef: "partner_syn_01",
        serviceCode: "SVC_PASSPORT_ASSIST",
        assignmentType: "auto",
      }),
      makeEvent("partner.completed_work", {
        partnerRef: "partner_syn_01",
        serviceCode: "SVC_PASSPORT_ASSIST",
        durationMs: 45_000,
        outcome: "completed",
        commissionMinor: 5_000,
        currency: "INR",
      }),
      makeEvent("operator.action_recorded", {
        operatorRef: "op_syn_01",
        actionType: "verified",
        serviceCode: "SVC_PASSPORT_ASSIST",
        queueCode: "Q_NORTH",
        durationMs: 3_200,
      }),
      makeEvent("sla.threshold_breached", {
        serviceCode: "SVC_PASSPORT_ASSIST",
        stageCode: "DOC_VERIFICATION",
        elapsedMs: 200_000,
        thresholdMs: 180_000,
        severity: "warning",
      }),
      makeEvent("api.request_recorded", {
        routeTemplate: "/v1/applications/:id",
        method: "POST",
        statusCode: 201,
        latencyMs: 42,
        clientTier: "standard",
      }),
    ];

    assert.equal(samples.length, ANALYTICS_EVENT_TYPES.length);
    for (const sample of samples) {
      const result = validateAnalyticsEvent(sample, { nowMs: fixedNow });
      assert.equal(result.event.eventType, sample.eventType);
      assert.equal(result.strippedFields.length, 0);
    }
  });

  it("enforces schema version compatibility (v1.x.x accepted, v2.x.x or malformed rejected)", () => {
    assert.equal(checkSchemaCompatibility(CURRENT_EVENT_SCHEMA_VERSION).compatible, true);
    assert.equal(checkSchemaCompatibility("1.3.0").compatible, true);
    assert.equal(checkSchemaCompatibility("2.0.0").compatible, false);
    assert.equal(checkSchemaCompatibility("v1").compatible, false);

    const fixedNow = Date.parse("2026-10-15T00:00:00.000Z");
    const badVersion = makeEvent(
      "api.request_recorded",
      { routeTemplate: "/v1/ping", method: "GET", statusCode: 200, latencyMs: 5 },
      { schemaVersion: "2.0.0" },
    );

    assert.throws(
      () => validateAnalyticsEvent(badVersion, { nowMs: fixedNow }),
      EventValidationError,
    );
  });

  it("provides JSON Schema definitions for envelope and every event payload", () => {
    assert.equal(EVENT_ENVELOPE_JSON_SCHEMA.additionalProperties, false);
    for (const type of ANALYTICS_EVENT_TYPES) {
      const schema = getPayloadJsonSchema(type);
      assert.equal(schema.title, type);
      assert.equal(schema.additionalProperties, false);
      assert.ok(EVENT_PAYLOAD_JSON_SCHEMAS[type]);
    }
  });

  it("validates W3C traceparent and produces PII-free OpenTelemetry attributes", () => {
    const trace = parseW3CTraceparent(
      "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    );
    const ev = makeEvent(
      "api.request_recorded",
      { routeTemplate: "/v1/health", method: "GET", statusCode: 200, latencyMs: 3 },
      { traceContext: trace },
    );
    const attrs = buildEventTelemetryAttributes(ev);
    assert.equal(attrs["dip.tenant_id"], "tenant_alpha");
    assert.equal(attrs.trace_id, trace.traceId);

    assert.throws(
      () => parseW3CTraceparent("00-00000000000000000000000000000000-00f067aa0ba902b7-01"),
      TelemetryValidationError,
    );
  });
});
