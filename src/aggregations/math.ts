import type { AnyAnalyticsEvent } from "../contracts/events.js";
import { assertEventsBelongToTenant, type AuthorizedTenantQuery } from "../privacy/tenant-boundary.js";
import { deduplicateEvents } from "../reliability/index.js";
import { isWithinHalfOpenRange, parseStrictIsoTimestampMs } from "../utils/time.js";

/**
 * Prepares tenant-verified, deduplicated, deterministically ordered events
 * within the authorized query's half-open [fromMs, toMs) window using
 * authoritative `eventTimestamp`.
 */
export function prepareWindowEvents(
  events: readonly AnyAnalyticsEvent[],
  query: AuthorizedTenantQuery,
): { readonly events: AnyAnalyticsEvent[]; readonly duplicatesRemoved: number } {
  assertEventsBelongToTenant(events, query.tenantId);
  const { events: unique, duplicatesRemoved } = deduplicateEvents(events);
  const filtered = unique.filter((ev) => {
    const ts = parseStrictIsoTimestampMs(ev.eventTimestamp);
    return isWithinHalfOpenRange(ts, query.fromMs, query.toMs);
  });
  return { events: filtered, duplicatesRemoved };
}

/**
 * Nearest-rank integer percentile (0..100) returning null for empty inputs.
 */
export function computeNearestRankPercentile(
  values: readonly number[],
  percentile: number,
): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const clamped = Math.min(100, Math.max(0, percentile));
  if (clamped === 0) return sorted[0] ?? null;
  const rank = Math.ceil((clamped / 100) * sorted.length);
  const index = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[index] ?? null;
}

/**
 * Integer mean (rounded half-up) returning null for empty inputs.
 */
export function computeIntegerMean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  let total = 0n;
  for (const v of values) {
    total += BigInt(Math.trunc(v));
  }
  const len = BigInt(values.length);
  return Number((total + len / 2n) / len);
}

export interface DurationSummary {
  readonly sampleCount: number;
  readonly minMs: number | null;
  readonly maxMs: number | null;
  readonly avgMs: number | null;
  readonly p50Ms: number | null;
  readonly p90Ms: number | null;
  readonly p95Ms: number | null;
  readonly p99Ms: number | null;
}

export function summarizeDurations(durationsMs: readonly number[]): DurationSummary {
  if (durationsMs.length === 0) {
    return {
      sampleCount: 0,
      minMs: null,
      maxMs: null,
      avgMs: null,
      p50Ms: null,
      p90Ms: null,
      p95Ms: null,
      p99Ms: null,
    };
  }
  const sorted = [...durationsMs].sort((a, b) => a - b);
  return {
    sampleCount: sorted.length,
    minMs: sorted[0] ?? null,
    maxMs: sorted[sorted.length - 1] ?? null,
    avgMs: computeIntegerMean(sorted),
    p50Ms: computeNearestRankPercentile(sorted, 50),
    p90Ms: computeNearestRankPercentile(sorted, 90),
    p95Ms: computeNearestRankPercentile(sorted, 95),
    p99Ms: computeNearestRankPercentile(sorted, 99),
  };
}
