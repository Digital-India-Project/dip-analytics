import { createHash } from "node:crypto";
import type { AnyAnalyticsEvent } from "../contracts/events.js";
import { parseStrictIsoTimestampMs } from "../utils/time.js";

/**
 * Recursively canonicalizes JSON keys to produce a deterministic SHA-256
 * fingerprint for idempotency conflict detection.
 */
function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  const record = value as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const result: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    if (record[key] !== undefined) {
      result[key] = canonicalize(record[key]);
    }
  }
  return result;
}

/**
 * Computes a deterministic SHA-256 fingerprint over the semantic domain fields
 * of an event (excluding ingestion-assigned ingestedAt).
 */
export function computeEventFingerprint(event: AnyAnalyticsEvent): string {
  const semanticBody = canonicalize({
    eventId: event.eventId,
    eventType: event.eventType,
    schemaVersion: event.schemaVersion,
    eventTimestamp: event.eventTimestamp,
    tenantId: event.tenantId,
    sourceService: event.sourceService,
    correlationId: event.correlationId,
    traceContext: event.traceContext,
    references: event.references,
    payload: event.payload,
  });
  return createHash("sha256").update(JSON.stringify(semanticBody)).digest("hex");
}

/**
 * Sorts events deterministically for out-of-order stream reconciliation:
 * 1. Authoritative domain `eventTimestamp` (ascending)
 * 2. Ingestion timestamp `ingestedAt` if present (ascending)
 * 3. `eventId` lexicographical tie-breaker
 */
export function sortEventsDeterministically<T extends AnyAnalyticsEvent>(
  events: readonly T[],
): T[] {
  return [...events].sort((a, b) => {
    const aTime = parseStrictIsoTimestampMs(a.eventTimestamp);
    const bTime = parseStrictIsoTimestampMs(b.eventTimestamp);
    if (aTime !== bTime) return aTime - bTime;

    const aIngest = a.ingestedAt ? parseStrictIsoTimestampMs(a.ingestedAt) : 0;
    const bIngest = b.ingestedAt ? parseStrictIsoTimestampMs(b.ingestedAt) : 0;
    if (aIngest !== bIngest) return aIngest - bIngest;

    return a.eventId.localeCompare(b.eventId);
  });
}

/**
 * Deduplicates an array of events by `(tenantId, eventId)` while sorting
 * deterministically. Keeps the first occurrence after deterministic ordering
 * or reports duplicate count.
 */
export function deduplicateEvents<T extends AnyAnalyticsEvent>(
  events: readonly T[],
): { readonly events: T[]; readonly duplicatesRemoved: number } {
  const seen = new Set<string>();
  const unique: T[] = [];
  let duplicatesRemoved = 0;

  for (const ev of sortEventsDeterministically(events)) {
    const key = `${ev.tenantId}::${ev.eventId}`;
    if (seen.has(key)) {
      duplicatesRemoved++;
      continue;
    }
    seen.add(key);
    unique.push(ev);
  }

  return { events: unique, duplicatesRemoved };
}

export interface CardinalityCapOptions {
  readonly maxGroups: number;
  readonly otherLabel?: string;
}

/**
 * Caps high-cardinality grouped rows to `maxGroups` ranked by a numeric score
 * descending, rolling remaining rows into a single `__other__` bucket via `merge`.
 */
export function capCardinality<TRow>(
  rows: readonly TRow[],
  scoreOf: (row: TRow) => number,
  keyOf: (row: TRow) => string,
  mergeIntoOther: (otherLabel: string, droppedRows: readonly TRow[]) => TRow,
  options: CardinalityCapOptions,
): { readonly rows: TRow[]; readonly truncatedGroupCount: number } {
  const maxGroups = Math.max(1, options.maxGroups);
  const otherLabel = options.otherLabel ?? "__other__";
  const sorted = [...rows].sort((a, b) => {
    const scoreDiff = scoreOf(b) - scoreOf(a);
    if (scoreDiff !== 0) return scoreDiff;
    return keyOf(a).localeCompare(keyOf(b));
  });

  if (sorted.length <= maxGroups) {
    return { rows: sorted, truncatedGroupCount: 0 };
  }

  const head = sorted.slice(0, maxGroups);
  const tail = sorted.slice(maxGroups);
  const mergedOther = mergeIntoOther(otherLabel, tail);
  return {
    rows: [...head, mergedOther],
    truncatedGroupCount: tail.length,
  };
}
