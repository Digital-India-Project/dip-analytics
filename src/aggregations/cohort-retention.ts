import type { AnyAnalyticsEvent } from "../contracts/events.js";
import type { AuthorizedTenantQuery } from "../privacy/tenant-boundary.js";
import { capCardinality } from "../reliability/index.js";
import { addMinorUnits, assertValidCurrencyCode, computeBasisPoints } from "../utils/money.js";
import {
  assertValidTimezone,
  enumerateBucketKeys,
  formatBucketKey,
  parseStrictIsoTimestampMs,
  type TimeGranularity,
} from "../utils/time.js";
import { prepareWindowEvents } from "./math.js";

export interface CohortRetentionPeriodCell {
  readonly periodOffset: number;
  readonly bucketKey: string;
  readonly activeAccountsCount: number;
  readonly retentionRateBps: number | null;
  readonly revenueByCurrencyMinor: Readonly<Record<string, number>>;
}

export interface CohortRetentionRow {
  readonly cohortBucket: string;
  readonly cohortSize: number;
  readonly periods: readonly CohortRetentionPeriodCell[];
}

export interface AccountCohortRetentionReport {
  readonly tenantId: string;
  readonly granularity: TimeGranularity;
  readonly timeZone: string;
  readonly trackedAccountsCount: number;
  readonly untrackedAccountEventsCount: number;
  readonly cohorts: readonly CohortRetentionRow[];
  readonly truncatedCohortCount: number;
}

/**
 * Computes opaque `references.accountRef` cohort retention curves across
 * day/week/month buckets without any personal identifiers.
 */
export function aggregateAccountCohortRetention(
  rawEvents: readonly AnyAnalyticsEvent[],
  query: AuthorizedTenantQuery,
  options: {
    readonly granularity?: Exclude<TimeGranularity, "hour">;
    readonly timeZone?: string;
    readonly maxCohorts?: number;
  } = {},
): AccountCohortRetentionReport {
  const granularity = options.granularity ?? "week";
  const timeZone = assertValidTimezone(options.timeZone ?? "UTC");
  const { events } = prepareWindowEvents(rawEvents, query);

  const orderedBuckets = enumerateBucketKeys(query.fromMs, query.toMs, granularity, timeZone);
  const bucketIndexByKey = new Map<string, number>();
  for (let i = 0; i < orderedBuckets.length; i++) {
    bucketIndexByKey.set(orderedBuckets[i]!, i);
  }

  const firstBucketIndexByAccount = new Map<string, number>();
  const activeAccountIndicesByCohortAndOffset = new Map<string, Set<string>>();
  const revenueByCohortOffsetAndCurrency = new Map<string, Map<string, number>>();
  let untrackedAccountEventsCount = 0;

  for (const ev of events) {
    const accountRef = ev.references?.accountRef;
    if (!accountRef) {
      untrackedAccountEventsCount++;
      continue;
    }

    const epochMs = parseStrictIsoTimestampMs(ev.eventTimestamp);
    const bucketKey = formatBucketKey(epochMs, granularity, timeZone);
    const bucketIdx = bucketIndexByKey.get(bucketKey);
    if (bucketIdx === undefined) continue;

    let firstIdx = firstBucketIndexByAccount.get(accountRef);
    if (firstIdx === undefined) {
      firstIdx = bucketIdx;
      firstBucketIndexByAccount.set(accountRef, firstIdx);
    }

    const offset = bucketIdx - firstIdx;
    if (offset < 0) continue;

    const cohortKey = orderedBuckets[firstIdx]!;
    const cellKey = `${cohortKey}::${offset}`;

    let activeSet = activeAccountIndicesByCohortAndOffset.get(cellKey);
    if (!activeSet) {
      activeSet = new Set<string>();
      activeAccountIndicesByCohortAndOffset.set(cellKey, activeSet);
    }
    activeSet.add(accountRef);

    if (ev.eventType === "payment.succeeded") {
      const cur = assertValidCurrencyCode(ev.payload.currency);
      let revMap = revenueByCohortOffsetAndCurrency.get(cellKey);
      if (!revMap) {
        revMap = new Map<string, number>();
        revenueByCohortOffsetAndCurrency.set(cellKey, revMap);
      }
      revMap.set(cur, addMinorUnits(revMap.get(cur) ?? 0, ev.payload.amountMinor));
    }
  }

  const cohortSizes = new Map<string, number>();
  for (const firstIdx of firstBucketIndexByAccount.values()) {
    const cohortKey = orderedBuckets[firstIdx]!;
    cohortSizes.set(cohortKey, (cohortSizes.get(cohortKey) ?? 0) + 1);
  }

  const allCohorts: CohortRetentionRow[] = [];
  for (let cohortIdx = 0; cohortIdx < orderedBuckets.length; cohortIdx++) {
    const cohortBucket = orderedBuckets[cohortIdx]!;
    const cohortSize = cohortSizes.get(cohortBucket) ?? 0;
    if (cohortSize === 0) continue;

    const periods: CohortRetentionPeriodCell[] = [];
    for (let targetIdx = cohortIdx; targetIdx < orderedBuckets.length; targetIdx++) {
      const periodOffset = targetIdx - cohortIdx;
      const cellKey = `${cohortBucket}::${periodOffset}`;
      const activeAccountsCount = activeAccountIndicesByCohortAndOffset.get(cellKey)?.size ?? 0;
      const revMap = revenueByCohortOffsetAndCurrency.get(cellKey);
      const revenueByCurrencyMinor: Record<string, number> = {};
      if (revMap) {
        for (const [cur, amt] of [...revMap.entries()].sort(([a], [b]) => a.localeCompare(b))) {
          revenueByCurrencyMinor[cur] = amt;
        }
      }
      periods.push({
        periodOffset,
        bucketKey: orderedBuckets[targetIdx]!,
        activeAccountsCount,
        retentionRateBps: computeBasisPoints(activeAccountsCount, cohortSize),
        revenueByCurrencyMinor,
      });
    }

    allCohorts.push({
      cohortBucket,
      cohortSize,
      periods,
    });
  }

  const capped = capCardinality(
    allCohorts,
    (c) => c.cohortSize,
    (c) => c.cohortBucket,
    (otherLabel, dropped) => {
      let cohortSize = 0;
      for (const d of dropped) cohortSize += d.cohortSize;
      return {
        cohortBucket: otherLabel,
        cohortSize,
        periods: [],
      };
    },
    { maxGroups: options.maxCohorts ?? 52 },
  );

  // Restore chronological order for non-__other__ cohorts
  const sortedCohorts = [...capped.rows].sort((a, b) => {
    if (a.cohortBucket === "__other__") return 1;
    if (b.cohortBucket === "__other__") return -1;
    return a.cohortBucket.localeCompare(b.cohortBucket);
  });

  return {
    tenantId: query.tenantId,
    granularity,
    timeZone,
    trackedAccountsCount: firstBucketIndexByAccount.size,
    untrackedAccountEventsCount,
    cohorts: sortedCohorts,
    truncatedCohortCount: capped.truncatedGroupCount,
  };
}
