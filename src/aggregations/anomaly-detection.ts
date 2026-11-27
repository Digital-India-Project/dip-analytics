import { computeBasisPoints } from "../utils/money.js";
import type { HistoricalTimeSeriesSummary, TimeSeriesBucket } from "./time-series.js";

export type AnomalyMetricName =
  | "api_error_rate_bps"
  | "sla_breaches"
  | "applications_cancelled"
  | "api_requests";

export type AnomalySeverity = "warning" | "critical";

export interface AnalyticsAnomalyAlert {
  readonly tenantId: string;
  readonly metric: AnomalyMetricName;
  readonly bucketKey: string;
  readonly observedValue: number;
  readonly baselineMean: number;
  /** Relative increase over baseline in basis points (e.g. 10000 = +100.00%). */
  readonly deviationBps: number | null;
  readonly severity: AnomalySeverity;
  readonly reason: string;
}

export interface AnomalyDetectionOptions {
  /** Number of preceding buckets used to establish baseline (default 3). */
  readonly baselineWindowSize?: number;
  /** Minimum baseline mean required before firing ratio alerts (default 1). */
  readonly minBaselineFloor?: number;
  /** Warning threshold in bps above baseline (default 5000 = +50%). */
  readonly warningDeviationBps?: number;
  /** Critical threshold in bps above baseline (default 10000 = +100%). */
  readonly criticalDeviationBps?: number;
}

export interface AnomalyDetectionReport {
  readonly tenantId: string;
  readonly evaluatedBucketsCount: number;
  readonly alerts: readonly AnalyticsAnomalyAlert[];
}

function integerMean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = 0n;
  for (const v of values) sum += BigInt(Math.trunc(v));
  const len = BigInt(values.length);
  return Number((sum + len / 2n) / len);
}

function extractMetric(bucket: TimeSeriesBucket, metric: AnomalyMetricName): number {
  switch (metric) {
    case "api_error_rate_bps":
      return bucket.apiErrorRateBps ?? 0;
    case "sla_breaches":
      return bucket.slaBreaches;
    case "applications_cancelled":
      return bucket.applicationsCancelled;
    case "api_requests":
      return bucket.apiRequests;
  }
}

/**
 * Deterministic rolling-baseline spike detector over HistoricalTimeSeriesSummary.
 * Uses pure integer/BigInt arithmetic so alert thresholds are reproducible.
 */
export function detectTimeSeriesAnomalies(
  series: HistoricalTimeSeriesSummary,
  options: AnomalyDetectionOptions = {},
): AnomalyDetectionReport {
  const windowSize = Math.max(1, options.baselineWindowSize ?? 3);
  const minFloor = Math.max(1, options.minBaselineFloor ?? 1);
  const warningBps = options.warningDeviationBps ?? 5_000;
  const criticalBps = options.criticalDeviationBps ?? 10_000;

  const metrics: readonly AnomalyMetricName[] = [
    "api_error_rate_bps",
    "sla_breaches",
    "applications_cancelled",
    "api_requests",
  ];

  const alerts: AnalyticsAnomalyAlert[] = [];
  const buckets = series.buckets;

  for (let i = windowSize; i < buckets.length; i++) {
    const current = buckets[i]!;
    const baselineSlice = buckets.slice(i - windowSize, i);

    for (const metric of metrics) {
      const observed = extractMetric(current, metric);
      const baselineMean = integerMean(baselineSlice.map((b) => extractMetric(b, metric)));

      if (baselineMean < minFloor) {
        if (observed >= minFloor * 5 && observed > 0) {
          alerts.push({
            tenantId: series.tenantId,
            metric,
            bucketKey: current.bucketKey,
            observedValue: observed,
            baselineMean,
            deviationBps: null,
            severity: "warning",
            reason: `Metric ${metric} spiked to ${observed} from near-zero baseline (${baselineMean}).`,
          });
        }
        continue;
      }

      if (observed <= baselineMean) continue;
      const delta = observed - baselineMean;
      const deviationBps = computeBasisPoints(delta, baselineMean);
      if (deviationBps === null || deviationBps < warningBps) continue;

      const severity: AnomalySeverity =
        deviationBps >= criticalBps ? "critical" : "warning";

      alerts.push({
        tenantId: series.tenantId,
        metric,
        bucketKey: current.bucketKey,
        observedValue: observed,
        baselineMean,
        deviationBps,
        severity,
        reason: `Metric ${metric} reached ${observed} vs rolling baseline ${baselineMean} (+${deviationBps} bps).`,
      });
    }
  }

  return {
    tenantId: series.tenantId,
    evaluatedBucketsCount: buckets.length,
    alerts,
  };
}
