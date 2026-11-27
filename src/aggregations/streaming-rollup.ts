import { AnalyticsDomainError, type AnyAnalyticsEvent } from "../contracts/events.js";
import { assertValidTenantId, type AuthorizedTenantQuery } from "../privacy/tenant-boundary.js";
import { addMinorUnits, assertValidCurrencyCode, computeBasisPoints } from "../utils/money.js";
import {
  assertValidTimezone,
  formatBucketKey,
  isWithinHalfOpenRange,
  parseStrictIsoTimestampMs,
  type TimeGranularity,
} from "../utils/time.js";
import { prepareWindowEvents } from "./math.js";

/**
 * Universal tenant configuration profile allowing any business domain to
 * customize reporting timezone, currency defaults, cardinality caps, and
 * ordered funnel stage pipelines without changing analytics core code.
 */
export interface TenantAnalyticsProfile {
  readonly tenantId: string;
  readonly defaultTimeZone: string;
  readonly defaultCurrency: string;
  readonly maxCardinalityGroups: number;
  readonly customFunnelStages?: readonly string[];
}

export interface CustomStageFunnelStep {
  readonly stage: string;
  readonly reachedCount: number;
  readonly conversionFromStartBps: number | null;
  readonly conversionFromPreviousBps: number | null;
  readonly dropOffFromPreviousCount: number;
}

export interface CustomStageFunnelReport {
  readonly tenantId: string;
  readonly stages: readonly CustomStageFunnelStep[];
  readonly trackedApplicationsCount: number;
}

/**
 * Universal multi-stage funnel builder supporting arbitrary business stage
 * sequences (e.g. ["submitted", "in_review", "verified", "approved"] or
 * ["lead", "qualified", "checkout", "paid"]).
 */
export function aggregateCustomStageFunnel(
  rawEvents: readonly AnyAnalyticsEvent[],
  query: AuthorizedTenantQuery,
  orderedStages: readonly string[],
): CustomStageFunnelReport {
  if (orderedStages.length === 0) {
    throw new AnalyticsDomainError(
      "INVALID_FUNNEL_STAGES",
      "orderedStages must contain at least one stage.",
    );
  }
  const { events } = prepareWindowEvents(rawEvents, query);
  const stageSet = new Set(orderedStages);
  const reachedByEntity = new Map<string, Set<string>>();

  for (const ev of events) {
    const entityRef = ev.references?.applicationRef ?? ev.references?.accountRef;
    if (!entityRef) continue;

    let set = reachedByEntity.get(entityRef);
    if (!set) {
      set = new Set<string>();
      reachedByEntity.set(entityRef, set);
    }

    if (ev.eventType === "application.submitted" && stageSet.has("submitted")) {
      set.add("submitted");
    } else if (ev.eventType === "application.status_changed") {
      if (stageSet.has(ev.payload.previousStatus)) set.add(ev.payload.previousStatus);
      if (stageSet.has(ev.payload.nextStatus)) set.add(ev.payload.nextStatus);
    } else if (ev.eventType === "application.completed") {
      if (stageSet.has(ev.payload.finalStatus)) set.add(ev.payload.finalStatus);
      if (stageSet.has("completed")) set.add("completed");
    } else if (ev.eventType === "application.cancelled" && stageSet.has("cancelled")) {
      set.add("cancelled");
    }
  }

  const countsByStage = new Map<string, number>();
  for (const s of orderedStages) countsByStage.set(s, 0);

  for (const set of reachedByEntity.values()) {
    for (const s of orderedStages) {
      if (set.has(s)) {
        countsByStage.set(s, (countsByStage.get(s) ?? 0) + 1);
      }
    }
  }

  const startCount = countsByStage.get(orderedStages[0]!) ?? 0;
  let prevCount = startCount;

  const steps: CustomStageFunnelStep[] = orderedStages.map((stage, idx) => {
    const reachedCount = countsByStage.get(stage) ?? 0;
    const conversionFromStartBps = computeBasisPoints(reachedCount, startCount);
    const conversionFromPreviousBps =
      idx === 0 ? (startCount > 0 ? 10_000 : null) : computeBasisPoints(reachedCount, prevCount);
    const dropOffFromPreviousCount = idx === 0 ? 0 : Math.max(0, prevCount - reachedCount);
    prevCount = reachedCount;
    return {
      stage,
      reachedCount,
      conversionFromStartBps,
      conversionFromPreviousBps,
      dropOffFromPreviousCount,
    };
  });

  return {
    tenantId: query.tenantId,
    stages: steps,
    trackedApplicationsCount: reachedByEntity.size,
  };
}

export interface RollupBucketCounts {
  readonly totalEvents: number;
  readonly submittedCount: number;
  readonly completedCount: number;
  readonly approvedCount: number;
  readonly rejectedCount: number;
  readonly cancelledCount: number;
  readonly slaBreachCount: number;
  readonly apiRequests: number;
  readonly apiErrorCount: number;
  readonly revenueByCurrencyMinor: Readonly<Record<string, number>>;
  readonly refundsByCurrencyMinor: Readonly<Record<string, number>>;
}

export interface TenantRollupSnapshot {
  readonly contractVersion: "1.0.0";
  readonly tenantId: string;
  readonly granularity: TimeGranularity;
  readonly timeZone: string;
  readonly processedEventsCount: number;
  readonly duplicatesSkippedCount: number;
  readonly totals: RollupBucketCounts;
  readonly byServiceSubmitted: Readonly<Record<string, number>>;
  readonly byRegionSubmitted: Readonly<Record<string, number>>;
  readonly buckets: Readonly<Record<string, RollupBucketCounts>>;
}

interface MutableBucket {
  totalEvents: number;
  submittedCount: number;
  completedCount: number;
  approvedCount: number;
  rejectedCount: number;
  cancelledCount: number;
  slaBreachCount: number;
  apiRequests: number;
  apiErrorCount: number;
  revenueByCurrency: Map<string, number>;
  refundsByCurrency: Map<string, number>;
}

function createMutableBucket(): MutableBucket {
  return {
    totalEvents: 0,
    submittedCount: 0,
    completedCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    cancelledCount: 0,
    slaBreachCount: 0,
    apiRequests: 0,
    apiErrorCount: 0,
    revenueByCurrency: new Map<string, number>(),
    refundsByCurrency: new Map<string, number>(),
  };
}

function freezeBucket(b: MutableBucket): RollupBucketCounts {
  const rev: Record<string, number> = {};
  for (const [k, v] of [...b.revenueByCurrency.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    rev[k] = v;
  }
  const ref: Record<string, number> = {};
  for (const [k, v] of [...b.refundsByCurrency.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    ref[k] = v;
  }
  return {
    totalEvents: b.totalEvents,
    submittedCount: b.submittedCount,
    completedCount: b.completedCount,
    approvedCount: b.approvedCount,
    rejectedCount: b.rejectedCount,
    cancelledCount: b.cancelledCount,
    slaBreachCount: b.slaBreachCount,
    apiRequests: b.apiRequests,
    apiErrorCount: b.apiErrorCount,
    revenueByCurrencyMinor: rev,
    refundsByCurrencyMinor: ref,
  };
}

/**
 * Single-pass O(N), memory-bounded streaming analytics processor supporting
 * incremental batches and AsyncIterables, producing mergeable TenantRollupSnapshots
 * for horizontal worker/cron scalability.
 */
export class StreamingAnalyticsProcessor {
  private readonly tenantId: string;
  private readonly granularity: TimeGranularity;
  private readonly timeZone: string;
  private readonly fromMs: number | undefined;
  private readonly toMs: number | undefined;
  private readonly maxDedupWindowSize: number;

  private readonly seenEventIds = new Set<string>();
  private readonly totals = createMutableBucket();
  private readonly buckets = new Map<string, MutableBucket>();
  private readonly byServiceSubmitted = new Map<string, number>();
  private readonly byRegionSubmitted = new Map<string, number>();

  private processedEventsCount = 0;
  private duplicatesSkippedCount = 0;

  public constructor(options: {
    readonly tenantId: string;
    readonly granularity?: TimeGranularity;
    readonly timeZone?: string;
    readonly windowMs?: { readonly fromMs: number; readonly toMs: number };
    readonly maxDedupWindowSize?: number;
  }) {
    this.tenantId = assertValidTenantId(options.tenantId);
    this.granularity = options.granularity ?? "day";
    this.timeZone = assertValidTimezone(options.timeZone ?? "UTC");
    this.fromMs = options.windowMs?.fromMs;
    this.toMs = options.windowMs?.toMs;
    this.maxDedupWindowSize = options.maxDedupWindowSize ?? 100_000;
  }

  public processEvent(event: AnyAnalyticsEvent): boolean {
    if (event.tenantId !== this.tenantId) {
      throw new AnalyticsDomainError(
        "TENANT_BOUNDARY_VIOLATION",
        `Streaming processor bound to "${this.tenantId}" rejected event from "${event.tenantId}".`,
      );
    }

    if (this.seenEventIds.has(event.eventId)) {
      this.duplicatesSkippedCount++;
      return false;
    }

    const epochMs = parseStrictIsoTimestampMs(event.eventTimestamp);
    if (
      this.fromMs !== undefined &&
      this.toMs !== undefined &&
      !isWithinHalfOpenRange(epochMs, this.fromMs, this.toMs)
    ) {
      return false;
    }

    // Bounded dedup window eviction (FIFO oldest key) to keep memory strictly bounded
    if (this.seenEventIds.size >= this.maxDedupWindowSize) {
      const oldest = this.seenEventIds.values().next().value;
      if (oldest !== undefined) {
        this.seenEventIds.delete(oldest);
      }
    }
    this.seenEventIds.add(event.eventId);

    const bucketKey = formatBucketKey(epochMs, this.granularity, this.timeZone);
    let bucket = this.buckets.get(bucketKey);
    if (!bucket) {
      bucket = createMutableBucket();
      this.buckets.set(bucketKey, bucket);
    }

    this.processedEventsCount++;
    this.applyToBucket(this.totals, event);
    this.applyToBucket(bucket, event);

    if (event.eventType === "application.submitted") {
      this.byServiceSubmitted.set(
        event.payload.serviceCode,
        (this.byServiceSubmitted.get(event.payload.serviceCode) ?? 0) + 1,
      );
      const region = event.payload.regionCode ?? event.references?.regionCode;
      if (region) {
        this.byRegionSubmitted.set(region, (this.byRegionSubmitted.get(region) ?? 0) + 1);
      }
    }

    return true;
  }

  public processBatch(events: readonly AnyAnalyticsEvent[]): number {
    let accepted = 0;
    for (const ev of events) {
      if (this.processEvent(ev)) accepted++;
    }
    return accepted;
  }

  public async processStream(stream: AsyncIterable<AnyAnalyticsEvent>): Promise<number> {
    let accepted = 0;
    for await (const ev of stream) {
      if (this.processEvent(ev)) accepted++;
    }
    return accepted;
  }

  private applyToBucket(target: MutableBucket, ev: AnyAnalyticsEvent): void {
    target.totalEvents++;
    switch (ev.eventType) {
      case "application.submitted":
        target.submittedCount++;
        break;
      case "application.completed":
        target.completedCount++;
        if (ev.payload.finalStatus === "approved") target.approvedCount++;
        else if (ev.payload.finalStatus === "rejected") target.rejectedCount++;
        break;
      case "application.cancelled":
        target.cancelledCount++;
        break;
      case "sla.threshold_breached":
        target.slaBreachCount++;
        break;
      case "api.request_recorded":
        target.apiRequests++;
        if (ev.payload.statusCode >= 400) target.apiErrorCount++;
        break;
      case "payment.succeeded": {
        const cur = assertValidCurrencyCode(ev.payload.currency);
        target.revenueByCurrency.set(
          cur,
          addMinorUnits(target.revenueByCurrency.get(cur) ?? 0, ev.payload.amountMinor),
        );
        break;
      }
      case "payment.refunded": {
        const cur = assertValidCurrencyCode(ev.payload.currency);
        target.refundsByCurrency.set(
          cur,
          addMinorUnits(target.refundsByCurrency.get(cur) ?? 0, ev.payload.refundAmountMinor),
        );
        break;
      }
      default:
        break;
    }
  }

  public snapshot(): TenantRollupSnapshot {
    const frozenBuckets: Record<string, RollupBucketCounts> = {};
    for (const [k, b] of [...this.buckets.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      frozenBuckets[k] = freezeBucket(b);
    }
    const svc: Record<string, number> = {};
    for (const [k, v] of [...this.byServiceSubmitted.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      svc[k] = v;
    }
    const reg: Record<string, number> = {};
    for (const [k, v] of [...this.byRegionSubmitted.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      reg[k] = v;
    }

    return {
      contractVersion: "1.0.0",
      tenantId: this.tenantId,
      granularity: this.granularity,
      timeZone: this.timeZone,
      processedEventsCount: this.processedEventsCount,
      duplicatesSkippedCount: this.duplicatesSkippedCount,
      totals: freezeBucket(this.totals),
      byServiceSubmitted: svc,
      byRegionSubmitted: reg,
      buckets: frozenBuckets,
    };
  }

  public exportCheckpoint(cursorOffset: number = this.processedEventsCount): StreamingProcessorCheckpoint {
    return {
      contractVersion: "1.0.0",
      cursorOffset,
      maxDedupWindowSize: this.maxDedupWindowSize,
      ...(this.fromMs !== undefined ? { fromMs: this.fromMs } : {}),
      ...(this.toMs !== undefined ? { toMs: this.toMs } : {}),
      seenEventIds: [...this.seenEventIds],
      snapshot: this.snapshot(),
    };
  }

  public static fromCheckpoint(
    checkpoint: StreamingProcessorCheckpoint,
  ): StreamingAnalyticsProcessor {
    const proc = new StreamingAnalyticsProcessor({
      tenantId: checkpoint.snapshot.tenantId,
      granularity: checkpoint.snapshot.granularity,
      timeZone: checkpoint.snapshot.timeZone,
      maxDedupWindowSize: checkpoint.maxDedupWindowSize,
      ...(checkpoint.fromMs !== undefined && checkpoint.toMs !== undefined
        ? { windowMs: { fromMs: checkpoint.fromMs, toMs: checkpoint.toMs } }
        : {}),
    });

    proc.processedEventsCount = checkpoint.snapshot.processedEventsCount;
    proc.duplicatesSkippedCount = checkpoint.snapshot.duplicatesSkippedCount;

    for (const id of checkpoint.seenEventIds) {
      proc.seenEventIds.add(id);
    }

    mergeBucketCounts(proc.totals, checkpoint.snapshot.totals);

    for (const [k, b] of Object.entries(checkpoint.snapshot.buckets)) {
      const target = createMutableBucket();
      mergeBucketCounts(target, b);
      proc.buckets.set(k, target);
    }

    for (const [svc, cnt] of Object.entries(checkpoint.snapshot.byServiceSubmitted)) {
      proc.byServiceSubmitted.set(svc, cnt);
    }
    for (const [reg, cnt] of Object.entries(checkpoint.snapshot.byRegionSubmitted)) {
      proc.byRegionSubmitted.set(reg, cnt);
    }

    return proc;
  }
}

export interface StreamingProcessorCheckpoint {
  readonly contractVersion: "1.0.0";
  readonly cursorOffset: number;
  readonly maxDedupWindowSize: number;
  readonly fromMs?: number;
  readonly toMs?: number;
  readonly seenEventIds: readonly string[];
  readonly snapshot: TenantRollupSnapshot;
}

function mergeBucketCounts(a: MutableBucket, src: RollupBucketCounts): void {
  a.totalEvents += src.totalEvents;
  a.submittedCount += src.submittedCount;
  a.completedCount += src.completedCount;
  a.approvedCount += src.approvedCount;
  a.rejectedCount += src.rejectedCount;
  a.cancelledCount += src.cancelledCount;
  a.slaBreachCount += src.slaBreachCount;
  a.apiRequests += src.apiRequests;
  a.apiErrorCount += src.apiErrorCount;

  for (const [cur, amt] of Object.entries(src.revenueByCurrencyMinor)) {
    a.revenueByCurrency.set(cur, addMinorUnits(a.revenueByCurrency.get(cur) ?? 0, amt));
  }
  for (const [cur, amt] of Object.entries(src.refundsByCurrencyMinor)) {
    a.refundsByCurrency.set(cur, addMinorUnits(a.refundsByCurrency.get(cur) ?? 0, amt));
  }
}

/**
 * Associatively merges multiple pre-computed TenantRollupSnapshots (e.g. from
 * hourly partitions or distributed workers) for the same tenant, granularity,
 * and timezone without re-scanning raw events.
 */
export function mergeTenantRollups(
  snapshots: readonly TenantRollupSnapshot[],
): TenantRollupSnapshot {
  if (snapshots.length === 0) {
    throw new AnalyticsDomainError(
      "EMPTY_ROLLUP_MERGE",
      "At least one TenantRollupSnapshot is required to merge.",
    );
  }
  const first = snapshots[0]!;
  const totals = createMutableBucket();
  const buckets = new Map<string, MutableBucket>();
  const byService = new Map<string, number>();
  const byRegion = new Map<string, number>();

  let processedEventsCount = 0;
  let duplicatesSkippedCount = 0;

  for (const snap of snapshots) {
    if (snap.tenantId !== first.tenantId) {
      throw new AnalyticsDomainError(
        "TENANT_BOUNDARY_VIOLATION",
        `Cannot merge rollups across different tenants ("${first.tenantId}" vs "${snap.tenantId}").`,
      );
    }
    if (snap.granularity !== first.granularity || snap.timeZone !== first.timeZone) {
      throw new AnalyticsDomainError(
        "ROLLUP_COMPATIBILITY_ERROR",
        `Cannot merge rollups with mismatched granularity/timeZone.`,
      );
    }

    processedEventsCount += snap.processedEventsCount;
    duplicatesSkippedCount += snap.duplicatesSkippedCount;
    mergeBucketCounts(totals, snap.totals);

    for (const [k, b] of Object.entries(snap.buckets)) {
      let target = buckets.get(k);
      if (!target) {
        target = createMutableBucket();
        buckets.set(k, target);
      }
      mergeBucketCounts(target, b);
    }

    for (const [svc, count] of Object.entries(snap.byServiceSubmitted)) {
      byService.set(svc, (byService.get(svc) ?? 0) + count);
    }
    for (const [reg, count] of Object.entries(snap.byRegionSubmitted)) {
      byRegion.set(reg, (byRegion.get(reg) ?? 0) + count);
    }
  }

  const frozenBuckets: Record<string, RollupBucketCounts> = {};
  for (const [k, b] of [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    frozenBuckets[k] = freezeBucket(b);
  }
  const svcObj: Record<string, number> = {};
  for (const [k, v] of [...byService.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    svcObj[k] = v;
  }
  const regObj: Record<string, number> = {};
  for (const [k, v] of [...byRegion.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    regObj[k] = v;
  }

  return {
    contractVersion: "1.0.0",
    tenantId: first.tenantId,
    granularity: first.granularity,
    timeZone: first.timeZone,
    processedEventsCount,
    duplicatesSkippedCount,
    totals: freezeBucket(totals),
    byServiceSubmitted: svcObj,
    byRegionSubmitted: regObj,
    buckets: frozenBuckets,
  };
}
