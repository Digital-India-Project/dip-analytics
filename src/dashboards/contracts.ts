import type {
  ApiMetricsSummary,
  ApplicationFunnelSummary,
  ApplicationStatusDistribution,
  HistoricalTimeSeriesSummary,
  OperatorWorkloadReport,
  PartnerPerformanceReport,
  PaymentMetricsSummary,
  ProcessingAndSlaSummary,
  RevenueAndRefundsReport,
  ServicePerformanceReport,
} from "../aggregations/index.js";
import type { DateRange, TimeGranularity } from "../utils/time.js";

export const DASHBOARD_CONTRACT_VERSION = "1.0.0" as const;

export interface DashboardDataCompleteness {
  readonly totalWindowEvents: number;
  readonly duplicatesRemoved: number;
  readonly partialData: boolean;
  readonly warnings: readonly string[];
}

export interface DashboardResponseMetadata {
  readonly contractVersion: string;
  readonly dashboardKind:
    | "executive_overview"
    | "application_operations"
    | "finance"
    | "partner_management"
    | "operator_performance"
    | "service_performance"
    | "api_analytics";
  readonly tenantId: string;
  readonly generatedAt: string;
  readonly timeZone: string;
  readonly window: DateRange;
  readonly dataCompleteness: DashboardDataCompleteness;
}

export interface ExecutiveOverviewDashboard {
  readonly metadata: DashboardResponseMetadata;
  readonly tenantId: string;
  readonly funnel: ApplicationFunnelSummary;
  readonly sla: ProcessingAndSlaSummary;
  readonly revenue: RevenueAndRefundsReport;
  readonly payments: PaymentMetricsSummary;
  readonly apiHealth: {
    readonly totalRequests: number;
    readonly errorRateBps: number | null;
    readonly p95LatencyMs: number | null;
  };
  readonly trend: HistoricalTimeSeriesSummary;
}

export interface ApplicationOperationsDashboard {
  readonly metadata: DashboardResponseMetadata;
  readonly tenantId: string;
  readonly funnel: ApplicationFunnelSummary;
  readonly statusDistribution: ApplicationStatusDistribution;
  readonly processingAndSla: ProcessingAndSlaSummary;
  readonly trend: HistoricalTimeSeriesSummary;
}

export interface FinanceDashboard {
  readonly metadata: DashboardResponseMetadata;
  readonly tenantId: string;
  readonly revenueAndRefunds: RevenueAndRefundsReport;
  readonly paymentMetrics: PaymentMetricsSummary;
  readonly trend: HistoricalTimeSeriesSummary;
}

export interface PartnerManagementDashboard {
  readonly metadata: DashboardResponseMetadata;
  readonly tenantId: string;
  readonly partnerPerformance: PartnerPerformanceReport;
}

export interface OperatorPerformanceDashboard {
  readonly metadata: DashboardResponseMetadata;
  readonly tenantId: string;
  readonly operatorWorkload: OperatorWorkloadReport;
  readonly processingAndSla: ProcessingAndSlaSummary;
}

export interface ServicePerformanceDashboard {
  readonly metadata: DashboardResponseMetadata;
  readonly tenantId: string;
  readonly servicePerformance: ServicePerformanceReport;
  readonly funnel: ApplicationFunnelSummary;
}

export interface ApiAnalyticsDashboard {
  readonly metadata: DashboardResponseMetadata;
  readonly tenantId: string;
  readonly apiMetrics: ApiMetricsSummary;
  readonly trend: HistoricalTimeSeriesSummary;
}

export interface DashboardBuildOptions {
  readonly timeZone?: string;
  readonly granularity?: TimeGranularity;
  readonly generatedAt?: string;
  readonly serviceCodes?: readonly string[];
  readonly partnerRefs?: readonly string[];
  readonly currencies?: readonly string[];
  readonly maxGroups?: number;
}
