import type { AnyAnalyticsEvent } from "../contracts/events.js";
import type { AuthorizedTenantQuery } from "../privacy/tenant-boundary.js";
import { capCardinality } from "../reliability/index.js";
import {
  addMinorUnits,
  assertValidCurrencyCode,
  computeBasisPoints,
  CurrencyMismatchError,
  formatMinorUnits,
  subtractMinorUnits,
} from "../utils/money.js";
import { prepareWindowEvents } from "./math.js";

export interface ServiceUnitEconomicsRow {
  readonly serviceCode: string;
  readonly currency: string;
  readonly completedApplicationsCount: number;
  readonly grossRevenueMinor: number;
  readonly gatewayFeesMinor: number;
  readonly refundedMinor: number;
  readonly partnerCommissionMinor: number;
  readonly netContributionMinor: number;
  readonly netMarginBps: number | null;
  readonly revenuePerCompletedMinor: number | null;
  readonly netContributionPerCompletedMinor: number | null;
  readonly formattedNetContribution: string;
}

export interface ServiceUnitEconomicsReport {
  readonly tenantId: string;
  readonly rows: readonly ServiceUnitEconomicsRow[];
  readonly untrackedServicePaymentEventsCount: number;
  readonly truncatedGroupCount: number;
}

interface UnitAccumulator {
  serviceCode: string;
  currency: string;
  completedApplicationsCount: number;
  grossRevenueMinor: number;
  gatewayFeesMinor: number;
  refundedMinor: number;
  partnerCommissionMinor: number;
}

function extractServiceCode(ev: AnyAnalyticsEvent): string | undefined {
  if ("serviceCode" in ev.payload && typeof ev.payload.serviceCode === "string") {
    return ev.payload.serviceCode;
  }
  return ev.references?.serviceCode;
}

function divideIntegerHalfUp(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  const num = BigInt(numerator);
  const den = BigInt(denominator);
  const sign = num < 0n ? -1n : 1n;
  const absNum = num < 0n ? -num : num;
  return Number(sign * ((absNum + den / 2n) / den));
}

/**
 * Computes per-(serviceCode, currency) unit economics combining gross revenue,
 * payment fees, refunds, partner commissions, and completed application counts
 * using exact integer minor-unit arithmetic.
 */
export function aggregateServiceUnitEconomics(
  rawEvents: readonly AnyAnalyticsEvent[],
  query: AuthorizedTenantQuery,
  options: {
    readonly serviceFilter?: ReadonlySet<string>;
    readonly strictCurrency?: string;
    readonly maxGroups?: number;
  } = {},
): ServiceUnitEconomicsReport {
  if (options.strictCurrency !== undefined) {
    assertValidCurrencyCode(options.strictCurrency);
  }
  const { events } = prepareWindowEvents(rawEvents, query);

  const completedByService = new Map<string, number>();
  const byKey = new Map<string, UnitAccumulator>();
  let untrackedServicePaymentEventsCount = 0;

  function getAcc(serviceCode: string, currency: string): UnitAccumulator {
    assertValidCurrencyCode(currency);
    if (options.strictCurrency !== undefined && currency !== options.strictCurrency) {
      throw new CurrencyMismatchError(options.strictCurrency, currency);
    }
    const key = `${serviceCode}::${currency}`;
    let acc = byKey.get(key);
    if (!acc) {
      acc = {
        serviceCode,
        currency,
        completedApplicationsCount: 0,
        grossRevenueMinor: 0,
        gatewayFeesMinor: 0,
        refundedMinor: 0,
        partnerCommissionMinor: 0,
      };
      byKey.set(key, acc);
    }
    return acc;
  }

  for (const ev of events) {
    const serviceCode = extractServiceCode(ev);
    if (options.serviceFilter && (!serviceCode || !options.serviceFilter.has(serviceCode))) {
      continue;
    }

    if (ev.eventType === "application.completed") {
      completedByService.set(
        ev.payload.serviceCode,
        (completedByService.get(ev.payload.serviceCode) ?? 0) + 1,
      );
    } else if (ev.eventType === "payment.succeeded") {
      if (!serviceCode) {
        untrackedServicePaymentEventsCount++;
        continue;
      }
      const acc = getAcc(serviceCode, ev.payload.currency);
      acc.grossRevenueMinor = addMinorUnits(acc.grossRevenueMinor, ev.payload.amountMinor);
      const fee =
        ev.payload.feeMinor ??
        (ev.payload.netAmountMinor !== undefined
          ? subtractMinorUnits(ev.payload.amountMinor, ev.payload.netAmountMinor, false)
          : 0);
      acc.gatewayFeesMinor = addMinorUnits(acc.gatewayFeesMinor, fee);
    } else if (ev.eventType === "payment.refunded") {
      if (!serviceCode) {
        untrackedServicePaymentEventsCount++;
        continue;
      }
      const acc = getAcc(serviceCode, ev.payload.currency);
      acc.refundedMinor = addMinorUnits(acc.refundedMinor, ev.payload.refundAmountMinor);
    } else if (
      ev.eventType === "partner.completed_work" &&
      ev.payload.commissionMinor !== undefined &&
      ev.payload.currency !== undefined
    ) {
      const acc = getAcc(ev.payload.serviceCode, ev.payload.currency);
      acc.partnerCommissionMinor = addMinorUnits(
        acc.partnerCommissionMinor,
        ev.payload.commissionMinor,
      );
    }
  }

  const allRows: ServiceUnitEconomicsRow[] = [...byKey.values()].map((acc) => {
    const completed = completedByService.get(acc.serviceCode) ?? 0;
    const totalCosts = addMinorUnits(
      addMinorUnits(acc.gatewayFeesMinor, acc.refundedMinor),
      acc.partnerCommissionMinor,
    );
    const netContributionMinor = subtractMinorUnits(acc.grossRevenueMinor, totalCosts, true);

    return {
      serviceCode: acc.serviceCode,
      currency: acc.currency,
      completedApplicationsCount: completed,
      grossRevenueMinor: acc.grossRevenueMinor,
      gatewayFeesMinor: acc.gatewayFeesMinor,
      refundedMinor: acc.refundedMinor,
      partnerCommissionMinor: acc.partnerCommissionMinor,
      netContributionMinor,
      netMarginBps: computeBasisPoints(netContributionMinor, acc.grossRevenueMinor),
      revenuePerCompletedMinor: divideIntegerHalfUp(acc.grossRevenueMinor, completed),
      netContributionPerCompletedMinor: divideIntegerHalfUp(netContributionMinor, completed),
      formattedNetContribution: formatMinorUnits(netContributionMinor, acc.currency),
    };
  });

  const capped = capCardinality(
    allRows,
    (r) => r.grossRevenueMinor + r.partnerCommissionMinor,
    (r) => `${r.serviceCode}::${r.currency}`,
    (otherLabel, dropped) => {
      let completed = 0;
      let gross = 0;
      let fees = 0;
      let refunded = 0;
      let commission = 0;
      const currencies = new Set<string>();
      for (const r of dropped) {
        currencies.add(r.currency);
        completed += r.completedApplicationsCount;
        gross = addMinorUnits(gross, r.grossRevenueMinor);
        fees = addMinorUnits(fees, r.gatewayFeesMinor);
        refunded = addMinorUnits(refunded, r.refundedMinor);
        commission = addMinorUnits(commission, r.partnerCommissionMinor);
      }
      const currency = currencies.size === 1 ? [...currencies][0]! : "MIX";
      const totalCosts = addMinorUnits(addMinorUnits(fees, refunded), commission);
      const net = subtractMinorUnits(gross, totalCosts, true);
      return {
        serviceCode: otherLabel,
        currency,
        completedApplicationsCount: completed,
        grossRevenueMinor: gross,
        gatewayFeesMinor: fees,
        refundedMinor: refunded,
        partnerCommissionMinor: commission,
        netContributionMinor: net,
        netMarginBps: computeBasisPoints(net, gross),
        revenuePerCompletedMinor: divideIntegerHalfUp(gross, completed),
        netContributionPerCompletedMinor: divideIntegerHalfUp(net, completed),
        formattedNetContribution:
          currency === "MIX" ? String(net) : formatMinorUnits(net, currency),
      };
    },
    { maxGroups: options.maxGroups ?? 100 },
  );

  return {
    tenantId: query.tenantId,
    rows: capped.rows,
    untrackedServicePaymentEventsCount,
    truncatedGroupCount: capped.truncatedGroupCount,
  };
}
