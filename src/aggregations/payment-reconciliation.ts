import type { AnyAnalyticsEvent } from "../contracts/events.js";
import type { AuthorizedTenantQuery } from "../privacy/tenant-boundary.js";
import {
  addMinorUnits,
  assertValidCurrencyCode,
  computeBasisPoints,
  subtractMinorUnits,
} from "../utils/money.js";
import { prepareWindowEvents } from "./math.js";

export interface CurrencyReconciliationSummary {
  readonly currency: string;
  readonly settledGrossMinor: number;
  readonly settledFeesMinor: number;
  readonly settledNetMinor: number;
  readonly refundedMinor: number;
  readonly reconciledNetMinor: number;
  readonly unsettledInitiatedMinor: number;
  readonly failedMinor: number;
}

export interface PaymentReconciliationReport {
  readonly tenantId: string;
  readonly trackedPaymentRefsCount: number;
  readonly untrackedPaymentEventsCount: number;
  readonly settledCount: number;
  readonly failedOnlyCount: number;
  readonly unsettledInitiatedCount: number;
  readonly orphanedRefundCount: number;
  readonly overRefundedCount: number;
  readonly currencyDiscrepancyCount: number;
  readonly settlementRateBps: number | null;
  readonly byCurrency: readonly CurrencyReconciliationSummary[];
}

interface PaymentLedger {
  currencies: Set<string>;
  initiatedCount: number;
  initiatedAmountMinor: number;
  succeededCount: number;
  succeededGrossMinor: number;
  succeededFeesMinor: number;
  succeededNetMinor: number;
  failedCount: number;
  failedAmountMinor: number;
  refundedCount: number;
  refundedMinor: number;
}

export function aggregatePaymentReconciliation(
  rawEvents: readonly AnyAnalyticsEvent[],
  query: AuthorizedTenantQuery,
  currencyFilter?: ReadonlySet<string>,
): PaymentReconciliationReport {
  const { events } = prepareWindowEvents(rawEvents, query);
  const byPaymentRef = new Map<string, PaymentLedger>();
  let untrackedPaymentEventsCount = 0;

  function getLedger(paymentRef: string): PaymentLedger {
    let ledger = byPaymentRef.get(paymentRef);
    if (!ledger) {
      ledger = {
        currencies: new Set<string>(),
        initiatedCount: 0,
        initiatedAmountMinor: 0,
        succeededCount: 0,
        succeededGrossMinor: 0,
        succeededFeesMinor: 0,
        succeededNetMinor: 0,
        failedCount: 0,
        failedAmountMinor: 0,
        refundedCount: 0,
        refundedMinor: 0,
      };
      byPaymentRef.set(paymentRef, ledger);
    }
    return ledger;
  }

  for (const ev of events) {
    if (
      ev.eventType !== "payment.initiated" &&
      ev.eventType !== "payment.succeeded" &&
      ev.eventType !== "payment.failed" &&
      ev.eventType !== "payment.refunded"
    ) {
      continue;
    }

    const cur = assertValidCurrencyCode(ev.payload.currency);
    if (currencyFilter && !currencyFilter.has(cur)) continue;

    const paymentRef = ev.references?.paymentRef;
    if (!paymentRef) {
      untrackedPaymentEventsCount++;
      continue;
    }

    const ledger = getLedger(paymentRef);
    ledger.currencies.add(cur);

    if (ev.eventType === "payment.initiated") {
      ledger.initiatedCount++;
      ledger.initiatedAmountMinor = addMinorUnits(
        ledger.initiatedAmountMinor,
        ev.payload.amountMinor,
      );
    } else if (ev.eventType === "payment.succeeded") {
      ledger.succeededCount++;
      ledger.succeededGrossMinor = addMinorUnits(
        ledger.succeededGrossMinor,
        ev.payload.amountMinor,
      );
      const fee = ev.payload.feeMinor ?? 0;
      ledger.succeededFeesMinor = addMinorUnits(ledger.succeededFeesMinor, fee);
      const net =
        ev.payload.netAmountMinor ??
        subtractMinorUnits(ev.payload.amountMinor, fee, false);
      ledger.succeededNetMinor = addMinorUnits(ledger.succeededNetMinor, net);
    } else if (ev.eventType === "payment.failed") {
      ledger.failedCount++;
      ledger.failedAmountMinor = addMinorUnits(
        ledger.failedAmountMinor,
        ev.payload.amountMinor,
      );
    } else if (ev.eventType === "payment.refunded") {
      ledger.refundedCount++;
      ledger.refundedMinor = addMinorUnits(
        ledger.refundedMinor,
        ev.payload.refundAmountMinor,
      );
    }
  }

  let settledCount = 0;
  let failedOnlyCount = 0;
  let unsettledInitiatedCount = 0;
  let orphanedRefundCount = 0;
  let overRefundedCount = 0;
  let currencyDiscrepancyCount = 0;

  const currencyMap = new Map<
    string,
    {
      settledGrossMinor: number;
      settledFeesMinor: number;
      settledNetMinor: number;
      refundedMinor: number;
      unsettledInitiatedMinor: number;
      failedMinor: number;
    }
  >();

  function getCurAcc(cur: string) {
    let acc = currencyMap.get(cur);
    if (!acc) {
      acc = {
        settledGrossMinor: 0,
        settledFeesMinor: 0,
        settledNetMinor: 0,
        refundedMinor: 0,
        unsettledInitiatedMinor: 0,
        failedMinor: 0,
      };
      currencyMap.set(cur, acc);
    }
    return acc;
  }

  for (const ledger of byPaymentRef.values()) {
    if (ledger.currencies.size > 1) {
      currencyDiscrepancyCount++;
      continue;
    }
    const [cur] = [...ledger.currencies];
    if (!cur) continue;
    const acc = getCurAcc(cur);

    if (ledger.succeededCount > 0) {
      settledCount++;
      acc.settledGrossMinor = addMinorUnits(acc.settledGrossMinor, ledger.succeededGrossMinor);
      acc.settledFeesMinor = addMinorUnits(acc.settledFeesMinor, ledger.succeededFeesMinor);
      acc.settledNetMinor = addMinorUnits(acc.settledNetMinor, ledger.succeededNetMinor);
      if (ledger.refundedMinor > ledger.succeededGrossMinor) {
        overRefundedCount++;
      }
      acc.refundedMinor = addMinorUnits(acc.refundedMinor, ledger.refundedMinor);
    } else if (ledger.failedCount > 0) {
      failedOnlyCount++;
      acc.failedMinor = addMinorUnits(acc.failedMinor, ledger.failedAmountMinor);
      if (ledger.refundedCount > 0) {
        orphanedRefundCount++;
      }
    } else if (ledger.initiatedCount > 0) {
      unsettledInitiatedCount++;
      acc.unsettledInitiatedMinor = addMinorUnits(
        acc.unsettledInitiatedMinor,
        ledger.initiatedAmountMinor,
      );
      if (ledger.refundedCount > 0) {
        orphanedRefundCount++;
      }
    } else if (ledger.refundedCount > 0) {
      orphanedRefundCount++;
      acc.refundedMinor = addMinorUnits(acc.refundedMinor, ledger.refundedMinor);
    }
  }

  const byCurrency: CurrencyReconciliationSummary[] = [...currencyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, acc]) => ({
      currency,
      settledGrossMinor: acc.settledGrossMinor,
      settledFeesMinor: acc.settledFeesMinor,
      settledNetMinor: acc.settledNetMinor,
      refundedMinor: acc.refundedMinor,
      reconciledNetMinor: subtractMinorUnits(acc.settledNetMinor, acc.refundedMinor, true),
      unsettledInitiatedMinor: acc.unsettledInitiatedMinor,
      failedMinor: acc.failedMinor,
    }));

  const reconcilableTotal = settledCount + failedOnlyCount + unsettledInitiatedCount;

  return {
    tenantId: query.tenantId,
    trackedPaymentRefsCount: byPaymentRef.size,
    untrackedPaymentEventsCount,
    settledCount,
    failedOnlyCount,
    unsettledInitiatedCount,
    orphanedRefundCount,
    overRefundedCount,
    currencyDiscrepancyCount,
    settlementRateBps: computeBasisPoints(settledCount, reconcilableTotal),
    byCurrency,
  };
}
