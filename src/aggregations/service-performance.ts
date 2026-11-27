import type { AnyAnalyticsEvent } from "../contracts/events.js";
import type { AuthorizedTenantQuery } from "../privacy/tenant-boundary.js";
import { capCardinality } from "../reliability/index.js";
import { computeBasisPoints } from "../utils/money.js";
import { prepareWindowEvents, summarizeDurations, type DurationSummary } from "./math.js";

export interface ServicePerformanceRow {
  readonly serviceCode: string;
  readonly submittedCount: number;
  readonly completedCount: number;
  readonly approvedCount: number;
  readonly rejectedCount: number;
  readonly cancelledCount: number;
  readonly slaBreachCount: number;
  readonly completionRateBps: number | null;
  readonly approvalRateBps: number | null;
  readonly duration: DurationSummary;
}

export interface ServicePerformanceReport {
  readonly tenantId: string;
  readonly services: readonly ServicePerformanceRow[];
  readonly truncatedServiceCount: number;
}

interface ServiceAccumulator {
  submittedCount: number;
  completedCount: number;
  approvedCount: number;
  rejectedCount: number;
  cancelledCount: number;
  slaBreachCount: number;
  durationsMs: number[];
}

export function aggregateServicePerformance(
  rawEvents: readonly AnyAnalyticsEvent[],
  query: AuthorizedTenantQuery,
  options: { readonly serviceFilter?: ReadonlySet<string>; readonly maxServices?: number } = {},
): ServicePerformanceReport {
  const { events } = prepareWindowEvents(rawEvents, query);
  const byService = new Map<string, ServiceAccumulator>();

  function getAcc(serviceCode: string): ServiceAccumulator {
    let acc = byService.get(serviceCode);
    if (!acc) {
      acc = {
        submittedCount: 0,
        completedCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        cancelledCount: 0,
        slaBreachCount: 0,
        durationsMs: [],
      };
      byService.set(serviceCode, acc);
    }
    return acc;
  }

  for (const ev of events) {
    if (ev.eventType === "application.submitted") {
      if (options.serviceFilter && !options.serviceFilter.has(ev.payload.serviceCode)) continue;
      getAcc(ev.payload.serviceCode).submittedCount++;
    } else if (ev.eventType === "application.completed") {
      if (options.serviceFilter && !options.serviceFilter.has(ev.payload.serviceCode)) continue;
      const acc = getAcc(ev.payload.serviceCode);
      acc.completedCount++;
      if (ev.payload.finalStatus === "approved") acc.approvedCount++;
      else if (ev.payload.finalStatus === "rejected") acc.rejectedCount++;
      acc.durationsMs.push(ev.payload.processingDurationMs);
    } else if (ev.eventType === "application.cancelled") {
      if (options.serviceFilter && !options.serviceFilter.has(ev.payload.serviceCode)) continue;
      getAcc(ev.payload.serviceCode).cancelledCount++;
    } else if (ev.eventType === "sla.threshold_breached") {
      if (options.serviceFilter && !options.serviceFilter.has(ev.payload.serviceCode)) continue;
      getAcc(ev.payload.serviceCode).slaBreachCount++;
    }
  }

  const allRows: ServicePerformanceRow[] = [...byService.entries()].map(
    ([serviceCode, acc]) => ({
      serviceCode,
      submittedCount: acc.submittedCount,
      completedCount: acc.completedCount,
      approvedCount: acc.approvedCount,
      rejectedCount: acc.rejectedCount,
      cancelledCount: acc.cancelledCount,
      slaBreachCount: acc.slaBreachCount,
      completionRateBps: computeBasisPoints(acc.completedCount, acc.submittedCount),
      approvalRateBps: computeBasisPoints(acc.approvedCount, acc.completedCount),
      duration: summarizeDurations(acc.durationsMs),
    }),
  );

  const maxServices = options.maxServices ?? 100;
  const capped = capCardinality(
    allRows,
    (row) => row.submittedCount + row.completedCount,
    (row) => row.serviceCode,
    (otherLabel, dropped) => {
      let submittedCount = 0;
      let completedCount = 0;
      let approvedCount = 0;
      let rejectedCount = 0;
      let cancelledCount = 0;
      let slaBreachCount = 0;
      for (const r of dropped) {
        submittedCount += r.submittedCount;
        completedCount += r.completedCount;
        approvedCount += r.approvedCount;
        rejectedCount += r.rejectedCount;
        cancelledCount += r.cancelledCount;
        slaBreachCount += r.slaBreachCount;
      }
      return {
        serviceCode: otherLabel,
        submittedCount,
        completedCount,
        approvedCount,
        rejectedCount,
        cancelledCount,
        slaBreachCount,
        completionRateBps: computeBasisPoints(completedCount, submittedCount),
        approvalRateBps: computeBasisPoints(approvedCount, completedCount),
        duration: summarizeDurations([]),
      };
    },
    { maxGroups: maxServices },
  );

  return {
    tenantId: query.tenantId,
    services: capped.rows,
    truncatedServiceCount: capped.truncatedGroupCount,
  };
}
