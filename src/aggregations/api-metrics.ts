import type { AnyAnalyticsEvent, HttpMethod } from "../contracts/events.js";
import type { AuthorizedTenantQuery } from "../privacy/tenant-boundary.js";
import { capCardinality } from "../reliability/index.js";
import { computeBasisPoints } from "../utils/money.js";
import {
  mergeDurationSummaries,
  prepareWindowEvents,
  summarizeDurations,
  type DurationSummary,
} from "./math.js";

export interface ApiEndpointMetricsRow {
  readonly routeKey: string;
  readonly method: HttpMethod | "MIXED";
  readonly routeTemplate: string;
  readonly requestCount: number;
  readonly status2xxCount: number;
  readonly status4xxCount: number;
  readonly status5xxCount: number;
  readonly errorCount: number;
  readonly errorRateBps: number | null;
  readonly serverErrorRateBps: number | null;
  readonly latency: DurationSummary;
}

export interface ApiMetricsSummary {
  readonly tenantId: string;
  readonly totalRequests: number;
  readonly status2xxCount: number;
  readonly status4xxCount: number;
  readonly status5xxCount: number;
  readonly totalErrorCount: number;
  readonly errorRateBps: number | null;
  readonly serverErrorRateBps: number | null;
  readonly overallLatency: DurationSummary;
  readonly endpoints: readonly ApiEndpointMetricsRow[];
  readonly truncatedEndpointCount: number;
  readonly topErrorCodes: readonly { readonly errorCode: string; readonly count: number }[];
}

interface EndpointAccumulator {
  method: HttpMethod;
  routeTemplate: string;
  requestCount: number;
  status2xxCount: number;
  status4xxCount: number;
  status5xxCount: number;
  latenciesMs: number[];
}

export function aggregateApiMetrics(
  rawEvents: readonly AnyAnalyticsEvent[],
  query: AuthorizedTenantQuery,
  options: { readonly maxEndpoints?: number } = {},
): ApiMetricsSummary {
  const { events } = prepareWindowEvents(rawEvents, query);

  let totalRequests = 0;
  let status2xxCount = 0;
  let status4xxCount = 0;
  let status5xxCount = 0;
  const allLatencies: number[] = [];
  const byEndpoint = new Map<string, EndpointAccumulator>();
  const errorCodes = new Map<string, number>();

  for (const ev of events) {
    if (ev.eventType !== "api.request_recorded") continue;
    totalRequests++;
    allLatencies.push(ev.payload.latencyMs);

    const is2xx = ev.payload.statusCode >= 200 && ev.payload.statusCode < 300;
    const is4xx = ev.payload.statusCode >= 400 && ev.payload.statusCode < 500;
    const is5xx = ev.payload.statusCode >= 500 && ev.payload.statusCode < 600;

    if (is2xx) status2xxCount++;
    if (is4xx) status4xxCount++;
    if (is5xx) status5xxCount++;

    if (ev.payload.errorCode) {
      errorCodes.set(ev.payload.errorCode, (errorCodes.get(ev.payload.errorCode) ?? 0) + 1);
    }

    const routeKey = `${ev.payload.method} ${ev.payload.routeTemplate}`;
    let acc = byEndpoint.get(routeKey);
    if (!acc) {
      acc = {
        method: ev.payload.method,
        routeTemplate: ev.payload.routeTemplate,
        requestCount: 0,
        status2xxCount: 0,
        status4xxCount: 0,
        status5xxCount: 0,
        latenciesMs: [],
      };
      byEndpoint.set(routeKey, acc);
    }
    acc.requestCount++;
    if (is2xx) acc.status2xxCount++;
    if (is4xx) acc.status4xxCount++;
    if (is5xx) acc.status5xxCount++;
    acc.latenciesMs.push(ev.payload.latencyMs);
  }

  const allRows: ApiEndpointMetricsRow[] = [...byEndpoint.entries()].map(
    ([routeKey, acc]) => {
      const errorCount = acc.status4xxCount + acc.status5xxCount;
      return {
        routeKey,
        method: acc.method,
        routeTemplate: acc.routeTemplate,
        requestCount: acc.requestCount,
        status2xxCount: acc.status2xxCount,
        status4xxCount: acc.status4xxCount,
        status5xxCount: acc.status5xxCount,
        errorCount,
        errorRateBps: computeBasisPoints(errorCount, acc.requestCount),
        serverErrorRateBps: computeBasisPoints(acc.status5xxCount, acc.requestCount),
        latency: summarizeDurations(acc.latenciesMs),
      };
    },
  );

  const capped = capCardinality(
    allRows,
    (r) => r.requestCount,
    (r) => r.routeKey,
    (otherLabel, dropped) => {
      let requestCount = 0;
      let s2 = 0;
      let s4 = 0;
      let s5 = 0;
      for (const r of dropped) {
        requestCount += r.requestCount;
        s2 += r.status2xxCount;
        s4 += r.status4xxCount;
        s5 += r.status5xxCount;
      }
      const err = s4 + s5;
      return {
        routeKey: otherLabel,
        method: "MIXED" as const,
        routeTemplate: otherLabel,
        requestCount,
        status2xxCount: s2,
        status4xxCount: s4,
        status5xxCount: s5,
        errorCount: err,
        errorRateBps: computeBasisPoints(err, requestCount),
        serverErrorRateBps: computeBasisPoints(s5, requestCount),
        latency: mergeDurationSummaries(dropped.map((d) => d.latency)),
      };
    },
    { maxGroups: options.maxEndpoints ?? 100 },
  );

  const totalErrorCount = status4xxCount + status5xxCount;
  const topErrorCodes = [...errorCodes.entries()]
    .map(([errorCode, count]) => ({ errorCode, count }))
    .sort((a, b) => b.count - a.count || a.errorCode.localeCompare(b.errorCode))
    .slice(0, 20);

  return {
    tenantId: query.tenantId,
    totalRequests,
    status2xxCount,
    status4xxCount,
    status5xxCount,
    totalErrorCount,
    errorRateBps: computeBasisPoints(totalErrorCount, totalRequests),
    serverErrorRateBps: computeBasisPoints(status5xxCount, totalRequests),
    overallLatency: summarizeDurations(allLatencies),
    endpoints: capped.rows,
    truncatedEndpointCount: capped.truncatedGroupCount,
    topErrorCodes,
  };
}
