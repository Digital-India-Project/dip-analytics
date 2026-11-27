import type { AnyAnalyticsEvent } from "../contracts/events.js";
import type { AuthorizedTenantQuery } from "../privacy/tenant-boundary.js";
import { capCardinality } from "../reliability/index.js";
import { addMinorUnits, assertValidCurrencyCode, computeBasisPoints } from "../utils/money.js";
import { prepareWindowEvents, summarizeDurations, type DurationSummary } from "./math.js";

export interface AccountActivityRow {
  readonly accountRef: string;
  readonly totalEvents: number;
  readonly submittedCount: number;
  readonly completedCount: number;
  readonly cancelledCount: number;
  readonly succeededPaymentsCount: number;
  readonly spendByCurrencyMinor: Readonly<Record<string, number>>;
}

export interface AccountActivityReport {
  readonly tenantId: string;
  readonly activeAccountsCount: number;
  readonly repeatAccountsCount: number;
  readonly singleActivityAccountsCount: number;
  readonly repeatAccountRateBps: number | null;
  readonly untrackedAccountEventsCount: number;
  readonly activityCountDistribution: DurationSummary;
  readonly accounts: readonly AccountActivityRow[];
  readonly truncatedAccountCount: number;
}

interface AccountAccumulator {
  totalEvents: number;
  submittedCount: number;
  completedCount: number;
  cancelledCount: number;
  succeededPaymentsCount: number;
  spendByCurrency: Map<string, number>;
}

/**
 * Computes customer/business account activity metrics strictly over opaque
 * `references.accountRef` identifiers (zero PII).
 */
export function aggregateAccountActivity(
  rawEvents: readonly AnyAnalyticsEvent[],
  query: AuthorizedTenantQuery,
  options: { readonly maxAccounts?: number } = {},
): AccountActivityReport {
  const { events } = prepareWindowEvents(rawEvents, query);
  const byAccount = new Map<string, AccountAccumulator>();
  let untrackedAccountEventsCount = 0;

  function getAcc(accountRef: string): AccountAccumulator {
    let acc = byAccount.get(accountRef);
    if (!acc) {
      acc = {
        totalEvents: 0,
        submittedCount: 0,
        completedCount: 0,
        cancelledCount: 0,
        succeededPaymentsCount: 0,
        spendByCurrency: new Map<string, number>(),
      };
      byAccount.set(accountRef, acc);
    }
    return acc;
  }

  for (const ev of events) {
    const accountRef = ev.references?.accountRef;
    if (!accountRef) {
      untrackedAccountEventsCount++;
      continue;
    }

    const acc = getAcc(accountRef);
    acc.totalEvents++;

    switch (ev.eventType) {
      case "application.submitted":
        acc.submittedCount++;
        break;
      case "application.completed":
        acc.completedCount++;
        break;
      case "application.cancelled":
        acc.cancelledCount++;
        break;
      case "payment.succeeded": {
        acc.succeededPaymentsCount++;
        const cur = assertValidCurrencyCode(ev.payload.currency);
        acc.spendByCurrency.set(
          cur,
          addMinorUnits(acc.spendByCurrency.get(cur) ?? 0, ev.payload.amountMinor),
        );
        break;
      }
      default:
        break;
    }
  }

  let repeatAccountsCount = 0;
  let singleActivityAccountsCount = 0;
  const activityCounts: number[] = [];

  const allRows: AccountActivityRow[] = [...byAccount.entries()].map(
    ([accountRef, acc]) => {
      if (acc.submittedCount > 1 || acc.succeededPaymentsCount > 1 || acc.totalEvents > 1) {
        repeatAccountsCount++;
      } else {
        singleActivityAccountsCount++;
      }
      activityCounts.push(acc.totalEvents);

      const spendObj: Record<string, number> = {};
      for (const [cur, amt] of [...acc.spendByCurrency.entries()].sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        spendObj[cur] = amt;
      }

      return {
        accountRef,
        totalEvents: acc.totalEvents,
        submittedCount: acc.submittedCount,
        completedCount: acc.completedCount,
        cancelledCount: acc.cancelledCount,
        succeededPaymentsCount: acc.succeededPaymentsCount,
        spendByCurrencyMinor: spendObj,
      };
    },
  );

  const capped = capCardinality(
    allRows,
    (r) => r.totalEvents,
    (r) => r.accountRef,
    (otherLabel, dropped) => {
      let totalEvents = 0;
      let submittedCount = 0;
      let completedCount = 0;
      let cancelledCount = 0;
      let succeededPaymentsCount = 0;
      const spend = new Map<string, number>();

      for (const r of dropped) {
        totalEvents += r.totalEvents;
        submittedCount += r.submittedCount;
        completedCount += r.completedCount;
        cancelledCount += r.cancelledCount;
        succeededPaymentsCount += r.succeededPaymentsCount;
        for (const [cur, amt] of Object.entries(r.spendByCurrencyMinor)) {
          spend.set(cur, addMinorUnits(spend.get(cur) ?? 0, amt));
        }
      }

      const spendObj: Record<string, number> = {};
      for (const [cur, amt] of [...spend.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        spendObj[cur] = amt;
      }

      return {
        accountRef: otherLabel,
        totalEvents,
        submittedCount,
        completedCount,
        cancelledCount,
        succeededPaymentsCount,
        spendByCurrencyMinor: spendObj,
      };
    },
    { maxGroups: options.maxAccounts ?? 100 },
  );

  const activeAccountsCount = byAccount.size;

  return {
    tenantId: query.tenantId,
    activeAccountsCount,
    repeatAccountsCount,
    singleActivityAccountsCount,
    repeatAccountRateBps: computeBasisPoints(repeatAccountsCount, activeAccountsCount),
    untrackedAccountEventsCount,
    activityCountDistribution: summarizeDurations(activityCounts),
    accounts: capped.rows,
    truncatedAccountCount: capped.truncatedGroupCount,
  };
}
