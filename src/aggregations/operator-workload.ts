import type { AnyAnalyticsEvent, OperatorActionType } from "../contracts/events.js";
import type { AuthorizedTenantQuery } from "../privacy/tenant-boundary.js";
import { capCardinality } from "../reliability/index.js";
import { computeBasisPoints } from "../utils/money.js";
import {
  mergeDurationSummaries,
  prepareWindowEvents,
  summarizeDurations,
  type DurationSummary,
} from "./math.js";

export interface OperatorWorkloadRow {
  readonly operatorRef: string;
  readonly totalActions: number;
  readonly actionsByType: Readonly<Partial<Record<OperatorActionType, number>>>;
  readonly approvalDecisionRateBps: number | null;
  readonly escalationRateBps: number | null;
  readonly distinctQueuesCount: number;
  readonly actionDuration: DurationSummary;
}

export interface QueueWorkloadSummary {
  readonly queueCode: string;
  readonly totalActions: number;
  readonly distinctOperatorsCount: number;
  readonly escalationsCount: number;
  readonly actionDuration: DurationSummary;
}

export interface OperatorWorkloadReport {
  readonly tenantId: string;
  readonly totalActionsRecorded: number;
  readonly operators: readonly OperatorWorkloadRow[];
  readonly truncatedOperatorCount: number;
  readonly byQueue: readonly QueueWorkloadSummary[];
}

interface OperatorAccumulator {
  totalActions: number;
  actionsByType: Partial<Record<OperatorActionType, number>>;
  queues: Set<string>;
  durationsMs: number[];
}

interface QueueAccumulator {
  totalActions: number;
  operators: Set<string>;
  escalationsCount: number;
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
  const byQueueMap = new Map<string, QueueAccumulator>();
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
      let qAcc = byQueueMap.get(ev.payload.queueCode);
      if (!qAcc) {
        qAcc = {
          totalActions: 0,
          operators: new Set<string>(),
          escalationsCount: 0,
          durationsMs: [],
        };
        byQueueMap.set(ev.payload.queueCode, qAcc);
      }
      qAcc.totalActions++;
      qAcc.operators.add(ev.payload.operatorRef);
      if (ev.payload.actionType === "escalated") qAcc.escalationsCount++;
      if (ev.payload.durationMs !== undefined) qAcc.durationsMs.push(ev.payload.durationMs);
    }
    if (ev.payload.durationMs !== undefined) {
      acc.durationsMs.push(ev.payload.durationMs);
    }
  }

  const allRows: OperatorWorkloadRow[] = [...byOperator.entries()].map(
    ([operatorRef, acc]) => {
      const approved = acc.actionsByType.approved ?? 0;
      const rejected = acc.actionsByType.rejected ?? 0;
      const escalated = acc.actionsByType.escalated ?? 0;
      return {
        operatorRef,
        totalActions: acc.totalActions,
        actionsByType: acc.actionsByType,
        approvalDecisionRateBps: computeBasisPoints(approved, approved + rejected),
        escalationRateBps: computeBasisPoints(escalated, acc.totalActions),
        distinctQueuesCount: acc.queues.size,
        actionDuration: summarizeDurations(acc.durationsMs),
      };
    },
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
      const approved = mergedActions.approved ?? 0;
      const rejected = mergedActions.rejected ?? 0;
      const escalated = mergedActions.escalated ?? 0;
      return {
        operatorRef: otherLabel,
        totalActions,
        actionsByType: mergedActions,
        approvalDecisionRateBps: computeBasisPoints(approved, approved + rejected),
        escalationRateBps: computeBasisPoints(escalated, totalActions),
        distinctQueuesCount: 0,
        actionDuration: mergeDurationSummaries(dropped.map((d) => d.actionDuration)),
      };
    },
    { maxGroups: options.maxOperators ?? 100 },
  );

  const byQueue: QueueWorkloadSummary[] = [...byQueueMap.entries()]
    .map(([queueCode, q]) => ({
      queueCode,
      totalActions: q.totalActions,
      distinctOperatorsCount: q.operators.size,
      escalationsCount: q.escalationsCount,
      actionDuration: summarizeDurations(q.durationsMs),
    }))
    .sort((a, b) => b.totalActions - a.totalActions || a.queueCode.localeCompare(b.queueCode));

  return {
    tenantId: query.tenantId,
    totalActionsRecorded,
    operators: capped.rows,
    truncatedOperatorCount: capped.truncatedGroupCount,
    byQueue,
  };
}
