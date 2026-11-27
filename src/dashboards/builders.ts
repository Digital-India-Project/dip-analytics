import {
  aggregateAccountActivity,
  aggregateApiMetrics,
  aggregateApplicationFunnel,
  aggregateApplicationStatusDistribution,
  aggregateGeographicAnalytics,
  aggregateOperatorWorkload,
  aggregatePartnerPerformance,
  aggregatePaymentMetrics,
  aggregatePaymentReconciliation,
  aggregateProcessingAndSla,
  aggregateRevenueAndRefunds,
  aggregateServicePerformance,
  aggregateTimeSeries,
  prepareWindowEvents,
} from "../aggregations/index.js";
import type { AnyAnalyticsEvent } from "../contracts/events.js";
import type { AuthorizedTenantQuery } from "../privacy/tenant-boundary.js";
import { assertValidTimezone } from "../utils/time.js";
import {
  DASHBOARD_CONTRACT_VERSION,
  type ApiAnalyticsDashboard,
  type ApplicationOperationsDashboard,
  type DashboardBuildOptions,
  type DashboardResponseMetadata,
  type ExecutiveOverviewDashboard,
  type FinanceDashboard,
  type OperatorPerformanceDashboard,
  type PartnerManagementDashboard,
  type ServicePerformanceDashboard,
} from "./contracts.js";

function buildMetadata(
  kind: DashboardResponseMetadata["dashboardKind"],
  query: AuthorizedTenantQuery,
  rawEvents: readonly AnyAnalyticsEvent[],
  options: DashboardBuildOptions,
  extraWarnings: string[] = [],
): DashboardResponseMetadata {
  const timeZone = assertValidTimezone(options.timeZone ?? "UTC");
  const { events, duplicatesRemoved } = prepareWindowEvents(rawEvents, query);
  const warnings = [...extraWarnings];
  if (duplicatesRemoved > 0) {
    warnings.push(`Deduplicated ${duplicatesRemoved} duplicate event(s) during computation.`);
  }
  if (events.length === 0) {
    warnings.push("No events found in the requested window; rate and latency metrics are null.");
  }

  return {
    contractVersion: DASHBOARD_CONTRACT_VERSION,
    dashboardKind: kind,
    tenantId: query.tenantId,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    timeZone,
    window: query.dateRange,
    dataCompleteness: {
      totalWindowEvents: events.length,
      duplicatesRemoved,
      partialData: extraWarnings.length > 0,
      warnings,
    },
  };
}

function toSet(values?: readonly string[]): ReadonlySet<string> | undefined {
  return values && values.length > 0 ? new Set(values) : undefined;
}

export function buildExecutiveOverviewDashboard(
  events: readonly AnyAnalyticsEvent[],
  query: AuthorizedTenantQuery,
  options: DashboardBuildOptions = {},
): ExecutiveOverviewDashboard {
  const serviceFilter = toSet(options.serviceCodes);
  const currencyFilter = toSet(options.currencies);
  const funnel = aggregateApplicationFunnel(events, query, serviceFilter);
  const sla = aggregateProcessingAndSla(events, query, serviceFilter);
  const revenue = aggregateRevenueAndRefunds(
    events,
    query,
    currencyFilter ? { currencyFilter } : {},
  );
  const payments = aggregatePaymentMetrics(events, query, currencyFilter);
  const api = aggregateApiMetrics(events, query, {
    maxEndpoints: options.maxGroups ?? 100,
  });
  const trend = aggregateTimeSeries(events, query, {
    granularity: options.granularity ?? "day",
    timeZone: options.timeZone ?? "UTC",
  });

  const warnings: string[] = [];
  if (funnel.partialData) {
    warnings.push(
      "Terminal application count exceeds submissions in window (in-flight applications from prior window detected).",
    );
  }
  if (revenue.multiCurrencyDetected) {
    warnings.push("Multiple currencies detected; revenue totals remain separated by currency.");
  }

  const accountActivity = aggregateAccountActivity(events, query, {
    maxAccounts: options.maxGroups ?? 100,
  });
  const geographic = aggregateGeographicAnalytics(events, query, {
    maxRegions: options.maxGroups ?? 100,
  });

  return {
    metadata: buildMetadata("executive_overview", query, events, options, warnings),
    tenantId: query.tenantId,
    funnel,
    sla,
    revenue,
    payments,
    apiHealth: {
      totalRequests: api.totalRequests,
      errorRateBps: api.errorRateBps,
      p95LatencyMs: api.overallLatency.p95Ms,
    },
    trend,
    accountActivity,
    geographic,
  };
}

export function buildApplicationOperationsDashboard(
  events: readonly AnyAnalyticsEvent[],
  query: AuthorizedTenantQuery,
  options: DashboardBuildOptions = {},
): ApplicationOperationsDashboard {
  const serviceFilter = toSet(options.serviceCodes);
  const funnel = aggregateApplicationFunnel(events, query, serviceFilter);
  const statusDistribution = aggregateApplicationStatusDistribution(events, query, serviceFilter);
  const processingAndSla = aggregateProcessingAndSla(events, query, serviceFilter);
  const geographic = aggregateGeographicAnalytics(events, query, {
    maxRegions: options.maxGroups ?? 100,
  });
  const trend = aggregateTimeSeries(events, query, {
    granularity: options.granularity ?? "day",
    timeZone: options.timeZone ?? "UTC",
  });

  const warnings: string[] = [];
  if (funnel.partialData) {
    warnings.push("Partial lifecycle data: completions/cancellations exceed submissions in window.");
  }
  if (statusDistribution.untrackedStatusEventCount > 0) {
    warnings.push(
      `${statusDistribution.untrackedStatusEventCount} application lifecycle event(s) lacked references.applicationRef.`,
    );
  }

  return {
    metadata: buildMetadata("application_operations", query, events, options, warnings),
    tenantId: query.tenantId,
    funnel,
    statusDistribution,
    processingAndSla,
    geographic,
    trend,
  };
}

export function buildFinanceDashboard(
  events: readonly AnyAnalyticsEvent[],
  query: AuthorizedTenantQuery,
  options: DashboardBuildOptions = {},
): FinanceDashboard {
  const currencyFilter = toSet(options.currencies);
  const revenueAndRefunds = aggregateRevenueAndRefunds(
    events,
    query,
    currencyFilter ? { currencyFilter } : {},
  );
  const paymentMetrics = aggregatePaymentMetrics(events, query, currencyFilter);
  const reconciliation = aggregatePaymentReconciliation(events, query, currencyFilter);
  const trend = aggregateTimeSeries(events, query, {
    granularity: options.granularity ?? "day",
    timeZone: options.timeZone ?? "UTC",
  });

  const warnings: string[] = [];
  if (revenueAndRefunds.multiCurrencyDetected) {
    warnings.push("Multi-currency financial streams separated by ISO-4217 currency code.");
  }
  if (
    reconciliation.overRefundedCount > 0 ||
    reconciliation.orphanedRefundCount > 0 ||
    reconciliation.currencyDiscrepancyCount > 0
  ) {
    warnings.push("Payment reconciliation discrepancies detected (orphaned/over-refunded/currency mismatch).");
  }

  return {
    metadata: buildMetadata("finance", query, events, options, warnings),
    tenantId: query.tenantId,
    revenueAndRefunds,
    paymentMetrics,
    reconciliation,
    trend,
  };
}

export function buildPartnerManagementDashboard(
  events: readonly AnyAnalyticsEvent[],
  query: AuthorizedTenantQuery,
  options: DashboardBuildOptions = {},
): PartnerManagementDashboard {
  const partnerFilter = toSet(options.partnerRefs);
  const serviceFilter = toSet(options.serviceCodes);
  const partnerPerformance = aggregatePartnerPerformance(events, query, {
    ...(partnerFilter ? { partnerFilter } : {}),
    ...(serviceFilter ? { serviceFilter } : {}),
    maxPartners: options.maxGroups ?? 100,
  });

  const warnings: string[] = [];
  if (partnerPerformance.truncatedPartnerCount > 0) {
    warnings.push(
      `${partnerPerformance.truncatedPartnerCount} low-volume partner(s) rolled into __other__.`,
    );
  }

  return {
    metadata: buildMetadata("partner_management", query, events, options, warnings),
    tenantId: query.tenantId,
    partnerPerformance,
  };
}

export function buildOperatorPerformanceDashboard(
  events: readonly AnyAnalyticsEvent[],
  query: AuthorizedTenantQuery,
  options: DashboardBuildOptions = {},
): OperatorPerformanceDashboard {
  const serviceFilter = toSet(options.serviceCodes);
  const operatorWorkload = aggregateOperatorWorkload(events, query, {
    ...(serviceFilter ? { serviceFilter } : {}),
    maxOperators: options.maxGroups ?? 100,
  });
  const processingAndSla = aggregateProcessingAndSla(events, query, serviceFilter);

  const warnings: string[] = [];
  if (operatorWorkload.truncatedOperatorCount > 0) {
    warnings.push(
      `${operatorWorkload.truncatedOperatorCount} low-volume operator(s) rolled into __other__.`,
    );
  }

  return {
    metadata: buildMetadata("operator_performance", query, events, options, warnings),
    tenantId: query.tenantId,
    operatorWorkload,
    processingAndSla,
  };
}

export function buildServicePerformanceDashboard(
  events: readonly AnyAnalyticsEvent[],
  query: AuthorizedTenantQuery,
  options: DashboardBuildOptions = {},
): ServicePerformanceDashboard {
  const serviceFilter = toSet(options.serviceCodes);
  const servicePerformance = aggregateServicePerformance(events, query, {
    ...(serviceFilter ? { serviceFilter } : {}),
    maxServices: options.maxGroups ?? 100,
  });
  const funnel = aggregateApplicationFunnel(events, query, serviceFilter);

  const warnings: string[] = [];
  if (servicePerformance.truncatedServiceCount > 0) {
    warnings.push(
      `${servicePerformance.truncatedServiceCount} low-volume service(s) rolled into __other__.`,
    );
  }

  return {
    metadata: buildMetadata("service_performance", query, events, options, warnings),
    tenantId: query.tenantId,
    servicePerformance,
    funnel,
  };
}

export function buildApiAnalyticsDashboard(
  events: readonly AnyAnalyticsEvent[],
  query: AuthorizedTenantQuery,
  options: DashboardBuildOptions = {},
): ApiAnalyticsDashboard {
  const apiMetrics = aggregateApiMetrics(events, query, {
    maxEndpoints: options.maxGroups ?? 100,
  });
  const trend = aggregateTimeSeries(events, query, {
    granularity: options.granularity ?? "day",
    timeZone: options.timeZone ?? "UTC",
  });

  const warnings: string[] = [];
  if (apiMetrics.truncatedEndpointCount > 0) {
    warnings.push(
      `${apiMetrics.truncatedEndpointCount} low-volume endpoint(s) rolled into __other__.`,
    );
  }

  return {
    metadata: buildMetadata("api_analytics", query, events, options, warnings),
    tenantId: query.tenantId,
    apiMetrics,
    trend,
  };
}
