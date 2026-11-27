import {
  ANALYTICS_EVENT_TYPES,
  AnalyticsDomainError,
  checkSchemaCompatibility,
  type AnalyticsEventEnvelope,
  type AnalyticsEventType,
  type AnyAnalyticsEvent,
  type OpaqueBusinessReferences,
} from "../contracts/events.js";
import {
  assertNoPrivacyViolations,
  assertNoPrototypePollutionKeys,
  InputSizeLimitError,
  MAX_EVENT_BYTES,
} from "../privacy/pii-guard.js";
import { assertValidTenantId } from "../privacy/tenant-boundary.js";
import { validateTraceContext } from "../telemetry/context.js";
import { assertValidCurrencyCode, assertSafeMinorUnits } from "../utils/money.js";
import { DEFAULT_MAX_FUTURE_SKEW_MS, parseStrictIsoTimestampMs } from "../utils/time.js";

export const MAX_BATCH_EVENTS = 500;
export const MAX_BATCH_BYTES = 1024 * 1024; // 1 MiB

export type UnknownFieldPolicy = "reject" | "strip_and_audit";

export interface EventValidationOptions {
  readonly unknownFieldPolicy?: UnknownFieldPolicy;
  readonly nowMs?: number;
  readonly maxFutureSkewMs?: number;
  readonly allowFutureTimestamps?: boolean;
}

export interface EventValidationResult<T extends AnyAnalyticsEvent = AnyAnalyticsEvent> {
  readonly event: T;
  readonly strippedFields: readonly string[];
}

export class EventValidationError extends AnalyticsDomainError {
  public readonly fieldPath: string;

  public constructor(fieldPath: string, message: string) {
    super("EVENT_VALIDATION_ERROR", `${fieldPath}: ${message}`);
    this.name = "EventValidationError";
    this.fieldPath = fieldPath;
  }
}

const EVENT_TYPE_SET = new Set<string>(ANALYTICS_EVENT_TYPES);
const SOURCE_SERVICE_REGEX = /^[a-z0-9-]{1,64}$/;
const OPAQUE_ID_REGEX = /^[a-zA-Z0-9_.:/-]{1,128}$/;

const ENVELOPE_ALLOWED_KEYS = new Set([
  "eventId",
  "eventType",
  "schemaVersion",
  "eventTimestamp",
  "ingestedAt",
  "tenantId",
  "sourceService",
  "correlationId",
  "traceContext",
  "references",
  "payload",
]);

const REFERENCE_ALLOWED_KEYS = new Set([
  "applicationRef",
  "serviceCode",
  "paymentRef",
  "partnerRef",
  "operatorRef",
  "accountRef",
  "regionCode",
  "endpointKey",
]);

const PAYLOAD_ALLOWED_KEYS: Record<AnalyticsEventType, ReadonlySet<string>> = {
  "application.submitted": new Set(["serviceCode", "channel", "regionCode", "categoryCode"]),
  "application.status_changed": new Set([
    "serviceCode",
    "previousStatus",
    "nextStatus",
    "reasonCode",
    "stageOrder",
  ]),
  "application.completed": new Set([
    "serviceCode",
    "finalStatus",
    "processingDurationMs",
    "slaTargetMs",
    "regionCode",
  ]),
  "application.cancelled": new Set(["serviceCode", "cancelledByRole", "reasonCode"]),
  "payment.initiated": new Set([
    "currency",
    "amountMinor",
    "paymentMethodCategory",
    "serviceCode",
  ]),
  "payment.succeeded": new Set([
    "currency",
    "amountMinor",
    "feeMinor",
    "netAmountMinor",
    "paymentMethodCategory",
    "settlementDurationMs",
  ]),
  "payment.failed": new Set([
    "currency",
    "amountMinor",
    "failureCategory",
    "paymentMethodCategory",
    "retryable",
  ]),
  "payment.refunded": new Set([
    "currency",
    "refundAmountMinor",
    "originalAmountMinor",
    "reasonCategory",
    "partial",
  ]),
  "partner.assigned": new Set(["partnerRef", "serviceCode", "regionCode", "assignmentType"]),
  "partner.completed_work": new Set([
    "partnerRef",
    "serviceCode",
    "durationMs",
    "outcome",
    "commissionMinor",
    "currency",
  ]),
  "operator.action_recorded": new Set([
    "operatorRef",
    "actionType",
    "serviceCode",
    "queueCode",
    "durationMs",
  ]),
  "sla.threshold_breached": new Set([
    "serviceCode",
    "stageCode",
    "elapsedMs",
    "thresholdMs",
    "severity",
  ]),
  "api.request_recorded": new Set([
    "routeTemplate",
    "method",
    "statusCode",
    "latencyMs",
    "clientTier",
    "errorCode",
  ]),
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertNonEmptyString(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  maxLen: number = 128,
): string {
  const val = obj[key];
  if (typeof val !== "string" || val.trim().length === 0 || val.length > maxLen) {
    throw new EventValidationError(
      `${path}.${key}`,
      `Must be a non-empty string (max ${maxLen} chars).`,
    );
  }
  return val;
}

function assertOptionalString(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  maxLen: number = 128,
): string | undefined {
  const val = obj[key];
  if (val === undefined) return undefined;
  if (typeof val !== "string" || val.trim().length === 0 || val.length > maxLen) {
    throw new EventValidationError(
      `${path}.${key}`,
      `If provided, must be a non-empty string (max ${maxLen} chars).`,
    );
  }
  return val;
}

function assertEnum<T extends string>(
  obj: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  path: string,
): T {
  const val = obj[key];
  if (typeof val !== "string" || !allowed.includes(val as T)) {
    throw new EventValidationError(
      `${path}.${key}`,
      `Invalid value "${String(val)}". Allowed: ${allowed.join(", ")}.`,
    );
  }
  return val as T;
}

function assertNonNegativeInt(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  minValue: number = 0,
): number {
  const val = obj[key];
  if (typeof val !== "number" || !Number.isSafeInteger(val) || val < minValue) {
    throw new EventValidationError(
      `${path}.${key}`,
      `Must be a safe integer >= ${minValue}.`,
    );
  }
  return val;
}

function handleUnknownFields(
  obj: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
  path: string,
  policy: UnknownFieldPolicy,
  strippedFields: string[],
): Record<string, unknown> {
  assertNoPrototypePollutionKeys(obj, path);
  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.has(key)) {
      if (policy === "reject") {
        throw new EventValidationError(`${path}.${key}`, `Unknown field "${key}" is not allowed.`);
      }
      strippedFields.push(`${path}.${key}`);
      continue;
    }
    sanitized[key] = obj[key];
  }
  return sanitized;
}

function validateReferences(
  raw: unknown,
  policy: UnknownFieldPolicy,
  strippedFields: string[],
): OpaqueBusinessReferences | undefined {
  if (raw === undefined) return undefined;
  if (!isPlainObject(raw)) {
    throw new EventValidationError("$.references", "Must be a plain object.");
  }
  const clean = handleUnknownFields(
    raw,
    REFERENCE_ALLOWED_KEYS,
    "$.references",
    policy,
    strippedFields,
  );
  const result: Record<string, string> = {};
  for (const key of Object.keys(clean)) {
    const val = assertNonEmptyString(clean, key, "$.references", 128);
    if (!OPAQUE_ID_REGEX.test(val)) {
      throw new EventValidationError(
        `$.references.${key}`,
        `Reference must be an opaque identifier matching ${OPAQUE_ID_REGEX.source}.`,
      );
    }
    result[key] = val;
  }
  return result as OpaqueBusinessReferences;
}

function validatePayload(
  eventType: AnalyticsEventType,
  rawPayload: unknown,
  policy: UnknownFieldPolicy,
  strippedFields: string[],
): Record<string, unknown> {
  if (!isPlainObject(rawPayload)) {
    throw new EventValidationError("$.payload", "Payload must be a plain JSON object.");
  }

  const p = handleUnknownFields(
    rawPayload,
    PAYLOAD_ALLOWED_KEYS[eventType],
    "$.payload",
    policy,
    strippedFields,
  );

  switch (eventType) {
    case "application.submitted":
      assertNonEmptyString(p, "serviceCode", "$.payload", 64);
      assertEnum(
        p,
        "channel",
        ["web", "mobile", "assisted_center", "api", "partner_portal"],
        "$.payload",
      );
      assertOptionalString(p, "regionCode", "$.payload", 32);
      assertOptionalString(p, "categoryCode", "$.payload", 64);
      break;

    case "application.status_changed":
      assertNonEmptyString(p, "serviceCode", "$.payload", 64);
      assertNonEmptyString(p, "previousStatus", "$.payload", 64);
      assertNonEmptyString(p, "nextStatus", "$.payload", 64);
      assertOptionalString(p, "reasonCode", "$.payload", 64);
      if (p["stageOrder"] !== undefined) {
        assertNonNegativeInt(p, "stageOrder", "$.payload", 0);
      }
      break;

    case "application.completed":
      assertNonEmptyString(p, "serviceCode", "$.payload", 64);
      assertEnum(p, "finalStatus", ["approved", "rejected", "completed"], "$.payload");
      assertNonNegativeInt(p, "processingDurationMs", "$.payload", 0);
      if (p["slaTargetMs"] !== undefined) {
        assertNonNegativeInt(p, "slaTargetMs", "$.payload", 1);
      }
      assertOptionalString(p, "regionCode", "$.payload", 32);
      break;

    case "application.cancelled":
      assertNonEmptyString(p, "serviceCode", "$.payload", 64);
      assertEnum(p, "cancelledByRole", ["customer", "operator", "system", "partner"], "$.payload");
      assertOptionalString(p, "reasonCode", "$.payload", 64);
      break;

    case "payment.initiated":
      assertValidCurrencyCode(assertNonEmptyString(p, "currency", "$.payload", 3));
      assertSafeMinorUnits(assertNonNegativeInt(p, "amountMinor", "$.payload", 0), "amountMinor");
      assertEnum(
        p,
        "paymentMethodCategory",
        ["upi", "card", "netbanking", "wallet", "bank_transfer", "other"],
        "$.payload",
      );
      assertOptionalString(p, "serviceCode", "$.payload", 64);
      break;

    case "payment.succeeded": {
      assertValidCurrencyCode(assertNonEmptyString(p, "currency", "$.payload", 3));
      const amount = assertSafeMinorUnits(
        assertNonNegativeInt(p, "amountMinor", "$.payload", 0),
        "amountMinor",
      );
      const fee =
        p["feeMinor"] !== undefined
          ? assertSafeMinorUnits(assertNonNegativeInt(p, "feeMinor", "$.payload", 0), "feeMinor")
          : undefined;
      const net =
        p["netAmountMinor"] !== undefined
          ? assertSafeMinorUnits(
              assertNonNegativeInt(p, "netAmountMinor", "$.payload", 0),
              "netAmountMinor",
            )
          : undefined;
      if (fee !== undefined && net !== undefined && fee + net !== amount) {
        throw new EventValidationError(
          "$.payload.netAmountMinor",
          `feeMinor (${fee}) + netAmountMinor (${net}) must equal amountMinor (${amount}).`,
        );
      }
      assertEnum(
        p,
        "paymentMethodCategory",
        ["upi", "card", "netbanking", "wallet", "bank_transfer", "other"],
        "$.payload",
      );
      if (p["settlementDurationMs"] !== undefined) {
        assertNonNegativeInt(p, "settlementDurationMs", "$.payload", 0);
      }
      break;
    }

    case "payment.failed":
      assertValidCurrencyCode(assertNonEmptyString(p, "currency", "$.payload", 3));
      assertSafeMinorUnits(assertNonNegativeInt(p, "amountMinor", "$.payload", 0), "amountMinor");
      assertEnum(
        p,
        "failureCategory",
        [
          "insufficient_funds",
          "authentication_failed",
          "gateway_timeout",
          "network_error",
          "invalid_instrument",
          "risk_declined",
          "provider_error",
          "unknown",
        ],
        "$.payload",
      );
      assertEnum(
        p,
        "paymentMethodCategory",
        ["upi", "card", "netbanking", "wallet", "bank_transfer", "other"],
        "$.payload",
      );
      if (typeof p["retryable"] !== "boolean") {
        throw new EventValidationError("$.payload.retryable", "Must be a boolean.");
      }
      break;

    case "payment.refunded": {
      assertValidCurrencyCode(assertNonEmptyString(p, "currency", "$.payload", 3));
      const refund = assertSafeMinorUnits(
        assertNonNegativeInt(p, "refundAmountMinor", "$.payload", 0),
        "refundAmountMinor",
      );
      if (p["originalAmountMinor"] !== undefined) {
        const orig = assertSafeMinorUnits(
          assertNonNegativeInt(p, "originalAmountMinor", "$.payload", 0),
          "originalAmountMinor",
        );
        if (refund > orig) {
          throw new EventValidationError(
            "$.payload.refundAmountMinor",
            `refundAmountMinor (${refund}) cannot exceed originalAmountMinor (${orig}).`,
          );
        }
      }
      assertEnum(
        p,
        "reasonCategory",
        [
          "application_cancelled",
          "duplicate_charge",
          "service_unavailable",
          "sla_compensation",
          "customer_request",
          "reconciliation_adjustment",
        ],
        "$.payload",
      );
      if (typeof p["partial"] !== "boolean") {
        throw new EventValidationError("$.payload.partial", "Must be a boolean.");
      }
      break;
    }

    case "partner.assigned":
      assertNonEmptyString(p, "partnerRef", "$.payload", 128);
      assertNonEmptyString(p, "serviceCode", "$.payload", 64);
      assertOptionalString(p, "regionCode", "$.payload", 32);
      assertEnum(p, "assignmentType", ["auto", "manual"], "$.payload");
      break;

    case "partner.completed_work":
      assertNonEmptyString(p, "partnerRef", "$.payload", 128);
      assertNonEmptyString(p, "serviceCode", "$.payload", 64);
      assertNonNegativeInt(p, "durationMs", "$.payload", 0);
      assertEnum(p, "outcome", ["completed", "returned", "reassigned"], "$.payload");
      if (p["commissionMinor"] !== undefined) {
        assertSafeMinorUnits(
          assertNonNegativeInt(p, "commissionMinor", "$.payload", 0),
          "commissionMinor",
        );
        if (p["currency"] === undefined) {
          throw new EventValidationError(
            "$.payload.currency",
            "currency is required whenever commissionMinor is provided.",
          );
        }
        assertValidCurrencyCode(assertNonEmptyString(p, "currency", "$.payload", 3));
      } else if (p["currency"] !== undefined) {
        assertValidCurrencyCode(assertNonEmptyString(p, "currency", "$.payload", 3));
      }
      break;

    case "operator.action_recorded":
      assertNonEmptyString(p, "operatorRef", "$.payload", 128);
      assertEnum(
        p,
        "actionType",
        [
          "claimed",
          "verified",
          "requested_clarification",
          "approved",
          "rejected",
          "escalated",
          "reassigned",
        ],
        "$.payload",
      );
      assertOptionalString(p, "serviceCode", "$.payload", 64);
      assertOptionalString(p, "queueCode", "$.payload", 64);
      if (p["durationMs"] !== undefined) {
        assertNonNegativeInt(p, "durationMs", "$.payload", 0);
      }
      break;

    case "sla.threshold_breached":
      assertNonEmptyString(p, "serviceCode", "$.payload", 64);
      assertNonEmptyString(p, "stageCode", "$.payload", 64);
      assertNonNegativeInt(p, "elapsedMs", "$.payload", 0);
      assertNonNegativeInt(p, "thresholdMs", "$.payload", 1);
      assertEnum(p, "severity", ["warning", "critical"], "$.payload");
      break;

    case "api.request_recorded": {
      assertNonEmptyString(p, "routeTemplate", "$.payload", 256);
      assertEnum(p, "method", ["GET", "POST", "PUT", "PATCH", "DELETE"], "$.payload");
      const status = assertNonNegativeInt(p, "statusCode", "$.payload", 100);
      if (status > 599) {
        throw new EventValidationError("$.payload.statusCode", "statusCode must be <= 599.");
      }
      assertNonNegativeInt(p, "latencyMs", "$.payload", 0);
      assertOptionalString(p, "clientTier", "$.payload", 64);
      assertOptionalString(p, "errorCode", "$.payload", 64);
      break;
    }
  }

  return p;
}

/**
 * Validates and sanitizes an untrusted analytics event envelope against:
 * - Size & depth limits
 * - Prototype pollution & PII/document guard (runs even before stripping unknown fields)
 * - Schema version compatibility (v1.x.x)
 * - Strict ISO-8601 timestamp & clock-skew checks
 * - Strict typed payload rules
 */
export function validateAnalyticsEvent(
  raw: unknown,
  options: EventValidationOptions = {},
): EventValidationResult {
  const policy: UnknownFieldPolicy = options.unknownFieldPolicy ?? "reject";
  const strippedFields: string[] = [];

  if (!isPlainObject(raw)) {
    throw new EventValidationError("$", "Event must be a non-null JSON object.");
  }

  // Enforce serialized byte limit & deep PII / prototype pollution scan BEFORE field stripping
  assertNoPrivacyViolations(raw, "$");

  const cleanEnvelope = handleUnknownFields(
    raw,
    ENVELOPE_ALLOWED_KEYS,
    "$",
    policy,
    strippedFields,
  );

  const eventId = assertNonEmptyString(cleanEnvelope, "eventId", "$", 128);
  const rawType = assertNonEmptyString(cleanEnvelope, "eventType", "$", 64);
  if (!EVENT_TYPE_SET.has(rawType)) {
    throw new EventValidationError("$.eventType", `Unsupported eventType "${rawType}".`);
  }
  const eventType = rawType as AnalyticsEventType;

  const schemaVersion = assertNonEmptyString(cleanEnvelope, "schemaVersion", "$", 32);
  const compat = checkSchemaCompatibility(schemaVersion);
  if (!compat.compatible) {
    throw new EventValidationError(
      "$.schemaVersion",
      compat.reason ?? `Incompatible schema version "${schemaVersion}".`,
    );
  }

  const eventTimestamp = assertNonEmptyString(cleanEnvelope, "eventTimestamp", "$", 40);
  const eventMs = parseStrictIsoTimestampMs(eventTimestamp);
  if (!options.allowFutureTimestamps) {
    const nowMs = options.nowMs ?? Date.now();
    const skewMs = options.maxFutureSkewMs ?? DEFAULT_MAX_FUTURE_SKEW_MS;
    if (eventMs - nowMs > skewMs) {
      throw new EventValidationError(
        "$.eventTimestamp",
        `eventTimestamp "${eventTimestamp}" exceeds allowed future clock skew (${skewMs} ms).`,
      );
    }
  }

  if (cleanEnvelope["ingestedAt"] !== undefined) {
    const ingestedAt = assertNonEmptyString(cleanEnvelope, "ingestedAt", "$", 40);
    parseStrictIsoTimestampMs(ingestedAt);
  }

  const tenantId = assertValidTenantId(
    assertNonEmptyString(cleanEnvelope, "tenantId", "$", 64),
  );

  const sourceService = assertNonEmptyString(cleanEnvelope, "sourceService", "$", 64);
  if (!SOURCE_SERVICE_REGEX.test(sourceService)) {
    throw new EventValidationError(
      "$.sourceService",
      `sourceService "${sourceService}" must match ${SOURCE_SERVICE_REGEX.source}.`,
    );
  }

  assertNonEmptyString(cleanEnvelope, "correlationId", "$", 128);

  let validatedTraceContext: NonNullable<AnalyticsEventEnvelope["traceContext"]> | undefined;
  if (cleanEnvelope["traceContext"] !== undefined) {
    const rawTrace = cleanEnvelope["traceContext"];
    if (!isPlainObject(rawTrace)) {
      throw new EventValidationError("$.traceContext", "Must be a plain object.");
    }
    const cleanTrace = handleUnknownFields(
      rawTrace,
      new Set(["traceId", "spanId", "traceFlags"]),
      "$.traceContext",
      policy,
      strippedFields,
    );
    validatedTraceContext = validateTraceContext({
      traceId: assertNonEmptyString(cleanTrace, "traceId", "$.traceContext", 32),
      spanId: assertNonEmptyString(cleanTrace, "spanId", "$.traceContext", 16),
      ...(cleanTrace["traceFlags"] !== undefined
        ? { traceFlags: assertNonEmptyString(cleanTrace, "traceFlags", "$.traceContext", 2) }
        : {}),
    });
  }

  const references = validateReferences(cleanEnvelope["references"], policy, strippedFields);
  const payload = validatePayload(eventType, cleanEnvelope["payload"], policy, strippedFields);

  const validatedEvent: AnalyticsEventEnvelope = {
    eventId,
    eventType,
    schemaVersion,
    eventTimestamp,
    ...(cleanEnvelope["ingestedAt"] !== undefined
      ? { ingestedAt: cleanEnvelope["ingestedAt"] as string }
      : {}),
    tenantId,
    sourceService,
    correlationId: cleanEnvelope["correlationId"] as string,
    ...(validatedTraceContext !== undefined ? { traceContext: validatedTraceContext } : {}),
    ...(references !== undefined ? { references } : {}),
    payload: payload as AnalyticsEventEnvelope["payload"],
  };

  // Final size sanity check
  const bytes = Buffer.byteLength(JSON.stringify(validatedEvent), "utf8");
  if (bytes > MAX_EVENT_BYTES) {
    throw new InputSizeLimitError(
      `Validated event size (${bytes} bytes) exceeds limit (${MAX_EVENT_BYTES} bytes).`,
    );
  }

  return {
    event: validatedEvent as AnyAnalyticsEvent,
    strippedFields,
  };
}

export function validateEventBatch(
  rawEvents: readonly unknown[],
  options: EventValidationOptions = {},
): EventValidationResult[] {
  if (!Array.isArray(rawEvents)) {
    throw new EventValidationError("$", "Event batch must be an array.");
  }
  if (rawEvents.length > MAX_BATCH_EVENTS) {
    throw new InputSizeLimitError(
      `Batch size (${rawEvents.length} events) exceeds maximum allowed (${MAX_BATCH_EVENTS}).`,
    );
  }
  const totalBytes = Buffer.byteLength(JSON.stringify(rawEvents) ?? "", "utf8");
  if (totalBytes > MAX_BATCH_BYTES) {
    throw new InputSizeLimitError(
      `Batch byte size (${totalBytes} bytes) exceeds maximum allowed (${MAX_BATCH_BYTES} bytes).`,
    );
  }
  return rawEvents.map((raw) => validateAnalyticsEvent(raw, options));
}
