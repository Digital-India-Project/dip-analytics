import type {
  AnyAnalyticsEvent,
  PaymentFailureCategory,
  PaymentMethodCategory,
} from "../contracts/events.js";
import type { AuthorizedTenantQuery } from "../privacy/tenant-boundary.js";
import { addMinorUnits, assertValidCurrencyCode, computeBasisPoints } from "../utils/money.js";
import { prepareWindowEvents, summarizeDurations, type DurationSummary } from "./math.js";

export interface PaymentFailureBreakdown {
  readonly failureCategory: PaymentFailureCategory;
  readonly failedCount: number;
  readonly retryableCount: number;
}

export interface PaymentMethodSummary {
  readonly paymentMethodCategory: PaymentMethodCategory;
  readonly initiatedCount: number;
  readonly succeededCount: number;
  readonly failedCount: number;
  readonly successRateBps: number | null;
}

export interface PaymentMetricsSummary {
  readonly tenantId: string;
  readonly initiatedCount: number;
  readonly succeededCount: number;
  readonly failedCount: number;
  readonly refundedCount: number;
  readonly terminalAttemptsCount: number;
  readonly successRateBps: number | null;
  readonly failureRateBps: number | null;
  readonly retryableFailedCount: number;
  readonly settlementDuration: DurationSummary;
  readonly succeededVolumeByCurrencyMinor: Readonly<Record<string, number>>;
  readonly failedVolumeByCurrencyMinor: Readonly<Record<string, number>>;
  readonly failureBreakdown: readonly PaymentFailureBreakdown[];
  readonly byMethod: readonly PaymentMethodSummary[];
}

export function aggregatePaymentMetrics(
  rawEvents: readonly AnyAnalyticsEvent[],
  query: AuthorizedTenantQuery,
  currencyFilter?: ReadonlySet<string>,
): PaymentMetricsSummary {
  const { events } = prepareWindowEvents(rawEvents, query);

  let initiatedCount = 0;
  let succeededCount = 0;
  let failedCount = 0;
  let refundedCount = 0;
  let retryableFailedCount = 0;

  const settlementDurationsMs: number[] = [];
  const succeededVol = new Map<string, number>();
  const failedVol = new Map<string, number>();
  const failureMap = new Map<PaymentFailureCategory, { failed: number; retryable: number }>();
  const methodMap = new Map<
    PaymentMethodCategory,
    { initiated: number; succeeded: number; failed: number }
  >();

  function getMethod(m: PaymentMethodCategory) {
    let entry = methodMap.get(m);
    if (!entry) {
      entry = { initiated: 0, succeeded: 0, failed: 0 };
      methodMap.set(m, entry);
    }
    return entry;
  }

  for (const ev of events) {
    if (ev.eventType === "payment.initiated") {
      const cur = assertValidCurrencyCode(ev.payload.currency);
      if (currencyFilter && !currencyFilter.has(cur)) continue;
      initiatedCount++;
      getMethod(ev.payload.paymentMethodCategory).initiated++;
    } else if (ev.eventType === "payment.succeeded") {
      const cur = assertValidCurrencyCode(ev.payload.currency);
      if (currencyFilter && !currencyFilter.has(cur)) continue;
      succeededCount++;
      getMethod(ev.payload.paymentMethodCategory).succeeded++;
      succeededVol.set(cur, addMinorUnits(succeededVol.get(cur) ?? 0, ev.payload.amountMinor));
      if (ev.payload.settlementDurationMs !== undefined) {
        settlementDurationsMs.push(ev.payload.settlementDurationMs);
      }
    } else if (ev.eventType === "payment.failed") {
      const cur = assertValidCurrencyCode(ev.payload.currency);
      if (currencyFilter && !currencyFilter.has(cur)) continue;
      failedCount++;
      if (ev.payload.retryable) retryableFailedCount++;
      getMethod(ev.payload.paymentMethodCategory).failed++;
      failedVol.set(cur, addMinorUnits(failedVol.get(cur) ?? 0, ev.payload.amountMinor));

      const fEntry = failureMap.get(ev.payload.failureCategory) ?? {
        failed: 0,
        retryable: 0,
      };
      fEntry.failed++;
      if (ev.payload.retryable) fEntry.retryable++;
      failureMap.set(ev.payload.failureCategory, fEntry);
    } else if (ev.eventType === "payment.refunded") {
      const cur = assertValidCurrencyCode(ev.payload.currency);
      if (currencyFilter && !currencyFilter.has(cur)) continue;
      refundedCount++;
    }
  }

  const terminalAttemptsCount = succeededCount + failedCount;
  const succeededVolumeByCurrencyMinor: Record<string, number> = {};
  for (const [k, v] of [...succeededVol.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    succeededVolumeByCurrencyMinor[k] = v;
  }
  const failedVolumeByCurrencyMinor: Record<string, number> = {};
  for (const [k, v] of [...failedVol.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    failedVolumeByCurrencyMinor[k] = v;
  }

  const failureBreakdown: PaymentFailureBreakdown[] = [...failureMap.entries()]
    .map(([failureCategory, stats]) => ({
      failureCategory,
      failedCount: stats.failed,
      retryableCount: stats.retryable,
    }))
    .sort((a, b) => b.failedCount - a.failedCount || a.failureCategory.localeCompare(b.failureCategory));

  const byMethod: PaymentMethodSummary[] = [...methodMap.entries()]
    .map(([paymentMethodCategory, stats]) => ({
      paymentMethodCategory,
      initiatedCount: stats.initiated,
      succeededCount: stats.succeeded,
      failedCount: stats.failed,
      successRateBps: computeBasisPoints(stats.succeeded, stats.succeeded + stats.failed),
    }))
    .sort(
      (a, b) =>
        b.succeededCount + b.failedCount - (a.succeededCount + a.failedCount) ||
        a.paymentMethodCategory.localeCompare(b.paymentMethodCategory),
    );

  return {
    tenantId: query.tenantId,
    initiatedCount,
    succeededCount,
    failedCount,
    refundedCount,
    terminalAttemptsCount,
    successRateBps: computeBasisPoints(succeededCount, terminalAttemptsCount),
    failureRateBps: computeBasisPoints(failedCount, terminalAttemptsCount),
    retryableFailedCount,
    settlementDuration: summarizeDurations(settlementDurationsMs),
    succeededVolumeByCurrencyMinor,
    failedVolumeByCurrencyMinor,
    failureBreakdown,
    byMethod,
  };
}
