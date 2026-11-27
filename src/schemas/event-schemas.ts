import type { AnalyticsEventType } from "../contracts/events.js";
import { ANALYTICS_EVENT_TYPES } from "../contracts/events.js";

export interface JsonSchemaObject {
  readonly $schema?: string;
  readonly $id?: string;
  readonly title?: string;
  readonly description?: string;
  readonly type: string | readonly string[];
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
  readonly properties?: Readonly<Record<string, unknown>>;
  readonly enum?: readonly (string | number | boolean)[];
}

export const EVENT_ENVELOPE_JSON_SCHEMA: JsonSchemaObject = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://schemas.digitalindiaproject.org/dip-analytics/v1/event-envelope.json",
  title: "DIP Analytics Event Envelope (v1)",
  description:
    "Versioned, tenant-scoped analytics event envelope prohibiting direct PII and uploaded documents.",
  type: "object",
  additionalProperties: false,
  required: [
    "eventId",
    "eventType",
    "schemaVersion",
    "eventTimestamp",
    "tenantId",
    "sourceService",
    "correlationId",
    "payload",
  ],
  properties: {
    eventId: { type: "string", minLength: 1, maxLength: 128 },
    eventType: { type: "string", enum: ANALYTICS_EVENT_TYPES },
    schemaVersion: {
      type: "string",
      pattern: "^1\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$",
    },
    eventTimestamp: { type: "string", format: "date-time", maxLength: 40 },
    ingestedAt: { type: "string", format: "date-time", maxLength: 40 },
    tenantId: { type: "string", minLength: 1, maxLength: 64, pattern: "^[a-zA-Z0-9_-]+$" },
    sourceService: { type: "string", minLength: 1, maxLength: 64, pattern: "^[a-z0-9-]+$" },
    correlationId: { type: "string", minLength: 1, maxLength: 128 },
    traceContext: {
      type: "object",
      additionalProperties: false,
      required: ["traceId", "spanId"],
      properties: {
        traceId: { type: "string", pattern: "^[0-9a-f]{32}$" },
        spanId: { type: "string", pattern: "^[0-9a-f]{16}$" },
        traceFlags: { type: "string", pattern: "^[0-9a-f]{2}$" },
      },
    },
    references: {
      type: "object",
      additionalProperties: false,
      properties: {
        applicationRef: { type: "string", minLength: 1, maxLength: 128 },
        serviceCode: { type: "string", minLength: 1, maxLength: 64 },
        paymentRef: { type: "string", minLength: 1, maxLength: 128 },
        partnerRef: { type: "string", minLength: 1, maxLength: 128 },
        operatorRef: { type: "string", minLength: 1, maxLength: 128 },
        accountRef: { type: "string", minLength: 1, maxLength: 128 },
        regionCode: { type: "string", minLength: 1, maxLength: 32 },
        endpointKey: { type: "string", minLength: 1, maxLength: 128 },
      },
    },
    payload: { type: "object" },
  },
};

export const EVENT_PAYLOAD_JSON_SCHEMAS: Readonly<
  Record<AnalyticsEventType, JsonSchemaObject>
> = {
  "application.submitted": {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "application.submitted",
    type: "object",
    additionalProperties: false,
    required: ["serviceCode", "channel"],
    properties: {
      serviceCode: { type: "string", minLength: 1, maxLength: 64 },
      channel: {
        type: "string",
        enum: ["web", "mobile", "assisted_center", "api", "partner_portal"],
      },
      regionCode: { type: "string", minLength: 1, maxLength: 32 },
      categoryCode: { type: "string", minLength: 1, maxLength: 64 },
    },
  },
  "application.status_changed": {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "application.status_changed",
    type: "object",
    additionalProperties: false,
    required: ["serviceCode", "previousStatus", "nextStatus"],
    properties: {
      serviceCode: { type: "string", minLength: 1, maxLength: 64 },
      previousStatus: { type: "string", minLength: 1, maxLength: 64 },
      nextStatus: { type: "string", minLength: 1, maxLength: 64 },
      reasonCode: { type: "string", minLength: 1, maxLength: 64 },
      stageOrder: { type: "integer", minimum: 0, maximum: 100 },
    },
  },
  "application.completed": {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "application.completed",
    type: "object",
    additionalProperties: false,
    required: ["serviceCode", "finalStatus", "processingDurationMs"],
    properties: {
      serviceCode: { type: "string", minLength: 1, maxLength: 64 },
      finalStatus: { type: "string", enum: ["approved", "rejected", "completed"] },
      processingDurationMs: { type: "integer", minimum: 0 },
      slaTargetMs: { type: "integer", minimum: 1 },
      regionCode: { type: "string", minLength: 1, maxLength: 32 },
    },
  },
  "application.cancelled": {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "application.cancelled",
    type: "object",
    additionalProperties: false,
    required: ["serviceCode", "cancelledByRole"],
    properties: {
      serviceCode: { type: "string", minLength: 1, maxLength: 64 },
      cancelledByRole: {
        type: "string",
        enum: ["customer", "operator", "system", "partner"],
      },
      reasonCode: { type: "string", minLength: 1, maxLength: 64 },
    },
  },
  "payment.initiated": {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "payment.initiated",
    type: "object",
    additionalProperties: false,
    required: ["currency", "amountMinor", "paymentMethodCategory"],
    properties: {
      currency: { type: "string", pattern: "^[A-Z]{3}$" },
      amountMinor: { type: "integer", minimum: 0 },
      paymentMethodCategory: {
        type: "string",
        enum: ["upi", "card", "netbanking", "wallet", "bank_transfer", "other"],
      },
      serviceCode: { type: "string", minLength: 1, maxLength: 64 },
    },
  },
  "payment.succeeded": {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "payment.succeeded",
    type: "object",
    additionalProperties: false,
    required: ["currency", "amountMinor", "paymentMethodCategory"],
    properties: {
      currency: { type: "string", pattern: "^[A-Z]{3}$" },
      amountMinor: { type: "integer", minimum: 0 },
      feeMinor: { type: "integer", minimum: 0 },
      netAmountMinor: { type: "integer", minimum: 0 },
      paymentMethodCategory: {
        type: "string",
        enum: ["upi", "card", "netbanking", "wallet", "bank_transfer", "other"],
      },
      settlementDurationMs: { type: "integer", minimum: 0 },
    },
  },
  "payment.failed": {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "payment.failed",
    type: "object",
    additionalProperties: false,
    required: ["currency", "amountMinor", "failureCategory", "paymentMethodCategory", "retryable"],
    properties: {
      currency: { type: "string", pattern: "^[A-Z]{3}$" },
      amountMinor: { type: "integer", minimum: 0 },
      failureCategory: {
        type: "string",
        enum: [
          "insufficient_funds",
          "authentication_failed",
          "gateway_timeout",
          "network_error",
          "invalid_instrument",
          "risk_declined",
          "provider_error",
          "unknown",
        ],
      },
      paymentMethodCategory: {
        type: "string",
        enum: ["upi", "card", "netbanking", "wallet", "bank_transfer", "other"],
      },
      retryable: { type: "boolean" },
    },
  },
  "payment.refunded": {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "payment.refunded",
    type: "object",
    additionalProperties: false,
    required: ["currency", "refundAmountMinor", "reasonCategory", "partial"],
    properties: {
      currency: { type: "string", pattern: "^[A-Z]{3}$" },
      refundAmountMinor: { type: "integer", minimum: 0 },
      originalAmountMinor: { type: "integer", minimum: 0 },
      reasonCategory: {
        type: "string",
        enum: [
          "application_cancelled",
          "duplicate_charge",
          "service_unavailable",
          "sla_compensation",
          "customer_request",
          "reconciliation_adjustment",
        ],
      },
      partial: { type: "boolean" },
    },
  },
  "partner.assigned": {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "partner.assigned",
    type: "object",
    additionalProperties: false,
    required: ["partnerRef", "serviceCode", "assignmentType"],
    properties: {
      partnerRef: { type: "string", minLength: 1, maxLength: 128 },
      serviceCode: { type: "string", minLength: 1, maxLength: 64 },
      regionCode: { type: "string", minLength: 1, maxLength: 32 },
      assignmentType: { type: "string", enum: ["auto", "manual"] },
    },
  },
  "partner.completed_work": {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "partner.completed_work",
    type: "object",
    additionalProperties: false,
    required: ["partnerRef", "serviceCode", "durationMs", "outcome"],
    properties: {
      partnerRef: { type: "string", minLength: 1, maxLength: 128 },
      serviceCode: { type: "string", minLength: 1, maxLength: 64 },
      durationMs: { type: "integer", minimum: 0 },
      outcome: { type: "string", enum: ["completed", "returned", "reassigned"] },
      commissionMinor: { type: "integer", minimum: 0 },
      currency: { type: "string", pattern: "^[A-Z]{3}$" },
    },
  },
  "operator.action_recorded": {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "operator.action_recorded",
    type: "object",
    additionalProperties: false,
    required: ["operatorRef", "actionType"],
    properties: {
      operatorRef: { type: "string", minLength: 1, maxLength: 128 },
      actionType: {
        type: "string",
        enum: [
          "claimed",
          "verified",
          "requested_clarification",
          "approved",
          "rejected",
          "escalated",
          "reassigned",
        ],
      },
      serviceCode: { type: "string", minLength: 1, maxLength: 64 },
      queueCode: { type: "string", minLength: 1, maxLength: 64 },
      durationMs: { type: "integer", minimum: 0 },
    },
  },
  "sla.threshold_breached": {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "sla.threshold_breached",
    type: "object",
    additionalProperties: false,
    required: ["serviceCode", "stageCode", "elapsedMs", "thresholdMs", "severity"],
    properties: {
      serviceCode: { type: "string", minLength: 1, maxLength: 64 },
      stageCode: { type: "string", minLength: 1, maxLength: 64 },
      elapsedMs: { type: "integer", minimum: 0 },
      thresholdMs: { type: "integer", minimum: 1 },
      severity: { type: "string", enum: ["warning", "critical"] },
    },
  },
  "api.request_recorded": {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "api.request_recorded",
    type: "object",
    additionalProperties: false,
    required: ["routeTemplate", "method", "statusCode", "latencyMs"],
    properties: {
      routeTemplate: { type: "string", minLength: 1, maxLength: 256 },
      method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
      statusCode: { type: "integer", minimum: 100, maximum: 599 },
      latencyMs: { type: "integer", minimum: 0 },
      clientTier: { type: "string", minLength: 1, maxLength: 64 },
      errorCode: { type: "string", minLength: 1, maxLength: 64 },
    },
  },
};

export function getPayloadJsonSchema(eventType: AnalyticsEventType): JsonSchemaObject {
  return EVENT_PAYLOAD_JSON_SCHEMAS[eventType];
}
