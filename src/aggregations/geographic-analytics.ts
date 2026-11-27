import type { AnyAnalyticsEvent } from "../contracts/events.js";
import type { AuthorizedTenantQuery } from "../privacy/tenant-boundary.js";
import { capCardinality } from "../reliability/index.js";
import { addMinorUnits, assertValidCurrencyCode, computeBasisPoints } from "../utils/money.js";
import { prepareWindowEvents } from "./math.js";

export interface GeographicRegionRow {
  readonly regionCode: string;
  readonly submittedCount: number;
  readonly completedCount: number;
  readonly approvedCount: number;
  readonly rejectedCount: number;
  readonly cancelledCount: number;
  readonly slaBreachCount: number;
  readonly partnerAssignmentsCount: number;
  readonly completionRateBps: number | null;
  readonly approvalRateBps: number | null;
  readonly revenueByCurrencyMinor: Readonly<Record<string, number>>;
}

export interface GeographicAnalyticsReport {
  readonly tenantId: string;
  readonly trackedEventsCount: number;
  readonly unspecifiedRegionCount: number;
  readonly regions: readonly GeographicRegionRow[];
  readonly truncatedRegionCount: number;
}

interface RegionAccumulator {
  submittedCount: number;
  completedCount: number;
  approvedCount: number;
  rejectedCount: number;
  cancelledCount: number;
  slaBreachCount: number;
  partnerAssignmentsCount: number;
  revenueByCurrency: Map<string, number>;
}

function extractRegionCode(ev: AnyAnalyticsEvent): string | undefined {
  if ("regionCode" in ev.payload && typeof ev.payload.regionCode === "string") {
    return ev.payload.regionCode;
  }
  return ev.references?.regionCode;
}

export function aggregateGeographicAnalytics(
  rawEvents: readonly AnyAnalyticsEvent[],
  query: AuthorizedTenantQuery,
  options: { readonly regionFilter?: ReadonlySet<string>; readonly maxRegions?: number } = {},
): GeographicAnalyticsReport {
  const { events } = prepareWindowEvents(rawEvents, query);
  const byRegion = new Map<string, RegionAccumulator>();
  let trackedEventsCount = 0;
  let unspecifiedRegionCount = 0;

  function getAcc(regionCode: string): RegionAccumulator {
    let acc = byRegion.get(regionCode);
    if (!acc) {
      acc = {
        submittedCount: 0,
        completedCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        cancelledCount: 0,
        slaBreachCount: 0,
        partnerAssignmentsCount: 0,
        revenueByCurrency: new Map<string, number>(),
      };
      byRegion.set(regionCode, acc);
    }
    return acc;
  }

  for (const ev of events) {
    const regionCode = extractRegionCode(ev);
    if (!regionCode) {
      unspecifiedRegionCount++;
      continue;
    }
    if (options.regionFilter && !options.regionFilter.has(regionCode)) {
      continue;
    }

    trackedEventsCount++;
    const acc = getAcc(regionCode);

    switch (ev.eventType) {
      case "application.submitted":
        acc.submittedCount++;
        break;
      case "application.completed":
        acc.completedCount++;
        if (ev.payload.finalStatus === "approved") acc.approvedCount++;
        else if (ev.payload.finalStatus === "rejected") acc.rejectedCount++;
        break;
      case "application.cancelled":
        acc.cancelledCount++;
        break;
      case "sla.threshold_breached":
        acc.slaBreachCount++;
        break;
      case "partner.assigned":
        acc.partnerAssignmentsCount++;
        break;
      case "payment.succeeded": {
        const cur = assertValidCurrencyCode(ev.payload.currency);
        acc.revenueByCurrency.set(
          cur,
          addMinorUnits(acc.revenueByCurrency.get(cur) ?? 0, ev.payload.amountMinor),
        );
        break;
      }
      default:
        break;
    }
  }

  const allRows: GeographicRegionRow[] = [...byRegion.entries()].map(
    ([regionCode, acc]) => {
      const revenueObj: Record<string, number> = {};
      for (const [cur, amt] of [...acc.revenueByCurrency.entries()].sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        revenueObj[cur] = amt;
      }
      return {
        regionCode,
        submittedCount: acc.submittedCount,
        completedCount: acc.completedCount,
        approvedCount: acc.approvedCount,
        rejectedCount: acc.rejectedCount,
        cancelledCount: acc.cancelledCount,
        slaBreachCount: acc.slaBreachCount,
        partnerAssignmentsCount: acc.partnerAssignmentsCount,
        completionRateBps: computeBasisPoints(acc.completedCount, acc.submittedCount),
        approvalRateBps: computeBasisPoints(acc.approvedCount, acc.completedCount),
        revenueByCurrencyMinor: revenueObj,
      };
    },
  );

  const capped = capCardinality(
    allRows,
    (r) => r.submittedCount + r.completedCount + r.partnerAssignmentsCount,
    (r) => r.regionCode,
    (otherLabel, dropped) => {
      let submittedCount = 0;
      let completedCount = 0;
      let approvedCount = 0;
      let rejectedCount = 0;
      let cancelledCount = 0;
      let slaBreachCount = 0;
      let partnerAssignmentsCount = 0;
      const rev = new Map<string, number>();

      for (const r of dropped) {
        submittedCount += r.submittedCount;
        completedCount += r.completedCount;
        approvedCount += r.approvedCount;
        rejectedCount += r.rejectedCount;
        cancelledCount += r.cancelledCount;
        slaBreachCount += r.slaBreachCount;
        partnerAssignmentsCount += r.partnerAssignmentsCount;
        for (const [cur, amt] of Object.entries(r.revenueByCurrencyMinor)) {
          rev.set(cur, addMinorUnits(rev.get(cur) ?? 0, amt));
        }
      }

      const revenueObj: Record<string, number> = {};
      for (const [cur, amt] of [...rev.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        revenueObj[cur] = amt;
      }

      return {
        regionCode: otherLabel,
        submittedCount,
        completedCount,
        approvedCount,
        rejectedCount,
        cancelledCount,
        slaBreachCount,
        partnerAssignmentsCount,
        completionRateBps: computeBasisPoints(completedCount, submittedCount),
        approvalRateBps: computeBasisPoints(approvedCount, completedCount),
        revenueByCurrencyMinor: revenueObj,
      };
    },
    { maxGroups: options.maxRegions ?? 100 },
  );

  return {
    tenantId: query.tenantId,
    trackedEventsCount,
    unspecifiedRegionCount,
    regions: capped.rows,
    truncatedRegionCount: capped.truncatedGroupCount,
  };
}
