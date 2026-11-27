import { AnalyticsDomainError, type AnyAnalyticsEvent } from "../contracts/events.js";
import type {
  AuthorizedTenantQuery,
  TenantAuthorizationContext,
} from "../privacy/tenant-boundary.js";
import type { EventValidationOptions } from "../validation/event-validator.js";

export interface EventIngestionResult {
  readonly status: "accepted" | "duplicate" | "rejected";
  readonly eventId: string;
  readonly tenantId?: string;
  readonly ingestedAt?: string;
  readonly reason?: string;
  readonly errorCode?: string;
  readonly strippedFields?: readonly string[];
}

export interface BatchIngestionSummary {
  readonly acceptedCount: number;
  readonly duplicateCount: number;
  readonly rejectedCount: number;
  readonly results: readonly EventIngestionResult[];
}

export interface StorageQueryFilters {
  readonly serviceCodes?: readonly string[];
  readonly partnerRefs?: readonly string[];
  readonly regionCodes?: readonly string[];
  readonly currencies?: readonly string[];
}

export interface IdempotencyCheckResult {
  readonly outcome: "new" | "duplicate";
  readonly fingerprint: string;
}

export class IdempotencyConflictError extends AnalyticsDomainError {
  public readonly eventId: string;
  public readonly tenantId: string;

  public constructor(tenantId: string, eventId: string) {
    super(
      "IDEMPOTENCY_CONFLICT",
      `Idempotency conflict for tenant "${tenantId}" and eventId "${eventId}": payload fingerprint does not match previously ingested event.`,
    );
    this.name = "IdempotencyConflictError";
    this.tenantId = tenantId;
    this.eventId = eventId;
  }
}

export interface IdempotencyStorePort {
  checkAndRecord(
    tenantId: string,
    eventId: string,
    fingerprint: string,
  ): Promise<IdempotencyCheckResult>;
}

export interface AnalyticsEventStorePort {
  append(event: AnyAnalyticsEvent): Promise<void>;
  appendBatch(events: readonly AnyAnalyticsEvent[]): Promise<void>;
  queryByTenant(
    authorizedQuery: AuthorizedTenantQuery,
    filters?: StorageQueryFilters,
  ): Promise<readonly AnyAnalyticsEvent[]>;
  deleteEventsOlderThan(
    tenantId: string,
    cutoffIso: string,
    dryRun?: boolean,
  ): Promise<{ readonly deletedCount: number; readonly retainedCount: number }>;
}

export interface EventIngestionPort {
  ingest(
    rawEvent: unknown,
    authContext: TenantAuthorizationContext,
    options?: EventValidationOptions,
  ): Promise<EventIngestionResult>;
  ingestBatch(
    rawEvents: readonly unknown[],
    authContext: TenantAuthorizationContext,
    options?: EventValidationOptions,
  ): Promise<BatchIngestionSummary>;
}

export interface RetentionPolicyConfig {
  readonly rawEventRetentionDays: number;
  readonly aggregateRetentionDays: number;
}

export interface RetentionExecutionResult {
  readonly tenantId: string;
  readonly cutoffIso: string;
  readonly dryRun: boolean;
  readonly deletedRawEventCount: number;
  readonly retainedRawEventCount: number;
}

export interface RetentionManagerPort {
  applyRetention(
    authContext: TenantAuthorizationContext,
    policy: RetentionPolicyConfig,
    asOfIso: string,
    dryRun?: boolean,
  ): Promise<RetentionExecutionResult>;
}

export interface AggregateSnapshotRecord<TData = unknown> {
  readonly snapshotId: string;
  readonly tenantId: string;
  readonly reportKind: string;
  readonly contractVersion: string;
  readonly windowFrom: string;
  readonly windowTo: string;
  readonly generatedAt: string;
  readonly data: TData;
}

export interface AggregateSnapshotStorePort {
  saveSnapshot<TData>(
    authContext: TenantAuthorizationContext,
    snapshot: AggregateSnapshotRecord<TData>,
  ): Promise<void>;
  listSnapshots(
    authorizedQuery: AuthorizedTenantQuery,
    reportKind?: string,
  ): Promise<readonly AggregateSnapshotRecord[]>;
}
