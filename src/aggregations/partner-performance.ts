import type { AnyAnalyticsEvent } from "../contracts/events.js";
import type { AuthorizedTenantQuery } from "../privacy/tenant-boundary.js";
import { capCardinality } from "../reliability/index.js";
import { addMinorUnits, assertValidCurrencyCode, computeBasisPoints } from "../utils/money.js";
import {
  mergeDurationSummaries,
  prepareWindowEvents,
  summarizeDurations,
  type DurationSummary,
} from "./math.js";

export interface PartnerPerformanceRow {
  readonly partnerRef: string;
  readonly assignedCount: number;
  readonly autoAssignedCount: number;
  readonly manualAssignedCount: number;
  readonly workCompletedCount: number;
  readonly workReturnedCount: number;
  readonly workReassignedCount: number;
  readonly completionRateBps: number | null;
  readonly turnaround: DurationSummary;
  readonly commissionsByCurrencyMinor: Readonly<Record<string, number>>;
}

export interface PartnerPerformanceReport {
  readonly tenantId: string;
  readonly partners: readonly PartnerPerformanceRow[];
  readonly truncatedPartnerCount: number;
}

interface PartnerAccumulator {
  assignedCount: number;
  autoAssignedCount: number;
  manualAssignedCount: number;
  workCompletedCount: number;
  workReturnedCount: number;
  workReassignedCount: number;
  durationsMs: number[];
  commissionsByCurrency: Map<string, number>;
}

export function aggregatePartnerPerformance(
  rawEvents: readonly AnyAnalyticsEvent[],
  query: AuthorizedTenantQuery,
  options: {
    readonly partnerFilter?: ReadonlySet<string>;
    readonly serviceFilter?: ReadonlySet<string>;
    readonly maxPartners?: number;
  } = {},
): PartnerPerformanceReport {
  const { events } = prepareWindowEvents(rawEvents, query);
  const byPartner = new Map<string, PartnerAccumulator>();

  function getAcc(partnerRef: string): PartnerAccumulator {
    let acc = byPartner.get(partnerRef);
    if (!acc) {
      acc = {
        assignedCount: 0,
        autoAssignedCount: 0,
        manualAssignedCount: 0,
        workCompletedCount: 0,
        workReturnedCount: 0,
        workReassignedCount: 0,
        durationsMs: [],
        commissionsByCurrency: new Map<string, number>(),
      };
      byPartner.set(partnerRef, acc);
    }
    return acc;
  }

  for (const ev of events) {
    if (ev.eventType === "partner.assigned") {
      if (options.partnerFilter && !options.partnerFilter.has(ev.payload.partnerRef)) continue;
      if (options.serviceFilter && !options.serviceFilter.has(ev.payload.serviceCode)) continue;
      const acc = getAcc(ev.payload.partnerRef);
      acc.assignedCount++;
      if (ev.payload.assignmentType === "auto") acc.autoAssignedCount++;
      else acc.manualAssignedCount++;
    } else if (ev.eventType === "partner.completed_work") {
      if (options.partnerFilter && !options.partnerFilter.has(ev.payload.partnerRef)) continue;
      if (options.serviceFilter && !options.serviceFilter.has(ev.payload.serviceCode)) continue;
      const acc = getAcc(ev.payload.partnerRef);
      if (ev.payload.outcome === "completed") acc.workCompletedCount++;
      else if (ev.payload.outcome === "returned") acc.workReturnedCount++;
      else acc.workReassignedCount++;
      acc.durationsMs.push(ev.payload.durationMs);

      if (ev.payload.commissionMinor !== undefined && ev.payload.currency !== undefined) {
        const cur = assertValidCurrencyCode(ev.payload.currency);
        acc.commissionsByCurrency.set(
          cur,
          addMinorUnits(acc.commissionsByCurrency.get(cur) ?? 0, ev.payload.commissionMinor),
        );
      }
    }
  }

  const allRows: PartnerPerformanceRow[] = [...byPartner.entries()].map(
    ([partnerRef, acc]) => {
      const commissionsObj: Record<string, number> = {};
      for (const [cur, amt] of [...acc.commissionsByCurrency.entries()].sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        commissionsObj[cur] = amt;
      }
      const totalOutcomes =
        acc.workCompletedCount + acc.workReturnedCount + acc.workReassignedCount;
      const denominator = acc.assignedCount > 0 ? acc.assignedCount : totalOutcomes;

      return {
        partnerRef,
        assignedCount: acc.assignedCount,
        autoAssignedCount: acc.autoAssignedCount,
        manualAssignedCount: acc.manualAssignedCount,
        workCompletedCount: acc.workCompletedCount,
        workReturnedCount: acc.workReturnedCount,
        workReassignedCount: acc.workReassignedCount,
        completionRateBps: computeBasisPoints(acc.workCompletedCount, denominator),
        turnaround: summarizeDurations(acc.durationsMs),
        commissionsByCurrencyMinor: commissionsObj,
      };
    },
  );

  const capped = capCardinality(
    allRows,
    (r) => r.assignedCount + r.workCompletedCount + r.workReturnedCount + r.workReassignedCount,
    (r) => r.partnerRef,
    (otherLabel, dropped) => {
      let assignedCount = 0;
      let autoAssignedCount = 0;
      let manualAssignedCount = 0;
      let workCompletedCount = 0;
      let workReturnedCount = 0;
      let workReassignedCount = 0;
      const commissions = new Map<string, number>();

      for (const r of dropped) {
        assignedCount += r.assignedCount;
        autoAssignedCount += r.autoAssignedCount;
        manualAssignedCount += r.manualAssignedCount;
        workCompletedCount += r.workCompletedCount;
        workReturnedCount += r.workReturnedCount;
        workReassignedCount += r.workReassignedCount;
        for (const [cur, amt] of Object.entries(r.commissionsByCurrencyMinor)) {
          commissions.set(cur, addMinorUnits(commissions.get(cur) ?? 0, amt));
        }
      }

      const commissionsObj: Record<string, number> = {};
      for (const [cur, amt] of [...commissions.entries()].sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        commissionsObj[cur] = amt;
      }

      const denom =
        assignedCount > 0
          ? assignedCount
          : workCompletedCount + workReturnedCount + workReassignedCount;

      return {
        partnerRef: otherLabel,
        assignedCount,
        autoAssignedCount,
        manualAssignedCount,
        workCompletedCount,
        workReturnedCount,
        workReassignedCount,
        completionRateBps: computeBasisPoints(workCompletedCount, denom),
        turnaround: mergeDurationSummaries(dropped.map((d) => d.turnaround)),
        commissionsByCurrencyMinor: commissionsObj,
      };
    },
    { maxGroups: options.maxPartners ?? 100 },
  );

  return {
    tenantId: query.tenantId,
    partners: capped.rows,
    truncatedPartnerCount: capped.truncatedGroupCount,
  };
}
