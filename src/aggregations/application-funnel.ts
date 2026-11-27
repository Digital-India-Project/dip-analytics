import type { ApplicationChannel, AnyAnalyticsEvent } from "../contracts/events.js";
import type { AuthorizedTenantQuery } from "../privacy/tenant-boundary.js";
import { computeBasisPoints } from "../utils/money.js";
import { prepareWindowEvents } from "./math.js";

export interface ChannelFunnelBreakdown {
  readonly channel: ApplicationChannel;
  readonly submittedCount: number;
}

export interface ApplicationFunnelSummary {
  readonly tenantId: string;
  readonly submittedCount: number;
  readonly inProgressTouchedCount: number;
  readonly completedCount: number;
  readonly approvedCount: number;
  readonly rejectedCount: number;
  readonly cancelledCount: number;
  readonly completionRateBps: number | null;
  readonly approvalRateOfCompletedBps: number | null;
  readonly cancellationRateBps: number | null;
  readonly dropOffBeforeCompletionCount: number;
  readonly byChannel: readonly ChannelFunnelBreakdown[];
  readonly partialData: boolean;
}

export function aggregateApplicationFunnel(
  rawEvents: readonly AnyAnalyticsEvent[],
  query: AuthorizedTenantQuery,
  serviceFilter?: ReadonlySet<string>,
): ApplicationFunnelSummary {
  const { events } = prepareWindowEvents(rawEvents, query);

  let submittedCount = 0;
  let completedCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  let cancelledCount = 0;
  const touchedAppRefs = new Set<string>();
  let statusEventsWithoutRef = 0;

  const channelCounts = new Map<ApplicationChannel, number>();

  for (const ev of events) {
    if (ev.eventType === "application.submitted") {
      if (serviceFilter && !serviceFilter.has(ev.payload.serviceCode)) continue;
      submittedCount++;
      channelCounts.set(ev.payload.channel, (channelCounts.get(ev.payload.channel) ?? 0) + 1);
      if (ev.references?.applicationRef) {
        touchedAppRefs.add(ev.references.applicationRef);
      }
    } else if (ev.eventType === "application.status_changed") {
      if (serviceFilter && !serviceFilter.has(ev.payload.serviceCode)) continue;
      if (ev.references?.applicationRef) {
        touchedAppRefs.add(ev.references.applicationRef);
      } else {
        statusEventsWithoutRef++;
      }
    } else if (ev.eventType === "application.completed") {
      if (serviceFilter && !serviceFilter.has(ev.payload.serviceCode)) continue;
      completedCount++;
      if (ev.payload.finalStatus === "approved") approvedCount++;
      else if (ev.payload.finalStatus === "rejected") rejectedCount++;
    } else if (ev.eventType === "application.cancelled") {
      if (serviceFilter && !serviceFilter.has(ev.payload.serviceCode)) continue;
      cancelledCount++;
    }
  }

  const inProgressTouchedCount = touchedAppRefs.size + statusEventsWithoutRef;
  const terminalCount = completedCount + cancelledCount;
  const dropOffBeforeCompletionCount = Math.max(0, submittedCount - terminalCount);

  // Partial data occurs when completions/cancellations in window exceed submissions in window
  const partialData = terminalCount > submittedCount;

  const byChannel: ChannelFunnelBreakdown[] = [...channelCounts.entries()]
    .map(([channel, count]) => ({ channel, submittedCount: count }))
    .sort((a, b) => b.submittedCount - a.submittedCount || a.channel.localeCompare(b.channel));

  return {
    tenantId: query.tenantId,
    submittedCount,
    inProgressTouchedCount,
    completedCount,
    approvedCount,
    rejectedCount,
    cancelledCount,
    completionRateBps: computeBasisPoints(completedCount, submittedCount),
    approvalRateOfCompletedBps: computeBasisPoints(approvedCount, completedCount),
    cancellationRateBps: computeBasisPoints(cancelledCount, submittedCount),
    dropOffBeforeCompletionCount,
    byChannel,
    partialData,
  };
}
