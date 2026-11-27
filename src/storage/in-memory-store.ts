import type { AnyAnalyticsEvent } from "../contracts/events.js";
import { AnalyticsDomainError } from "../contracts/events.js";
import {
  assertTrustedAuthContext,
  assertValidTenantId,
  TenantBoundaryViolationError,
  type AuthorizedTenantQuery,
  type TenantAuthorizationContext,
} from "../privacy/tenant-boundary.js";
import { computeEventFingerprint, sortEventsDeterministically } from "../reliability/index.js";
import { isWithinHalfOpenRange, parseStrictIsoTimestampMs } from "../utils/time.js";
import { validateAnalyticsEvent, type EventValidationOptions } from "../validation/event-validator.js";
import {
  IdempotencyConflictError,
  type AggregateSnapshotRecord,
  type AggregateSnapshotStorePort,
  type AnalyticsEventStorePort,
  type BatchIngestionSummary,
  type EventIngestionPort,
  type EventIngestionResult,
  type IdempotencyCheckResult,
  type IdempotencyStorePort,
  type RetentionExecutionResult,
  type RetentionManagerPort,
  type RetentionPolicyConfig,
  type StorageQueryFilters,
} from "./interfaces.js";

/**
 * Test and reference-only in-memory implementation of the analytics storage,
 * ingestion, idempotency, retention, and snapshot contracts.
 *
 * Never use in production; no external database connections are established.
 */
export class InMemoryAnalyticsStore
  implements
    EventIngestionPort,
    AnalyticsEventStorePort,
    IdempotencyStorePort,
    RetentionManagerPort,
    AggregateSnapshotStorePort
{
  private readonly eventsByTenant = new Map<string, AnyAnalyticsEvent[]>();
  private readonly fingerprintsByTenant = new Map<string, Map<string, string>>();
  private readonly snapshotsByTenant = new Map<string, AggregateSnapshotRecord[]>();
  private readonly clock: () => number;

  public constructor(clock: () => number = () => Date.now()) {
    this.clock = clock;
  }

  public async checkAndRecord(
    tenantId: string,
    eventId: string,
    fingerprint: string,
  ): Promise<IdempotencyCheckResult> {
    assertValidTenantId(tenantId);
    let tenantMap = this.fingerprintsByTenant.get(tenantId);
    if (!tenantMap) {
      tenantMap = new Map<string, string>();
      this.fingerprintsByTenant.set(tenantId, tenantMap);
    }

    const existing = tenantMap.get(eventId);
    if (existing !== undefined) {
      if (existing !== fingerprint) {
        throw new IdempotencyConflictError(tenantId, eventId);
      }
      return { outcome: "duplicate", fingerprint };
    }

    tenantMap.set(eventId, fingerprint);
    return { outcome: "new", fingerprint };
  }

  public async append(event: AnyAnalyticsEvent): Promise<void> {
    assertValidTenantId(event.tenantId);
    const fingerprint = computeEventFingerprint(event);
    const idemp = await this.checkAndRecord(event.tenantId, event.eventId, fingerprint);
    if (idemp.outcome === "duplicate") {
      return;
    }

    const list = this.eventsByTenant.get(event.tenantId) ?? [];
    const storedEvent: AnyAnalyticsEvent = event.ingestedAt
      ? event
      : ({
          ...event,
          ingestedAt: new Date(this.clock()).toISOString(),
        } as AnyAnalyticsEvent);
    list.push(storedEvent);
    this.eventsByTenant.set(event.tenantId, list);
  }

  public async appendBatch(events: readonly AnyAnalyticsEvent[]): Promise<void> {
    for (const ev of events) {
      await this.append(ev);
    }
  }

  public async ingest(
    rawEvent: unknown,
    authContext: TenantAuthorizationContext,
    options: EventValidationOptions = {},
  ): Promise<EventIngestionResult> {
    assertTrustedAuthContext(authContext, "analytics:ingest");

    const rawId =
      typeof rawEvent === "object" &&
      rawEvent !== null &&
      typeof (rawEvent as Record<string, unknown>)["eventId"] === "string"
        ? ((rawEvent as Record<string, unknown>)["eventId"] as string)
        : "unknown";

    try {
      const { event, strippedFields } = validateAnalyticsEvent(rawEvent, {
        nowMs: this.clock(),
        ...options,
      });

      if (event.tenantId !== authContext.authenticatedTenantId) {
        throw new TenantBoundaryViolationError(
          `Ingestion denied: event tenantId "${event.tenantId}" does not match authenticated tenant "${authContext.authenticatedTenantId}".`,
        );
      }

      const fingerprint = computeEventFingerprint(event);
      const idemp = await this.checkAndRecord(event.tenantId, event.eventId, fingerprint);

      if (idemp.outcome === "duplicate") {
        return {
          status: "duplicate",
          eventId: event.eventId,
          tenantId: event.tenantId,
          strippedFields,
        };
      }

      const ingestedAt = event.ingestedAt ?? new Date(this.clock()).toISOString();
      const storedEvent = { ...event, ingestedAt } as AnyAnalyticsEvent;
      const list = this.eventsByTenant.get(event.tenantId) ?? [];
      list.push(storedEvent);
      this.eventsByTenant.set(event.tenantId, list);

      return {
        status: "accepted",
        eventId: event.eventId,
        tenantId: event.tenantId,
        ingestedAt,
        strippedFields,
      };
    } catch (err) {
      const domainErr = err instanceof AnalyticsDomainError ? err : null;
      return {
        status: "rejected",
        eventId: rawId,
        reason: err instanceof Error ? err.message : "Unknown ingestion error.",
        errorCode: domainErr?.code ?? "INGESTION_REJECTED",
      };
    }
  }

  public async ingestBatch(
    rawEvents: readonly unknown[],
    authContext: TenantAuthorizationContext,
    options: EventValidationOptions = {},
  ): Promise<BatchIngestionSummary> {
    assertTrustedAuthContext(authContext, "analytics:ingest");
    const results: EventIngestionResult[] = [];
    let acceptedCount = 0;
    let duplicateCount = 0;
    let rejectedCount = 0;

    for (const raw of rawEvents) {
      const res = await this.ingest(raw, authContext, options);
      results.push(res);
      if (res.status === "accepted") acceptedCount++;
      else if (res.status === "duplicate") duplicateCount++;
      else rejectedCount++;
    }

    return {
      acceptedCount,
      duplicateCount,
      rejectedCount,
      results,
    };
  }

  public async queryByTenant(
    authorizedQuery: AuthorizedTenantQuery,
    filters: StorageQueryFilters = {},
  ): Promise<readonly AnyAnalyticsEvent[]> {
    const tenantEvents = this.eventsByTenant.get(authorizedQuery.tenantId) ?? [];
    const serviceSet = filters.serviceCodes ? new Set(filters.serviceCodes) : null;
    const partnerSet = filters.partnerRefs ? new Set(filters.partnerRefs) : null;
    const regionSet = filters.regionCodes ? new Set(filters.regionCodes) : null;
    const currencySet = filters.currencies ? new Set(filters.currencies) : null;

    const matching = tenantEvents.filter((ev) => {
      const ts = parseStrictIsoTimestampMs(ev.eventTimestamp);
      if (!isWithinHalfOpenRange(ts, authorizedQuery.fromMs, authorizedQuery.toMs)) {
        return false;
      }
      if (serviceSet) {
        const sc =
          "serviceCode" in ev.payload && typeof ev.payload.serviceCode === "string"
            ? ev.payload.serviceCode
            : ev.references?.serviceCode;
        if (!sc || !serviceSet.has(sc)) return false;
      }
      if (partnerSet) {
        const pr =
          "partnerRef" in ev.payload && typeof ev.payload.partnerRef === "string"
            ? ev.payload.partnerRef
            : ev.references?.partnerRef;
        if (!pr || !partnerSet.has(pr)) return false;
      }
      if (regionSet) {
        const rc =
          "regionCode" in ev.payload && typeof ev.payload.regionCode === "string"
            ? ev.payload.regionCode
            : ev.references?.regionCode;
        if (!rc || !regionSet.has(rc)) return false;
      }
      if (currencySet) {
        const cur =
          "currency" in ev.payload && typeof ev.payload.currency === "string"
            ? ev.payload.currency
            : undefined;
        if (!cur || !currencySet.has(cur)) return false;
      }
      return true;
    });

    return sortEventsDeterministically(matching);
  }

  public async deleteEventsOlderThan(
    tenantId: string,
    cutoffIso: string,
    dryRun: boolean = false,
  ): Promise<{ readonly deletedCount: number; readonly retainedCount: number }> {
    assertValidTenantId(tenantId);
    const cutoffMs = parseStrictIsoTimestampMs(cutoffIso);
    const current = this.eventsByTenant.get(tenantId) ?? [];
    const retained: AnyAnalyticsEvent[] = [];
    const removedIds: string[] = [];

    for (const ev of current) {
      const ts = parseStrictIsoTimestampMs(ev.eventTimestamp);
      if (ts < cutoffMs) {
        removedIds.push(ev.eventId);
      } else {
        retained.push(ev);
      }
    }

    if (!dryRun && removedIds.length > 0) {
      this.eventsByTenant.set(tenantId, retained);
      const fpMap = this.fingerprintsByTenant.get(tenantId);
      if (fpMap) {
        for (const id of removedIds) {
          fpMap.delete(id);
        }
      }
    }

    return {
      deletedCount: removedIds.length,
      retainedCount: retained.length,
    };
  }

  public async applyRetention(
    authContext: TenantAuthorizationContext,
    policy: RetentionPolicyConfig,
    asOfIso: string,
    dryRun: boolean = false,
  ): Promise<RetentionExecutionResult> {
    assertTrustedAuthContext(authContext, "analytics:admin");
    if (!Number.isSafeInteger(policy.rawEventRetentionDays) || policy.rawEventRetentionDays < 1) {
      throw new AnalyticsDomainError(
        "INVALID_RETENTION_POLICY",
        "rawEventRetentionDays must be an integer >= 1.",
      );
    }
    const asOfMs = parseStrictIsoTimestampMs(asOfIso);
    const cutoffMs = asOfMs - policy.rawEventRetentionDays * 24 * 60 * 60 * 1000;
    const cutoffIso = new Date(cutoffMs).toISOString();

    const { deletedCount, retainedCount } = await this.deleteEventsOlderThan(
      authContext.authenticatedTenantId,
      cutoffIso,
      dryRun,
    );

    return {
      tenantId: authContext.authenticatedTenantId,
      cutoffIso,
      dryRun,
      deletedRawEventCount: deletedCount,
      retainedRawEventCount: retainedCount,
    };
  }

  public async saveSnapshot<TData>(
    authContext: TenantAuthorizationContext,
    snapshot: AggregateSnapshotRecord<TData>,
  ): Promise<void> {
    assertTrustedAuthContext(authContext, "analytics:ingest");
    if (snapshot.tenantId !== authContext.authenticatedTenantId) {
      throw new TenantBoundaryViolationError(
        `Snapshot tenant "${snapshot.tenantId}" does not match authenticated tenant "${authContext.authenticatedTenantId}".`,
      );
    }
    const list = this.snapshotsByTenant.get(snapshot.tenantId) ?? [];
    list.push(snapshot);
    this.snapshotsByTenant.set(snapshot.tenantId, list);
  }

  public async listSnapshots(
    authorizedQuery: AuthorizedTenantQuery,
    reportKind?: string,
  ): Promise<readonly AggregateSnapshotRecord[]> {
    const list = this.snapshotsByTenant.get(authorizedQuery.tenantId) ?? [];
    return list.filter((s) => {
      if (reportKind && s.reportKind !== reportKind) return false;
      const fromMs = parseStrictIsoTimestampMs(s.windowFrom);
      return fromMs >= authorizedQuery.fromMs && fromMs < authorizedQuery.toMs;
    });
  }
}
