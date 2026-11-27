import type { AnyAnalyticsEvent } from "../contracts/events.js";
import type { AuthorizedTenantQuery } from "../privacy/tenant-boundary.js";
import { parseStrictIsoTimestampMs } from "../utils/time.js";
import { prepareWindowEvents, summarizeDurations, type DurationSummary } from "./math.js";

export type AgingBucketKey = "under_1h" | "from_1h_to_24h" | "from_1d_to_7d" | "over_7d";

export interface BacklogServiceRow {
  readonly serviceCode: string;
  readonly openCount: number;
  readonly oldestOpenAgeMs: number;
  readonly aging: DurationSummary;
}

export interface BacklogAgingReport {
  readonly tenantId: string;
  readonly asOfIso: string;
  readonly openApplicationsCount: number;
  readonly untrackedLifecycleEventsCount: number;
  readonly oldestOpenAgeMs: number | null;
  readonly buckets: Readonly<Record<AgingBucketKey, number>>;
  readonly agingDuration: DurationSummary;
  readonly byService: readonly BacklogServiceRow[];
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

function classifyAge(ageMs: number): AgingBucketKey {
  if (ageMs < ONE_HOUR_MS) return "under_1h";
  if (ageMs < ONE_DAY_MS) return "from_1h_to_24h";
  if (ageMs < SEVEN_DAYS_MS) return "from_1d_to_7d";
  return "over_7d";
}

/**
 * Computes open-application backlog and aging bands (`<1h`, `1h-24h`, `1d-7d`, `>=7d`)
 * for applications with lifecycle activity not yet terminated by `completed` or `cancelled`.
 */
export function aggregateBacklogAging(
  rawEvents: readonly AnyAnalyticsEvent[],
  query: AuthorizedTenantQuery,
  options: { readonly asOfIso?: string; readonly serviceFilter?: ReadonlySet<string> } = {},
): BacklogAgingReport {
  const { events } = prepareWindowEvents(rawEvents, query);
  const asOfMs = options.asOfIso ? parseStrictIsoTimestampMs(options.asOfIso) : query.toMs;
  const asOfIso = options.asOfIso ?? new Date(asOfMs).toISOString();

  const openApps = new Map<string, { serviceCode: string; startedAtMs: number }>();
  let untrackedLifecycleEventsCount = 0;

  for (const ev of events) {
    if (
      ev.eventType !== "application.submitted" &&
      ev.eventType !== "application.status_changed" &&
      ev.eventType !== "application.completed" &&
      ev.eventType !== "application.cancelled"
    ) {
      continue;
    }

    if (options.serviceFilter && !options.serviceFilter.has(ev.payload.serviceCode)) {
      continue;
    }

    const appRef = ev.references?.applicationRef;
    if (!appRef) {
      untrackedLifecycleEventsCount++;
      continue;
    }

    const evMs = parseStrictIsoTimestampMs(ev.eventTimestamp);
    if (ev.eventType === "application.submitted") {
      if (!openApps.has(appRef)) {
        openApps.set(appRef, { serviceCode: ev.payload.serviceCode, startedAtMs: evMs });
      }
    } else if (ev.eventType === "application.status_changed") {
      if (!openApps.has(appRef)) {
        openApps.set(appRef, { serviceCode: ev.payload.serviceCode, startedAtMs: evMs });
      }
    } else {
      openApps.delete(appRef);
    }
  }

  const buckets: Record<AgingBucketKey, number> = {
    under_1h: 0,
    from_1h_to_24h: 0,
    from_1d_to_7d: 0,
    over_7d: 0,
  };

  const allAges: number[] = [];
  const agesByService = new Map<string, number[]>();

  for (const entry of openApps.values()) {
    const ageMs = Math.max(0, asOfMs - entry.startedAtMs);
    allAges.push(ageMs);
    buckets[classifyAge(ageMs)]++;

    const list = agesByService.get(entry.serviceCode) ?? [];
    list.push(ageMs);
    agesByService.set(entry.serviceCode, list);
  }

  const agingDuration = summarizeDurations(allAges);
  const byService: BacklogServiceRow[] = [...agesByService.entries()]
    .map(([serviceCode, ages]) => {
      const summary = summarizeDurations(ages);
      return {
        serviceCode,
        openCount: ages.length,
        oldestOpenAgeMs: summary.maxMs ?? 0,
        aging: summary,
      };
    })
    .sort((a, b) => b.openCount - a.openCount || a.serviceCode.localeCompare(b.serviceCode));

  return {
    tenantId: query.tenantId,
    asOfIso,
    openApplicationsCount: openApps.size,
    untrackedLifecycleEventsCount,
    oldestOpenAgeMs: agingDuration.maxMs,
    buckets,
    agingDuration,
    byService,
  };
}
