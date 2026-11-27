import type { AnyAnalyticsEvent } from "../contracts/events.js";
import type { AuthorizedTenantQuery } from "../privacy/tenant-boundary.js";
import { addMinorUnits, assertValidCurrencyCode, computeBasisPoints } from "../utils/money.js";
import {
  assertValidTimezone,
  enumerateBucketKeys,
  formatBucketKey,
  parseStrictIsoTimestampMs,
  type TimeGranularity,
} from "../utils/time.js";
import { prepareWindowEvents } from "./math.js";

export interface TimeSeriesBucket {
  readonly bucketKey: string;
  readonly totalEvents: number;
  readonly applicationsSubmitted: number;
  readonly applicationsCompleted: number;
  readonly applicationsCancelled: number;
  readonly slaBreaches: number;
  readonly apiRequests: number;
  readonly apiErrorCount: number;
  readonly apiErrorRateBps: number | null;
  readonly revenueByCurrencyMinor: Readonly<Record<string, number>>;
  readonly refundsByCurrencyMinor: Readonly<Record<string, number>>;
}

export interface HistoricalTimeSeriesSummary {
  readonly tenantId: string;
  readonly granularity: TimeGranularity;
  readonly timeZone: string;
  readonly buckets: readonly TimeSeriesBucket[];
}

interface BucketAccumulator {
  totalEvents: number;
  applicationsSubmitted: number;
  applicationsCompleted: number;
  applicationsCancelled: number;
  slaBreaches: number;
  apiRequests: number;
  apiErrorCount: number;
  revenueByCurrency: Map<string, number>;
  refundsByCurrency: Map<string, number>;
}

function createEmptyAccumulator(): BucketAccumulator {
  return {
    totalEvents: 0,
    applicationsSubmitted: 0,
    applicationsCompleted: 0,
    applicationsCancelled: 0,
    slaBreaches: 0,
    apiRequests: 0,
    apiErrorCount: 0,
    revenueByCurrency: new Map<string, number>(),
    refundsByCurrency: new Map<string, number>(),
  };
}

export function aggregateTimeSeries(
  rawEvents: readonly AnyAnalyticsEvent[],
  query: AuthorizedTenantQuery,
  options: {
    readonly granularity?: TimeGranularity;
    readonly timeZone?: string;
    readonly includeEmptyBuckets?: boolean;
  } = {},
): HistoricalTimeSeriesSummary {
  const granularity = options.granularity ?? "day";
  const timeZone = assertValidTimezone(options.timeZone ?? "UTC");
  const includeEmptyBuckets = options.includeEmptyBuckets ?? true;

  const { events } = prepareWindowEvents(rawEvents, query);
  const bucketMap = new Map<string, BucketAccumulator>();

  if (includeEmptyBuckets) {
    for (const key of enumerateBucketKeys(query.fromMs, query.toMs, granularity, timeZone)) {
      bucketMap.set(key, createEmptyAccumulator());
    }
  }

  for (const ev of events) {
    const epochMs = parseStrictIsoTimestampMs(ev.eventTimestamp);
    const key = formatBucketKey(epochMs, granularity, timeZone);
    let acc = bucketMap.get(key);
    if (!acc) {
      acc = createEmptyAccumulator();
      bucketMap.set(key, acc);
    }

    acc.totalEvents++;

    switch (ev.eventType) {
      case "application.submitted":
        acc.applicationsSubmitted++;
        break;
      case "application.completed":
        acc.applicationsCompleted++;
        break;
      case "application.cancelled":
        acc.applicationsCancelled++;
        break;
      case "sla.threshold_breached":
        acc.slaBreaches++;
        break;
      case "api.request_recorded":
        acc.apiRequests++;
        if (ev.payload.statusCode >= 400) {
          acc.apiErrorCount++;
        }
        break;
      case "payment.succeeded": {
        const cur = assertValidCurrencyCode(ev.payload.currency);
        acc.revenueByCurrency.set(
          cur,
          addMinorUnits(acc.revenueByCurrency.get(cur) ?? 0, ev.payload.amountMinor),
        );
        break;
      }
      case "payment.refunded": {
        const cur = assertValidCurrencyCode(ev.payload.currency);
        acc.refundsByCurrency.set(
          cur,
          addMinorUnits(acc.refundsByCurrency.get(cur) ?? 0, ev.payload.refundAmountMinor),
        );
        break;
      }
      default:
        break;
    }
  }

  const buckets: TimeSeriesBucket[] = [...bucketMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucketKey, acc]) => {
      const revenueObj: Record<string, number> = {};
      for (const [k, v] of [...acc.revenueByCurrency.entries()].sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        revenueObj[k] = v;
      }
      const refundsObj: Record<string, number> = {};
      for (const [k, v] of [...acc.refundsByCurrency.entries()].sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        refundsObj[k] = v;
      }
      return {
        bucketKey,
        totalEvents: acc.totalEvents,
        applicationsSubmitted: acc.applicationsSubmitted,
        applicationsCompleted: acc.applicationsCompleted,
        applicationsCancelled: acc.applicationsCancelled,
        slaBreaches: acc.slaBreaches,
        apiRequests: acc.apiRequests,
        apiErrorCount: acc.apiErrorCount,
        apiErrorRateBps: computeBasisPoints(acc.apiErrorCount, acc.apiRequests),
        revenueByCurrencyMinor: revenueObj,
        refundsByCurrencyMinor: refundsObj,
      };
    });

  return {
    tenantId: query.tenantId,
    granularity,
    timeZone,
    buckets,
  };
}
