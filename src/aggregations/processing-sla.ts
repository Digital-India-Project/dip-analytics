import type { AnyAnalyticsEvent } from "../contracts/events.js";
import type { AuthorizedTenantQuery } from "../privacy/tenant-boundary.js";
import { computeBasisPoints } from "../utils/money.js";
import { prepareWindowEvents, summarizeDurations, type DurationSummary } from "./math.js";

export interface StageBreachSummary {
  readonly stageCode: string;
  readonly breachCount: number;
  readonly warningCount: number;
  readonly criticalCount: number;
  readonly maxOverrunMs: number;
}

export interface ProcessingAndSlaSummary {
  readonly tenantId: string;
  readonly completedApplicationsCount: number;
  readonly evaluatedAgainstTargetCount: number;
  readonly withinSlaTargetCount: number;
  readonly slaComplianceRateBps: number | null;
  readonly breachEventsTotal: number;
  readonly warningBreaches: number;
  readonly criticalBreaches: number;
  readonly processingDuration: DurationSummary;
  readonly stageBottlenecks: readonly StageBreachSummary[];
}

export function aggregateProcessingAndSla(
  rawEvents: readonly AnyAnalyticsEvent[],
  query: AuthorizedTenantQuery,
  serviceFilter?: ReadonlySet<string>,
): ProcessingAndSlaSummary {
  const { events } = prepareWindowEvents(rawEvents, query);

  const durationsMs: number[] = [];
  let completedApplicationsCount = 0;
  let evaluatedAgainstTargetCount = 0;
  let withinSlaTargetCount = 0;
  let breachEventsTotal = 0;
  let warningBreaches = 0;
  let criticalBreaches = 0;

  const byStage = new Map<
    string,
    { breachCount: number; warningCount: number; criticalCount: number; maxOverrunMs: number }
  >();

  for (const ev of events) {
    if (ev.eventType === "application.completed") {
      if (serviceFilter && !serviceFilter.has(ev.payload.serviceCode)) continue;
      completedApplicationsCount++;
      durationsMs.push(ev.payload.processingDurationMs);
      if (ev.payload.slaTargetMs !== undefined) {
        evaluatedAgainstTargetCount++;
        if (ev.payload.processingDurationMs <= ev.payload.slaTargetMs) {
          withinSlaTargetCount++;
        }
      }
    } else if (ev.eventType === "sla.threshold_breached") {
      if (serviceFilter && !serviceFilter.has(ev.payload.serviceCode)) continue;
      breachEventsTotal++;
      if (ev.payload.severity === "warning") warningBreaches++;
      else criticalBreaches++;

      const overrun = Math.max(0, ev.payload.elapsedMs - ev.payload.thresholdMs);
      const current = byStage.get(ev.payload.stageCode) ?? {
        breachCount: 0,
        warningCount: 0,
        criticalCount: 0,
        maxOverrunMs: 0,
      };
      current.breachCount++;
      if (ev.payload.severity === "warning") current.warningCount++;
      else current.criticalCount++;
      if (overrun > current.maxOverrunMs) current.maxOverrunMs = overrun;
      byStage.set(ev.payload.stageCode, current);
    }
  }

  const stageBottlenecks: StageBreachSummary[] = [...byStage.entries()]
    .map(([stageCode, stats]) => ({
      stageCode,
      ...stats,
    }))
    .sort((a, b) => b.breachCount - a.breachCount || a.stageCode.localeCompare(b.stageCode));

  return {
    tenantId: query.tenantId,
    completedApplicationsCount,
    evaluatedAgainstTargetCount,
    withinSlaTargetCount,
    slaComplianceRateBps: computeBasisPoints(withinSlaTargetCount, evaluatedAgainstTargetCount),
    breachEventsTotal,
    warningBreaches,
    criticalBreaches,
    processingDuration: summarizeDurations(durationsMs),
    stageBottlenecks,
  };
}
