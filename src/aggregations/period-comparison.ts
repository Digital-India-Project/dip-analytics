import { assertSafeMinorUnits, computeBasisPoints, subtractMinorUnits } from "../utils/money.js";
import type { ApiMetricsSummary } from "./api-metrics.js";
import type { ApplicationFunnelSummary } from "./application-funnel.js";
import type { RevenueAndRefundsReport } from "./revenue-refunds.js";

export interface MetricPeriodDelta {
  readonly current: number;
  readonly previous: number;
  readonly absoluteDelta: number;
  /** Growth rate in basis points (e.g., 2500 = +25.00%, -1000 = -10.00%). Null when previous === 0. */
  readonly changeRateBps: number | null;
  readonly direction: "up" | "down" | "flat";
}

export function compareMetricValue(current: number, previous: number): MetricPeriodDelta {
  const safeCurrent = assertSafeMinorUnits(current, "current", true);
  const safePrevious = assertSafeMinorUnits(previous, "previous", true);
  const absoluteDelta = subtractMinorUnits(safeCurrent, safePrevious, true);
  const changeRateBps =
    safePrevious === 0 ? null : computeBasisPoints(absoluteDelta, Math.abs(safePrevious));
  const direction = absoluteDelta > 0 ? "up" : absoluteDelta < 0 ? "down" : "flat";

  return {
    current: safeCurrent,
    previous: safePrevious,
    absoluteDelta,
    changeRateBps,
    direction,
  };
}

export interface ExecutivePeriodComparison {
  readonly tenantId: string;
  readonly submittedApplications: MetricPeriodDelta;
  readonly completedApplications: MetricPeriodDelta;
  readonly cancelledApplications: MetricPeriodDelta;
  readonly apiRequests: MetricPeriodDelta;
  readonly revenueByCurrencyNetDeltaMinor: Readonly<Record<string, MetricPeriodDelta>>;
}

export function compareExecutivePeriods(params: {
  readonly currentFunnel: ApplicationFunnelSummary;
  readonly previousFunnel: ApplicationFunnelSummary;
  readonly currentRevenue: RevenueAndRefundsReport;
  readonly previousRevenue: RevenueAndRefundsReport;
  readonly currentApi: ApiMetricsSummary;
  readonly previousApi: ApiMetricsSummary;
}): ExecutivePeriodComparison {
  const {
    currentFunnel,
    previousFunnel,
    currentRevenue,
    previousRevenue,
    currentApi,
    previousApi,
  } = params;

  const currencies = new Set<string>([
    ...currentRevenue.byCurrency.map((c) => c.currency),
    ...previousRevenue.byCurrency.map((c) => c.currency),
  ]);

  const currentRevMap = new Map(
    currentRevenue.byCurrency.map((c) => [c.currency, c.netRevenueAfterRefundsMinor]),
  );
  const prevRevMap = new Map(
    previousRevenue.byCurrency.map((c) => [c.currency, c.netRevenueAfterRefundsMinor]),
  );

  const revenueByCurrencyNetDeltaMinor: Record<string, MetricPeriodDelta> = {};
  for (const cur of [...currencies].sort()) {
    revenueByCurrencyNetDeltaMinor[cur] = compareMetricValue(
      currentRevMap.get(cur) ?? 0,
      prevRevMap.get(cur) ?? 0,
    );
  }

  return {
    tenantId: currentFunnel.tenantId,
    submittedApplications: compareMetricValue(
      currentFunnel.submittedCount,
      previousFunnel.submittedCount,
    ),
    completedApplications: compareMetricValue(
      currentFunnel.completedCount,
      previousFunnel.completedCount,
    ),
    cancelledApplications: compareMetricValue(
      currentFunnel.cancelledCount,
      previousFunnel.cancelledCount,
    ),
    apiRequests: compareMetricValue(currentApi.totalRequests, previousApi.totalRequests),
    revenueByCurrencyNetDeltaMinor,
  };
}
