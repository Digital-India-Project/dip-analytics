import type { AnalyticsEventEnvelope, TraceContext } from "../contracts/events.js";
import { AnalyticsDomainError } from "../contracts/events.js";

const TRACE_ID_REGEX = /^[0-9a-f]{32}$/;
const SPAN_ID_REGEX = /^[0-9a-f]{16}$/;
const TRACE_FLAGS_REGEX = /^[0-9a-f]{2}$/;
const TRACEPARENT_REGEX = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

export class TelemetryValidationError extends AnalyticsDomainError {
  public constructor(message: string) {
    super("TELEMETRY_VALIDATION_ERROR", message);
    this.name = "TelemetryValidationError";
  }
}

export function validateTraceContext(context: TraceContext): TraceContext {
  if (!TRACE_ID_REGEX.test(context.traceId) || context.traceId === "0".repeat(32)) {
    throw new TelemetryValidationError(
      `Invalid OpenTelemetry traceId "${context.traceId}". Expected 32 lowercase non-zero hex chars.`,
    );
  }
  if (!SPAN_ID_REGEX.test(context.spanId) || context.spanId === "0".repeat(16)) {
    throw new TelemetryValidationError(
      `Invalid OpenTelemetry spanId "${context.spanId}". Expected 16 lowercase non-zero hex chars.`,
    );
  }
  if (context.traceFlags !== undefined && !TRACE_FLAGS_REGEX.test(context.traceFlags)) {
    throw new TelemetryValidationError(
      `Invalid OpenTelemetry traceFlags "${context.traceFlags}". Expected 2 lowercase hex chars.`,
    );
  }
  return context;
}

export function parseW3CTraceparent(header: string): TraceContext {
  const normalized = header.trim().toLowerCase();
  const match = TRACEPARENT_REGEX.exec(normalized);
  if (!match || !match[1] || !match[2] || !match[3]) {
    throw new TelemetryValidationError(
      `Invalid W3C traceparent header "${header}". Expected version-traceId-spanId-flags.`,
    );
  }
  return validateTraceContext({
    traceId: match[1],
    spanId: match[2],
    traceFlags: match[3],
  });
}

export interface AnalyticsTelemetryAttributes {
  readonly "dip.tenant_id": string;
  readonly "dip.event_type": string;
  readonly "dip.schema_version": string;
  readonly "dip.source_service": string;
  readonly "dip.correlation_id": string;
  readonly "trace_id"?: string;
  readonly "span_id"?: string;
}

/**
 * Builds PII-free OpenTelemetry span attributes from a validated analytics event.
 */
export function buildEventTelemetryAttributes(
  event: AnalyticsEventEnvelope,
): AnalyticsTelemetryAttributes {
  const base: AnalyticsTelemetryAttributes = {
    "dip.tenant_id": event.tenantId,
    "dip.event_type": event.eventType,
    "dip.schema_version": event.schemaVersion,
    "dip.source_service": String(event.sourceService),
    "dip.correlation_id": event.correlationId,
  };

  if (event.traceContext) {
    validateTraceContext(event.traceContext);
    return {
      ...base,
      trace_id: event.traceContext.traceId,
      span_id: event.traceContext.spanId,
    };
  }

  return base;
}
