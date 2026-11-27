import type { AnyAnalyticsEvent } from "../contracts/events.js";
import type { AuthorizedTenantQuery } from "../privacy/tenant-boundary.js";
import { computeBasisPoints } from "../utils/money.js";
import { prepareWindowEvents } from "./math.js";

export interface StatusDistributionItem {
  readonly status: string;
  readonly applicationCount: number;
  readonly shareBps: number | null;
}

export interface StatusTransitionItem {
  readonly previousStatus: string;
  readonly nextStatus: string;
  readonly transitionCount: number;
}

export interface ApplicationStatusDistribution {
  readonly tenantId: string;
  readonly trackedApplicationsCount: number;
  readonly untrackedStatusEventCount: number;
  readonly currentStatuses: readonly StatusDistributionItem[];
  readonly transitions: readonly StatusTransitionItem[];
}

/**
 * Computes latest application status per `references.applicationRef` using
 * deterministic chronological ordering (handles out-of-order streams), plus
 * transition frequencies.
 */
export function aggregateApplicationStatusDistribution(
  rawEvents: readonly AnyAnalyticsEvent[],
  query: AuthorizedTenantQuery,
  serviceFilter?: ReadonlySet<string>,
): ApplicationStatusDistribution {
  const { events } = prepareWindowEvents(rawEvents, query);

  const latestStatusByApp = new Map<string, string>();
  const transitionCounts = new Map<string, number>();
  let untrackedStatusEventCount = 0;

  for (const ev of events) {
    const appRef = ev.references?.applicationRef;

    if (ev.eventType === "application.submitted") {
      if (serviceFilter && !serviceFilter.has(ev.payload.serviceCode)) continue;
      if (appRef) {
        latestStatusByApp.set(appRef, "submitted");
      } else {
        untrackedStatusEventCount++;
      }
    } else if (ev.eventType === "application.status_changed") {
      if (serviceFilter && !serviceFilter.has(ev.payload.serviceCode)) continue;
      const transKey = `${ev.payload.previousStatus}::${ev.payload.nextStatus}`;
      transitionCounts.set(transKey, (transitionCounts.get(transKey) ?? 0) + 1);
      if (appRef) {
        latestStatusByApp.set(appRef, ev.payload.nextStatus);
      } else {
        untrackedStatusEventCount++;
      }
    } else if (ev.eventType === "application.completed") {
      if (serviceFilter && !serviceFilter.has(ev.payload.serviceCode)) continue;
      if (appRef) {
        latestStatusByApp.set(appRef, ev.payload.finalStatus);
      } else {
        untrackedStatusEventCount++;
      }
    } else if (ev.eventType === "application.cancelled") {
      if (serviceFilter && !serviceFilter.has(ev.payload.serviceCode)) continue;
      if (appRef) {
        latestStatusByApp.set(appRef, "cancelled");
      } else {
        untrackedStatusEventCount++;
      }
    }
  }

  const countsByStatus = new Map<string, number>();
  for (const status of latestStatusByApp.values()) {
    countsByStatus.set(status, (countsByStatus.get(status) ?? 0) + 1);
  }

  const trackedApplicationsCount = latestStatusByApp.size;
  const currentStatuses: StatusDistributionItem[] = [...countsByStatus.entries()]
    .map(([status, applicationCount]) => ({
      status,
      applicationCount,
      shareBps: computeBasisPoints(applicationCount, trackedApplicationsCount),
    }))
    .sort((a, b) => b.applicationCount - a.applicationCount || a.status.localeCompare(b.status));

  const transitions: StatusTransitionItem[] = [...transitionCounts.entries()]
    .map(([key, transitionCount]) => {
      const [previousStatus = "", nextStatus = ""] = key.split("::");
      return { previousStatus, nextStatus, transitionCount };
    })
    .sort(
      (a, b) =>
        b.transitionCount - a.transitionCount ||
        a.previousStatus.localeCompare(b.previousStatus) ||
        a.nextStatus.localeCompare(b.nextStatus),
    );

  return {
    tenantId: query.tenantId,
    trackedApplicationsCount,
    untrackedStatusEventCount,
    currentStatuses,
    transitions,
  };
}
