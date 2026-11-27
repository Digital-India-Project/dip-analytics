import type { AnyAnalyticsEvent, OperatorActionType } from "../contracts/events.js";
import type { AuthorizedTenantQuery } from "../privacy/tenant-boundary.js";
import { capCardinality } from "../reliability/index.js";
import { prepareWindowEvents, summarizeDurations, type DurationSummary } from "./math.js";

export interface OperatorWorkloadRow {
  readonly operatorRef: string;
  readonly totalActions: number;
  readonly actionsByType: Readonly<Partial<Record<OperatorActionType, number>>>;
  readonly distinctQueuesCount: number;
  readonly actionDuration: DurationSummary;
}

export interface OperatorWorkloadReport {
  readonly tenantId: string;
  readonly totalActionsRecorded: number;
  readonly operators: readonly OperatorWorkloadRow[];
  readonly truncatedOperatorCount: number;
}

interface OperatorAccumulator {
  totalActions: number;
  actionsByType: Partial<Record<OperatorActionType, number>>;
  queues: Set<string>;
  durationsMs: number[];
}

export function aggregateOperatorWorkload(
  rawEvents: readonly AnyAnalyticsEvent[],
  query: AuthorizedTenantQuery,
  options: {
    readonly serviceFilter?: ReadonlySet<string>;
    readonly maxOperators?: number;
  } = {},
): OperatorWorkloadReport {
  const { events } = prepareWindowEvents(rawEvents, query);
  const byOperator = new Map<string, OperatorAccumulator>();
  let totalActionsRecorded = 0;

  for (const ev of events) {
    if (ev.eventType !== "operator.action_recorded") continue;
    if (
      options.serviceFilter &&
      (!ev.payload.serviceCode || !options.serviceFilter.has(ev.payload.serviceCode))
    ) {
      continue;
    }

    totalActionsRecorded++;
    let acc = byOperator.get(ev.payload.operatorRef);
    if (!acc) {
      acc = {
        totalActions: 0,
        actionsByType: {},
        queues: new Set<string>(),
        durationsMs: [],
      };
      byOperator.set(ev.payload.operatorRef, acc);
    }

    acc.totalActions++;
    acc.actionsByType[ev.payload.actionType] =
      (acc.actionsByType[ev.payload.actionType] ?? 0) + 1;
    if (ev.payload.queueCode) {
      acc.queues.add(ev.payload.queueCode);
    }
    if (ev.payload.durationMs !== undefined) {
      acc.durationsMs.push(ev.payload.durationMs);
    }
  }

  const allRows: OperatorWorkloadRow[] = [...byOperator.entries()].map(
    ([operatorRef, acc]) => ({
      operatorRef,
      totalActions: acc.totalActions,
      actionsByType: acc.actionsByType,
      distinctQueuesCount: acc.queues.size,
      actionDuration: summarizeDurations(acc.durationsMs),
    }),
  );

  const capped = capCardinality(
    allRows,
    (r) => r.totalActions,
    (r) => r.operatorRef,
    (otherLabel, dropped) => {
      let totalActions = 0;
      const mergedActions: Partial<Record<OperatorActionType, number>> = {};
      for (const r of dropped) {
        totalActions += r.totalActions;
        for (const [k, v] of Object.entries(r.actionsByType) as [OperatorActionType, number][]) {
          mergedActions[k] = (mergedActions[k] ?? 0) + v;
        }
      }
      return {
        operatorRef: otherLabel,
        totalActions,
        actionsByType: mergedActions,
        distinctQueuesCount: 0,
        actionDuration: summarizeDurations([]),
      };
    },
    { maxGroups: options.maxOperators ?? 100 },
  );

  return {
    tenantId: query.tenantId,
    totalActionsRecorded,
    operators: capped.rows,
    truncatedOperatorCount: capped.truncatedGroupCount,
  };
}
