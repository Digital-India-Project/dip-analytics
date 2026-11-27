import type { AnyAnalyticsEvent } from "../contracts/events.js";
import type { AuthorizedTenantQuery } from "../privacy/tenant-boundary.js";
import {
  addMinorUnits,
  assertValidCurrencyCode,
  computeBasisPoints,
  CurrencyMismatchError,
  formatMinorUnits,
  subtractMinorUnits,
} from "../utils/money.js";
import { prepareWindowEvents } from "./math.js";

export interface CurrencyRevenueSummary {
  readonly currency: string;
  readonly succeededPaymentsCount: number;
  readonly grossRevenueMinor: number;
  readonly totalFeesMinor: number;
  readonly netRevenueBeforeRefundsMinor: number;
  readonly refundsCount: number;
  readonly partialRefundsCount: number;
  readonly fullRefundsCount: number;
  readonly totalRefundedMinor: number;
  readonly netRevenueAfterRefundsMinor: number;
  readonly refundRateBps: number | null;
  readonly formattedGrossRevenue: string;
  readonly formattedTotalRefunded: string;
  readonly formattedNetRevenueAfterRefunds: string;
}

export interface RevenueAndRefundsReport {
  readonly tenantId: string;
  readonly byCurrency: readonly CurrencyRevenueSummary[];
  readonly multiCurrencyDetected: boolean;
}

interface CurrencyAccumulator {
  succeededPaymentsCount: number;
  grossRevenueMinor: number;
  totalFeesMinor: number;
  netBeforeRefundsMinor: number;
  refundsCount: number;
  partialRefundsCount: number;
  fullRefundsCount: number;
  totalRefundedMinor: number;
}

export interface RevenueAggregationOptions {
  /** If specified, throws CurrencyMismatchError if another currency is encountered. */
  readonly strictCurrency?: string;
  readonly currencyFilter?: ReadonlySet<string>;
}

/**
 * Computes currency-grouped integer minor-unit revenue and refund summaries.
 * Never performs floating-point arithmetic or cross-currency summation.
 */
export function aggregateRevenueAndRefunds(
  rawEvents: readonly AnyAnalyticsEvent[],
  query: AuthorizedTenantQuery,
  options: RevenueAggregationOptions = {},
): RevenueAndRefundsReport {
  if (options.strictCurrency !== undefined) {
    assertValidCurrencyCode(options.strictCurrency);
  }
  const { events } = prepareWindowEvents(rawEvents, query);
  const byCurrency = new Map<string, CurrencyAccumulator>();

  function getAcc(currency: string): CurrencyAccumulator {
    assertValidCurrencyCode(currency);
    if (options.strictCurrency !== undefined && currency !== options.strictCurrency) {
      throw new CurrencyMismatchError(options.strictCurrency, currency);
    }
    let acc = byCurrency.get(currency);
    if (!acc) {
      acc = {
        succeededPaymentsCount: 0,
        grossRevenueMinor: 0,
        totalFeesMinor: 0,
        netBeforeRefundsMinor: 0,
        refundsCount: 0,
        partialRefundsCount: 0,
        fullRefundsCount: 0,
        totalRefundedMinor: 0,
      };
      byCurrency.set(currency, acc);
    }
    return acc;
  }

  for (const ev of events) {
    if (ev.eventType === "payment.succeeded") {
      if (options.currencyFilter && !options.currencyFilter.has(ev.payload.currency)) continue;
      const acc = getAcc(ev.payload.currency);
      acc.succeededPaymentsCount++;
      acc.grossRevenueMinor = addMinorUnits(acc.grossRevenueMinor, ev.payload.amountMinor);
      const fee = ev.payload.feeMinor ?? 0;
      acc.totalFeesMinor = addMinorUnits(acc.totalFeesMinor, fee);
      const net =
        ev.payload.netAmountMinor ??
        subtractMinorUnits(ev.payload.amountMinor, fee, false);
      acc.netBeforeRefundsMinor = addMinorUnits(acc.netBeforeRefundsMinor, net);
    } else if (ev.eventType === "payment.refunded") {
      if (options.currencyFilter && !options.currencyFilter.has(ev.payload.currency)) continue;
      const acc = getAcc(ev.payload.currency);
      acc.refundsCount++;
      if (ev.payload.partial) acc.partialRefundsCount++;
      else acc.fullRefundsCount++;
      acc.totalRefundedMinor = addMinorUnits(
        acc.totalRefundedMinor,
        ev.payload.refundAmountMinor,
      );
    }
  }

  const summaries: CurrencyRevenueSummary[] = [...byCurrency.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, acc]) => {
      const netAfterRefunds = subtractMinorUnits(
        acc.netBeforeRefundsMinor,
        acc.totalRefundedMinor,
        true,
      );
      return {
        currency,
        succeededPaymentsCount: acc.succeededPaymentsCount,
        grossRevenueMinor: acc.grossRevenueMinor,
        totalFeesMinor: acc.totalFeesMinor,
        netRevenueBeforeRefundsMinor: acc.netBeforeRefundsMinor,
        refundsCount: acc.refundsCount,
        partialRefundsCount: acc.partialRefundsCount,
        fullRefundsCount: acc.fullRefundsCount,
        totalRefundedMinor: acc.totalRefundedMinor,
        netRevenueAfterRefundsMinor: netAfterRefunds,
        refundRateBps: computeBasisPoints(acc.totalRefundedMinor, acc.grossRevenueMinor),
        formattedGrossRevenue: formatMinorUnits(acc.grossRevenueMinor, currency),
        formattedTotalRefunded: formatMinorUnits(acc.totalRefundedMinor, currency),
        formattedNetRevenueAfterRefunds: formatMinorUnits(netAfterRefunds, currency),
      };
    });

  return {
    tenantId: query.tenantId,
    byCurrency: summaries,
    multiCurrencyDetected: summaries.length > 1,
  };
}
