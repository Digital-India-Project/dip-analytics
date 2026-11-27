/**
 * Core versioned analytics event contracts for Digital India Project.
 *
 * Design invariants:
 * - Zero direct personal identifiers (PII) or uploaded document contents.
 * - All monetary amounts are strictly integer minor units (e.g., paise/cents).
 * - Tenant isolation is mandatory on every envelope.
 */

export const CURRENT_EVENT_SCHEMA_VERSION = "1.0.0" as const;

export const SUPPORTED_EVENT_SCHEMA_VERSIONS = ["1.0.0"] as const;

export type EventSchemaVersion = (typeof SUPPORTED_EVENT_SCHEMA_VERSIONS)[number];

export const ANALYTICS_EVENT_TYPES = [
  "application.submitted",
  "application.status_changed",
  "application.completed",
  "application.cancelled",
  "payment.initiated",
  "payment.succeeded",
  "payment.failed",
  "payment.refunded",
  "partner.assigned",
  "partner.completed_work",
  "operator.action_recorded",
  "sla.threshold_breached",
  "api.request_recorded",
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export const KNOWN_SOURCE_SERVICES = [
  "dipindia",
  "dip-api",
  "dip-core",
  "dip-automation",
  "dip-sdk",
  "dip-security",
  "dip-analytics-test",
] as const;

export type KnownSourceService = (typeof KNOWN_SOURCE_SERVICES)[number];

export type SourceService = KnownSourceService | (string & {});

/**
 * Opaque business references only. Never store customer names, emails, phones,
 * national IDs (Aadhaar/PAN/passport), street addresses, or document URLs here.
 */
export interface OpaqueBusinessReferences {
  readonly applicationRef?: string;
  readonly serviceCode?: string;
  readonly paymentRef?: string;
  readonly partnerRef?: string;
  readonly operatorRef?: string;
  readonly accountRef?: string;
  readonly regionCode?: string;
  readonly endpointKey?: string;
}

export interface TraceContext {
  readonly traceId: string;
  readonly spanId: string;
  readonly traceFlags?: string;
}

export type ApplicationChannel = "web" | "mobile" | "assisted_center" | "api" | "partner_portal";

export type ApplicationFinalStatus = "approved" | "rejected" | "completed";

export type CancelledByRole = "customer" | "operator" | "system" | "partner";

export type PaymentMethodCategory =
  | "upi"
  | "card"
  | "netbanking"
  | "wallet"
  | "bank_transfer"
  | "other";

export type PaymentFailureCategory =
  | "insufficient_funds"
  | "authentication_failed"
  | "gateway_timeout"
  | "network_error"
  | "invalid_instrument"
  | "risk_declined"
  | "provider_error"
  | "unknown";

export type RefundReasonCategory =
  | "application_cancelled"
  | "duplicate_charge"
  | "service_unavailable"
  | "sla_compensation"
  | "customer_request"
  | "reconciliation_adjustment";

export type PartnerAssignmentType = "auto" | "manual";

export type PartnerWorkOutcome = "completed" | "returned" | "reassigned";

export type OperatorActionType =
  | "claimed"
  | "verified"
  | "requested_clarification"
  | "approved"
  | "rejected"
  | "escalated"
  | "reassigned";

export type SlaSeverity = "warning" | "critical";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface AnalyticsPayloadMap {
  "application.submitted": {
    readonly serviceCode: string;
    readonly channel: ApplicationChannel;
    readonly regionCode?: string;
    readonly categoryCode?: string;
  };
  "application.status_changed": {
    readonly serviceCode: string;
    readonly previousStatus: string;
    readonly nextStatus: string;
    readonly reasonCode?: string;
    readonly stageOrder?: number;
  };
  "application.completed": {
    readonly serviceCode: string;
    readonly finalStatus: ApplicationFinalStatus;
    readonly processingDurationMs: number;
    readonly slaTargetMs?: number;
    readonly regionCode?: string;
  };
  "application.cancelled": {
    readonly serviceCode: string;
    readonly cancelledByRole: CancelledByRole;
    readonly reasonCode?: string;
  };
  "payment.initiated": {
    readonly currency: string;
    readonly amountMinor: number;
    readonly paymentMethodCategory: PaymentMethodCategory;
    readonly serviceCode?: string;
  };
  "payment.succeeded": {
    readonly currency: string;
    readonly amountMinor: number;
    readonly feeMinor?: number;
    readonly netAmountMinor?: number;
    readonly paymentMethodCategory: PaymentMethodCategory;
    readonly settlementDurationMs?: number;
  };
  "payment.failed": {
    readonly currency: string;
    readonly amountMinor: number;
    readonly failureCategory: PaymentFailureCategory;
    readonly paymentMethodCategory: PaymentMethodCategory;
    readonly retryable: boolean;
  };
  "payment.refunded": {
    readonly currency: string;
    readonly refundAmountMinor: number;
    readonly originalAmountMinor?: number;
    readonly reasonCategory: RefundReasonCategory;
    readonly partial: boolean;
  };
  "partner.assigned": {
    readonly partnerRef: string;
    readonly serviceCode: string;
    readonly regionCode?: string;
    readonly assignmentType: PartnerAssignmentType;
  };
  "partner.completed_work": {
    readonly partnerRef: string;
    readonly serviceCode: string;
    readonly durationMs: number;
    readonly outcome: PartnerWorkOutcome;
    readonly commissionMinor?: number;
    readonly currency?: string;
  };
  "operator.action_recorded": {
    readonly operatorRef: string;
    readonly actionType: OperatorActionType;
    readonly serviceCode?: string;
    readonly queueCode?: string;
    readonly durationMs?: number;
  };
  "sla.threshold_breached": {
    readonly serviceCode: string;
    readonly stageCode: string;
    readonly elapsedMs: number;
    readonly thresholdMs: number;
    readonly severity: SlaSeverity;
  };
  "api.request_recorded": {
    readonly routeTemplate: string;
    readonly method: HttpMethod;
    readonly statusCode: number;
    readonly latencyMs: number;
    readonly clientTier?: string;
    readonly errorCode?: string;
  };
}

export interface AnalyticsEventEnvelope<
  TType extends AnalyticsEventType = AnalyticsEventType,
> {
  readonly eventId: string;
  readonly eventType: TType;
  readonly schemaVersion: string;
  /** Authoritative domain occurrence timestamp (ISO-8601 UTC or explicit offset). */
  readonly eventTimestamp: string;
  /** Ingestion boundary timestamp assigned when accepted; never overrides eventTimestamp. */
  readonly ingestedAt?: string;
  readonly tenantId: string;
  readonly sourceService: SourceService;
  readonly correlationId: string;
  readonly traceContext?: TraceContext;
  readonly references?: OpaqueBusinessReferences;
  readonly payload: AnalyticsPayloadMap[TType];
}

export type AnyAnalyticsEvent = {
  [K in AnalyticsEventType]: AnalyticsEventEnvelope<K>;
}[AnalyticsEventType];

export type EventOfType<TType extends AnalyticsEventType> = AnalyticsEventEnvelope<TType>;

export interface SchemaCompatibilityResult {
  readonly compatible: boolean;
  readonly requestedVersion: string;
  readonly supportedMajor: number;
  readonly reason?: string;
}

const SEMVER_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/**
 * Checks whether an incoming event schemaVersion is compatible with the
 * supported major contract version (v1.x.x).
 */
export function checkSchemaCompatibility(version: string): SchemaCompatibilityResult {
  const match = SEMVER_REGEX.exec(version);
  if (!match) {
    return {
      compatible: false,
      requestedVersion: version,
      supportedMajor: 1,
      reason: `Invalid semantic version format: "${version}". Expected MAJOR.MINOR.PATCH.`,
    };
  }

  const major = Number(match[1]);
  if (major !== 1) {
    return {
      compatible: false,
      requestedVersion: version,
      supportedMajor: 1,
      reason: `Unsupported major schema version ${major}. Supported major version is 1.`,
    };
  }

  return {
    compatible: true,
    requestedVersion: version,
    supportedMajor: 1,
  };
}

export class AnalyticsDomainError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string) {
    super(message);
    this.name = "AnalyticsDomainError";
    this.code = code;
  }
}
