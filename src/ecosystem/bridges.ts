import { randomUUID } from "node:crypto";
import {
  StreamingAnalyticsProcessor,
  type TenantRollupSnapshot,
} from "../aggregations/streaming-rollup.js";
import {
  AnalyticsDomainError,
  CURRENT_EVENT_SCHEMA_VERSION,
  type AnalyticsEventType,
  type AnalyticsPayloadMap,
  type EventOfType,
  type OpaqueBusinessReferences,
} from "../contracts/events.js";
import {
  authorizeTenantQuery,
  type TenantAuthorizationContext,
} from "../privacy/tenant-boundary.js";
import {
  buildApiAnalyticsDashboard,
  buildApplicationOperationsDashboard,
  buildExecutiveOverviewDashboard,
  buildFinanceDashboard,
  buildOperatorPerformanceDashboard,
  buildPartnerManagementDashboard,
  buildServicePerformanceDashboard,
  type DashboardBuildOptions,
  type DashboardResponseMetadata,
} from "../dashboards/index.js";
import type {
  AggregateSnapshotRecord,
  AggregateSnapshotStorePort,
  AnalyticsEventStorePort,
  EventIngestionPort,
  RetentionExecutionResult,
  RetentionManagerPort,
  RetentionPolicyConfig,
} from "../storage/interfaces.js";
import type { DateRange, TimeGranularity } from "../utils/time.js";

/**
 * Typed opaque event builder for DIPINDIA domain emitters.
 * Enforces schemaVersion v1.0.0, opaque business references, and UTC timestamps.
 */
export function buildDipIndiaEvent<TType extends AnalyticsEventType>(params: {
  readonly eventType: TType;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly payload: AnalyticsPayloadMap[TType];
  readonly eventId?: string;
  readonly eventTimestamp?: string;
  readonly references?: OpaqueBusinessReferences;
}): EventOfType<TType> {
  return {
    eventId: params.eventId ?? randomUUID(),
    eventType: params.eventType,
    schemaVersion: CURRENT_EVENT_SCHEMA_VERSION,
    eventTimestamp: params.eventTimestamp ?? new Date().toISOString(),
    tenantId: params.tenantId,
    sourceService: "dipindia",
    correlationId: params.correlationId,
    ...(params.references ? { references: params.references } : {}),
    payload: params.payload,
  } as EventOfType<TType>;
}

export interface ApiDispatchResponse<TBody = unknown> {
  readonly statusCode: number;
  readonly body: TBody;
}

function mapDomainErrorToHttpStatus(code: string): number {
  switch (code) {
    case "TENANT_BOUNDARY_VIOLATION":
      return 403;
    case "IDEMPOTENCY_CONFLICT":
      return 409;
    case "INPUT_SIZE_LIMIT_EXCEEDED":
      return 413;
    case "PRIVACY_VIOLATION":
    case "EXPORT_SECURITY_ERROR":
    case "EVENT_VALIDATION_ERROR":
    case "INVALID_TIMESTAMP":
    case "DATE_RANGE_VIOLATION":
    case "CURRENCY_MISMATCH":
    case "FINANCIAL_ARITHMETIC_ERROR":
    case "REPORT_FILTER_ERROR":
      return 422;
    default:
      return 400;
  }
}

/**
 * Framework-agnostic handler contract for `dip-api` integrating authenticated
 * event ingestion and tenant-authorized dashboard queries.
 */
export class DipApiAnalyticsHandler {
  private readonly ingestion: EventIngestionPort;
  private readonly store: AnalyticsEventStorePort;

  public constructor(deps: {
    readonly ingestion: EventIngestionPort;
    readonly store: AnalyticsEventStorePort;
  }) {
    this.ingestion = deps.ingestion;
    this.store = deps.store;
  }

  public async handleIngestBatch(
    rawEvents: readonly unknown[],
    authContext: TenantAuthorizationContext,
  ): Promise<ApiDispatchResponse> {
    try {
      const summary = await this.ingestion.ingestBatch(rawEvents, authContext);
      const statusCode = summary.rejectedCount > 0 && summary.acceptedCount === 0 ? 422 : 200;
      return { statusCode, body: summary };
    } catch (err) {
      if (err instanceof AnalyticsDomainError) {
        return {
          statusCode: mapDomainErrorToHttpStatus(err.code),
          body: { error: err.code, message: err.message },
        };
      }
      return { statusCode: 500, body: { error: "INTERNAL_ERROR", message: "Unexpected error" } };
    }
  }

  public async handleDashboardQuery(params: {
    readonly authContext: TenantAuthorizationContext;
    readonly dashboardKind: DashboardResponseMetadata["dashboardKind"];
    readonly dateRange: DateRange;
    readonly requestedTenantId?: string;
    readonly options?: DashboardBuildOptions;
  }): Promise<ApiDispatchResponse> {
    try {
      const authorizedQuery = authorizeTenantQuery(params.authContext, {
        ...(params.requestedTenantId !== undefined ? { tenantId: params.requestedTenantId } : {}),
        dateRange: params.dateRange,
      });

      const events = await this.store.queryByTenant(authorizedQuery, {
        ...(params.options?.serviceCodes ? { serviceCodes: params.options.serviceCodes } : {}),
        ...(params.options?.partnerRefs ? { partnerRefs: params.options.partnerRefs } : {}),
        ...(params.options?.currencies ? { currencies: params.options.currencies } : {}),
      });

      const opts = params.options ?? {};
      switch (params.dashboardKind) {
        case "executive_overview":
          return { statusCode: 200, body: buildExecutiveOverviewDashboard(events, authorizedQuery, opts) };
        case "application_operations":
          return {
            statusCode: 200,
            body: buildApplicationOperationsDashboard(events, authorizedQuery, opts),
          };
        case "finance":
          return { statusCode: 200, body: buildFinanceDashboard(events, authorizedQuery, opts) };
        case "partner_management":
          return {
            statusCode: 200,
            body: buildPartnerManagementDashboard(events, authorizedQuery, opts),
          };
        case "operator_performance":
          return {
            statusCode: 200,
            body: buildOperatorPerformanceDashboard(events, authorizedQuery, opts),
          };
        case "service_performance":
          return {
            statusCode: 200,
            body: buildServicePerformanceDashboard(events, authorizedQuery, opts),
          };
        case "api_analytics":
          return { statusCode: 200, body: buildApiAnalyticsDashboard(events, authorizedQuery, opts) };
      }
    } catch (err) {
      if (err instanceof AnalyticsDomainError) {
        return {
          statusCode: mapDomainErrorToHttpStatus(err.code),
          body: { error: err.code, message: err.message },
        };
      }
      return { statusCode: 500, body: { error: "INTERNAL_ERROR", message: "Unexpected error" } };
    }
  }
}

/**
 * Scheduled job orchestrator contract for `dip-automation` to stream events into
 * TenantRollupSnapshot records and execute per-tenant retention sweeps.
 */
export class DipAutomationScheduledRunner {
  private readonly store: AnalyticsEventStorePort;
  private readonly snapshots: AggregateSnapshotStorePort;
  private readonly retention: RetentionManagerPort;

  public constructor(deps: {
    readonly store: AnalyticsEventStorePort;
    readonly snapshots: AggregateSnapshotStorePort;
    readonly retention: RetentionManagerPort;
  }) {
    this.store = deps.store;
    this.snapshots = deps.snapshots;
    this.retention = deps.retention;
  }

  public async runScheduledRollup(params: {
    readonly authContext: TenantAuthorizationContext;
    readonly dateRange: DateRange;
    readonly granularity?: TimeGranularity;
    readonly timeZone?: string;
    readonly generatedAt?: string;
  }): Promise<AggregateSnapshotRecord<TenantRollupSnapshot>> {
    const query = authorizeTenantQuery(
      params.authContext,
      { dateRange: params.dateRange },
      "analytics:read",
    );

    const processor = new StreamingAnalyticsProcessor({
      tenantId: query.tenantId,
      granularity: params.granularity ?? "day",
      timeZone: params.timeZone ?? "UTC",
      windowMs: { fromMs: query.fromMs, toMs: query.toMs },
    });

    await processor.processStream(this.store.iterateByTenant(query));
    const rollup = processor.snapshot();

    const record: AggregateSnapshotRecord<TenantRollupSnapshot> = {
      snapshotId: `snap_${query.tenantId}_${rollup.granularity}_${Date.now()}`,
      tenantId: query.tenantId,
      reportKind: `rollup_${rollup.granularity}`,
      contractVersion: rollup.contractVersion,
      windowFrom: params.dateRange.from,
      windowTo: params.dateRange.to,
      generatedAt: params.generatedAt ?? new Date().toISOString(),
      data: rollup,
    };

    await this.snapshots.saveSnapshot(params.authContext, record);
    return record;
  }

  public async runScheduledRetention(params: {
    readonly authContext: TenantAuthorizationContext;
    readonly policy: RetentionPolicyConfig;
    readonly asOfIso: string;
    readonly dryRun?: boolean;
  }): Promise<RetentionExecutionResult> {
    return this.retention.applyRetention(
      params.authContext,
      params.policy,
      params.asOfIso,
      params.dryRun ?? false,
    );
  }
}
