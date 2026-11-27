type ViewKey =
  | "executive"
  | "operations"
  | "finance"
  | "entities"
  | "api"
  | "export"
  | "governance";

interface DurationSummary {
  readonly sampleCount: number;
  readonly minMs: number | null;
  readonly maxMs: number | null;
  readonly avgMs: number | null;
  readonly p50Ms: number | null;
  readonly p90Ms: number | null;
  readonly p95Ms: number | null;
  readonly p99Ms: number | null;
}

interface TimeSeriesBucket {
  readonly bucketKey: string;
  readonly totalEvents: number;
  readonly applicationsSubmitted: number;
  readonly applicationsCompleted: number;
  readonly applicationsApproved: number;
  readonly applicationsCancelled: number;
  readonly slaBreaches: number;
  readonly apiRequests: number;
  readonly apiErrorRateBps: number | null;
  readonly revenueByCurrencyMinor: Record<string, number>;
}

interface CurrencyFinancialRow {
  readonly currency: string;
  readonly succeededPaymentsCount: number;
  readonly refundsCount: number;
  readonly grossRevenueMinor: number;
  readonly totalFeesMinor: number;
  readonly netRevenueBeforeRefundsMinor: number;
  readonly totalRefundedMinor: number;
  readonly netRevenueAfterRefundsMinor: number;
  readonly refundRateBps: number | null;
  readonly formattedGrossRevenue: string;
  readonly formattedTotalRefunded: string;
  readonly formattedNetRevenueAfterRefunds: string;
}

interface SlaSummary {
  readonly completedApplicationsCount: number;
  readonly evaluatedAgainstTargetCount: number;
  readonly withinSlaTargetCount: number;
  readonly slaComplianceRateBps: number | null;
  readonly warningBreaches: number;
  readonly criticalBreaches: number;
  readonly processingDuration: DurationSummary;
  readonly stageBottlenecks: readonly {
    readonly stageCode: string;
    readonly breachCount: number;
    readonly warningCount: number;
    readonly criticalCount: number;
    readonly maxOverrunMs: number;
  }[];
}

interface WorkbenchOverviewResponse {
  readonly activeProfile: {
    readonly tenantId: string;
    readonly label: string;
    readonly defaultTimeZone: string;
    readonly windowFrom: string;
    readonly windowTo: string;
    readonly asOfIso: string;
  };
  readonly dashboards: {
    readonly executive: {
      readonly metadata: {
        readonly tenantId: string;
        readonly timeZone: string;
        readonly window: { readonly from: string; readonly to: string };
        readonly dataCompleteness: {
          readonly totalWindowEvents: number;
          readonly duplicatesRemoved: number;
          readonly warnings: readonly string[];
        };
      };
      readonly funnel: {
        readonly submittedCount: number;
        readonly inProgressTouchedCount: number;
        readonly completedCount: number;
        readonly approvedCount: number;
        readonly rejectedCount: number;
        readonly cancelledCount: number;
        readonly completionRateBps: number | null;
        readonly approvalRateOfCompletedBps: number | null;
      };
      readonly sla: SlaSummary;
      readonly revenue: {
        readonly byCurrency: readonly CurrencyFinancialRow[];
        readonly multiCurrencyDetected: boolean;
      };
      readonly apiHealth: {
        readonly totalRequests: number;
        readonly errorRateBps: number | null;
        readonly p95LatencyMs: number | null;
      };
      readonly trend: {
        readonly buckets: readonly TimeSeriesBucket[];
      };
      readonly accountActivity: {
        readonly activeAccountsCount: number;
        readonly repeatAccountsCount: number;
        readonly repeatAccountRateBps: number | null;
      };
      readonly geographic: {
        readonly regions: readonly {
          readonly regionCode: string;
          readonly submittedCount: number;
          readonly completedCount: number;
          readonly approvedCount: number;
          readonly cancelledCount: number;
          readonly slaBreachCount: number;
          readonly completionRateBps: number | null;
          readonly revenueByCurrencyMinor: Record<string, number>;
        }[];
      };
    };
    readonly operations: {
      readonly statusDistribution: {
        readonly trackedApplicationsCount: number;
        readonly currentStatuses: readonly {
          readonly status: string;
          readonly applicationCount: number;
          readonly shareBps: number;
        }[];
      };
    };
    readonly finance: {
      readonly revenueAndRefunds: {
        readonly byCurrency: readonly CurrencyFinancialRow[];
        readonly multiCurrencyDetected: boolean;
      };
      readonly paymentMetrics: {
        readonly initiatedCount: number;
        readonly succeededCount: number;
        readonly failedCount: number;
        readonly refundedCount: number;
        readonly successRateBps: number | null;
        readonly byMethod: readonly {
          readonly paymentMethodCategory: string;
          readonly initiatedCount: number;
          readonly succeededCount: number;
          readonly failedCount: number;
          readonly successRateBps: number | null;
        }[];
      };
      readonly reconciliation: {
        readonly trackedPaymentRefsCount: number;
        readonly settledCount: number;
        readonly failedOnlyCount: number;
        readonly unsettledInitiatedCount: number;
        readonly orphanedRefundCount: number;
        readonly overRefundedCount: number;
        readonly currencyDiscrepancyCount: number;
        readonly byCurrency: readonly {
          readonly currency: string;
          readonly settledGrossMinor: number;
          readonly refundedMinor: number;
          readonly reconciledNetMinor: number;
        }[];
      };
    };
    readonly partners: {
      readonly partnerPerformance: {
        readonly partners: readonly {
          readonly partnerRef: string;
          readonly assignedCount: number;
          readonly workCompletedCount: number;
          readonly workReturnedCount: number;
          readonly completionRateBps: number | null;
          readonly turnaround: DurationSummary;
          readonly commissionsByCurrencyMinor: Record<string, number>;
        }[];
      };
    };
    readonly operators: {
      readonly operatorWorkload: {
        readonly operators: readonly {
          readonly operatorRef: string;
          readonly totalActions: number;
          readonly distinctQueuesCount: number;
          readonly approvalDecisionRateBps: number | null;
          readonly escalationRateBps: number | null;
          readonly actionDuration: DurationSummary;
        }[];
        readonly byQueue: readonly {
          readonly queueCode: string;
          readonly totalActions: number;
          readonly distinctOperatorsCount: number;
          readonly actionDuration: DurationSummary;
        }[];
      };
    };
    readonly services: {
      readonly servicePerformance: {
        readonly services: readonly {
          readonly serviceCode: string;
          readonly submittedCount: number;
          readonly completedCount: number;
          readonly approvedCount: number;
          readonly cancelledCount: number;
          readonly slaBreachCount: number;
          readonly completionRateBps: number | null;
          readonly duration: DurationSummary;
        }[];
      };
    };
    readonly apiAnalytics: {
      readonly apiMetrics: {
        readonly totalRequests: number;
        readonly status2xxCount: number;
        readonly status4xxCount: number;
        readonly status5xxCount: number;
        readonly errorRateBps: number | null;
        readonly serverErrorRateBps: number | null;
        readonly overallLatency: DurationSummary;
        readonly endpoints: readonly {
          readonly routeKey: string;
          readonly requestCount: number;
          readonly errorRateBps: number | null;
          readonly latency: DurationSummary;
        }[];
      };
    };
  };
  readonly advanced: {
    readonly unitEconomics: {
      readonly rows: readonly {
        readonly serviceCode: string;
        readonly currency: string;
        readonly completedApplicationsCount: number;
        readonly grossRevenueMinor: number;
        readonly gatewayFeesMinor: number;
        readonly refundedMinor: number;
        readonly partnerCommissionMinor: number;
        readonly netContributionMinor: number;
        readonly netMarginBps: number | null;
        readonly formattedNetContribution: string;
      }[];
    };
    readonly backlogAging: {
      readonly openApplicationsCount: number;
      readonly oldestOpenAgeMs: number | null;
      readonly buckets: Record<"under_1h" | "from_1h_to_24h" | "from_1d_to_7d" | "over_7d", number>;
      readonly byService: readonly {
        readonly serviceCode: string;
        readonly openCount: number;
        readonly oldestOpenAgeMs: number;
      }[];
    };
    readonly cohortRetention: {
      readonly trackedAccountsCount: number;
      readonly cohorts: readonly {
        readonly cohortBucket: string;
        readonly cohortSize: number;
        readonly periods: readonly {
          readonly periodOffset: number;
          readonly activeAccountsCount: number;
          readonly retentionRateBps: number | null;
        }[];
      }[];
    };
    readonly customFunnel: {
      readonly stages: readonly {
        readonly stage: string;
        readonly reachedCount: number;
        readonly conversionFromStartBps: number | null;
        readonly conversionFromPreviousBps: number | null;
      }[];
    };
    readonly anomalies: {
      readonly evaluatedBucketsCount: number;
      readonly alerts: readonly {
        readonly metric: string;
        readonly bucketKey: string;
        readonly observedValue: number;
        readonly baselineMean: number;
        readonly deviationBps: number | null;
        readonly severity: "warning" | "critical";
        readonly reason: string;
      }[];
    };
  };
}

interface ExportPreviewResponse {
  readonly format: "csv" | "ndjson" | "json";
  readonly dataset: string;
  readonly rowCount: number;
  readonly suppressedRowCount: number;
  readonly content: string;
}

interface ExportDispatchEntry {
  readonly id: string;
  readonly dataset: string;
  readonly format: string;
  readonly rowCount: number;
  readonly suppressedRowCount: number;
  readonly timestamp: string;
}

const DIP_CHART_VARS = [
  "var(--dip-chart-1)",
  "var(--dip-chart-2)",
  "var(--dip-chart-3)",
  "var(--dip-chart-4)",
  "var(--dip-chart-5)",
  "var(--dip-chart-6)",
  "var(--dip-chart-7)",
  "var(--dip-chart-8)",
] as const;

const VIEW_TITLES: Record<ViewKey, string> = {
  executive: "Executive Overview",
  operations: "Operations & Backlog",
  finance: "Finance & Unit Economics",
  entities: "Partners, Operators & Services",
  api: "API Health & Anomalies",
  export: "Export & K-Anonymity Studio",
  governance: "Privacy, Tenant & Schemas",
};

interface SavedReportPreset {
  readonly id: string;
  readonly label: string;
  readonly dataset: "regions" | "services" | "unit_economics";
  readonly format: "csv" | "ndjson" | "json";
  readonly minCount: number;
  readonly mode: "suppress" | "rollup_other";
}

const SAVED_REPORT_PRESETS: readonly SavedReportPreset[] = [
  {
    id: "preset_region_kanon",
    label: "Regional K-Anonymity (min 5)",
    dataset: "regions",
    format: "csv",
    minCount: 5,
    mode: "suppress",
  },
  {
    id: "preset_region_rollup",
    label: "Regional Rollup (__suppressed__)",
    dataset: "regions",
    format: "ndjson",
    minCount: 5,
    mode: "rollup_other",
  },
  {
    id: "preset_unit_econ_csv",
    label: "Service Unit Economics CSV",
    dataset: "unit_economics",
    format: "csv",
    minCount: 0,
    mode: "suppress",
  },
  {
    id: "preset_services_json",
    label: "Service Performance Envelope",
    dataset: "services",
    format: "json",
    minCount: 0,
    mode: "suppress",
  },
];

interface AppState {
  activeView: ViewKey;
  sidebarCollapsed: boolean;
  tenantId: string;
  timeZone: string;
  granularity: "day" | "week";
  serviceCode: string;
  currency: string;
  entitiesTab: "partners" | "operators" | "services";
  entitiesSearch: string;
  hiddenTrendSeries: Set<string>;
  hiddenDonutIds: Set<string>;
  financeMethodFilter: string;
  exportDataset: "regions" | "services" | "unit_economics";
  exportFormat: "csv" | "ndjson" | "json";
  exportMinCount: number;
  exportMode: "suppress" | "rollup_other";
  exportPreview: ExportPreviewResponse | null;
  exportLog: ExportDispatchEntry[];
  overview: WorkbenchOverviewResponse | null;
  loading: boolean;
  errorMessage: string | null;
  validatorInput: string;
  validatorPolicy: "reject" | "strip_and_audit";
  validatorResult: string | null;
  boundaryRequestedTenant: string;
  boundaryResult: string | null;
  contractCatalogJson: string | null;
  darkMode: boolean;
}

const PRESET_EVENTS: Record<string, Record<string, unknown>> = {
  valid: {
    eventId: "evt_ui_valid_001",
    eventType: "application.submitted",
    schemaVersion: "1.0.0",
    eventTimestamp: "2026-10-15T12:00:00.000Z",
    tenantId: "tenant_alpha",
    sourceService: "dipindia",
    correlationId: "corr_ui_001",
    references: { applicationRef: "app_ui_001", regionCode: "IN-DL" },
    payload: { serviceCode: "SVC_PASSPORT_RENEWAL", channel: "web", regionCode: "IN-DL" },
  },
  pii_aadhaar: {
    eventId: "evt_ui_pii_002",
    eventType: "application.submitted",
    schemaVersion: "1.0.0",
    eventTimestamp: "2026-10-15T12:00:00.000Z",
    tenantId: "tenant_alpha",
    sourceService: "dipindia",
    correlationId: "corr_ui_002",
    payload: {
      serviceCode: "SVC_PASSPORT_RENEWAL",
      channel: "web",
      citizenEmail: "resident@example.in",
      aadhaarNumber: "2345 6789 0123",
    },
  },
  document_uri: {
    eventId: "evt_ui_doc_003",
    eventType: "application.submitted",
    schemaVersion: "1.0.0",
    eventTimestamp: "2026-10-15T12:00:00.000Z",
    tenantId: "tenant_alpha",
    sourceService: "dipindia",
    correlationId: "corr_ui_003",
    payload: {
      serviceCode: "SVC_BIRTH_CERT",
      channel: "mobile",
      uploadedDocument: "data:application/pdf;base64,JVBERi0xLjQK...",
    },
  },
  unknown_safe: {
    eventId: "evt_ui_strip_004",
    eventType: "application.submitted",
    schemaVersion: "1.0.0",
    eventTimestamp: "2026-10-15T12:00:00.000Z",
    tenantId: "tenant_alpha",
    sourceService: "dipindia",
    correlationId: "corr_ui_004",
    futureMinorHint: "v1_1_metadata",
    payload: { serviceCode: "SVC_TRADE_LICENSE", channel: "api" },
  },
};

const state: AppState = {
  activeView: "executive",
  sidebarCollapsed: false,
  tenantId: "tenant_alpha",
  timeZone: "Asia/Kolkata",
  granularity: "day",
  serviceCode: "",
  currency: "",
  entitiesTab: "partners",
  entitiesSearch: "",
  hiddenTrendSeries: new Set<string>(),
  hiddenDonutIds: new Set<string>(),
  financeMethodFilter: "all",
  exportDataset: "regions",
  exportFormat: "csv",
  exportMinCount: 5,
  exportMode: "suppress",
  exportPreview: null,
  exportLog: [],
  overview: null,
  loading: true,
  errorMessage: null,
  validatorInput: JSON.stringify(PRESET_EVENTS["valid"], null, 2),
  validatorPolicy: "reject",
  validatorResult: null,
  boundaryRequestedTenant: "tenant_beta",
  boundaryResult: null,
  contractCatalogJson: null,
  darkMode: false,
};

function escHtml(raw: unknown): string {
  const s = String(raw ?? "");
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtBps(bps: number | null | undefined): string {
  if (bps === null || bps === undefined) return "—";
  return `${(bps / 100).toFixed(2)}%`;
}

function fmtDurationMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)} min`;
  if (ms < 86_400_000) return `${(ms / 3_600_000).toFixed(1)} h`;
  return `${(ms / 86_400_000).toFixed(1)} d`;
}

function fmtMinor(amountMinor: number, currency: string): string {
  const negative = amountMinor < 0;
  const abs = Math.abs(amountMinor);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${negative ? "-" : ""}${currency} ${whole.toLocaleString("en-IN")}.${frac}`;
}

function chartColor(idx: number): string {
  return DIP_CHART_VARS[idx % DIP_CHART_VARS.length]!;
}

/** dip-ui StatStrip component (single-container horizontal divide-x layout) */
function renderStatStrip(
  items: readonly { readonly label: string; readonly value: string; readonly context?: string }[],
): string {
  return `
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[var(--dip-border)] rounded-[var(--dip-radius-lg)] border border-[var(--dip-border)] bg-[var(--dip-bg-surface)]">
      ${items
        .map(
          (item) => `
        <div class="p-5 flex flex-col gap-1">
          <span class="text-xs font-medium text-[var(--dip-text-secondary)]">${escHtml(item.label)}</span>
          <span class="text-2xl font-bold tracking-tight text-[var(--dip-text-primary)] dip-tabular font-mono">${escHtml(item.value)}</span>
          ${item.context ? `<span class="text-xs text-[var(--dip-text-muted)] font-mono dip-tabular">${escHtml(item.context)}</span>` : ""}
        </div>
      `,
        )
        .join("")}
    </div>
  `;
}

/** dip-ui PageHeader component */
function renderPageHeader(title: string, description: string, actionsHtml: string = ""): string {
  return `
    <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 pb-4 border-b border-[var(--dip-border)]">
      <div class="space-y-1">
        <h1 class="dip-font-display text-xl sm:text-2xl font-bold tracking-tight text-[var(--dip-text-primary)]">${escHtml(title)}</h1>
        <p class="text-sm text-[var(--dip-text-secondary)]">${escHtml(description)}</p>
      </div>
      ${actionsHtml ? `<div class="flex items-center gap-2 shrink-0">${actionsHtml}</div>` : ""}
    </div>
  `;
}

/** dip-ui StatusLabel (unboxed icon + text label) */
function renderStatusLabel(
  tone: "green" | "yellow" | "red" | "orange" | "neutral",
  label: string,
): string {
  const toneClass: Record<typeof tone, string> = {
    green: "text-[var(--dip-success)]",
    yellow: "text-[var(--dip-warning)]",
    red: "text-[var(--dip-danger)]",
    orange: "text-[var(--dip-info)]",
    neutral: "text-[var(--dip-text-muted)]",
  };
  const iconSvg =
    tone === "green"
      ? `<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />`
      : tone === "red"
        ? `<path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />`
        : tone === "yellow" || tone === "orange"
          ? `<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />`
          : `<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />`;

  return `
    <span class="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${toneClass[tone]}">
      <svg class="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">${iconSvg}</svg>
      <span>${escHtml(label)}</span>
    </span>
  `;
}

/** dip-ui DonutChart SVG builder (CircularAndDistributionCharts.tsx) */
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArcSlice(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const sweep = endAngle - startAngle;
  const largeArc = sweep > 180 ? 1 : 0;
  const p1 = polarToCartesian(cx, cy, outerR, startAngle);
  const p2 = polarToCartesian(cx, cy, outerR, endAngle);
  const p3 = polarToCartesian(cx, cy, innerR, endAngle);
  const p4 = polarToCartesian(cx, cy, innerR, startAngle);
  return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${outerR} ${outerR} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)} A ${innerR} ${innerR} 0 ${largeArc} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)} Z`;
}

function renderDonutChartCard(params: {
  readonly title: string;
  readonly subtitle: string;
  readonly centerLabel: string;
  readonly slices: readonly { readonly id: string; readonly label: string; readonly value: number }[];
}): string {
  const visible = params.slices.filter((s) => !state.hiddenDonutIds.has(s.id) && s.value > 0);
  const total = visible.reduce((acc, s) => acc + s.value, 0);

  let angle = 0;
  const paths =
    total > 0
      ? visible
          .map((slice) => {
            const origIdx = params.slices.findIndex((d) => d.id === slice.id);
            const color = chartColor(origIdx);
            const sweep = (slice.value / total) * 359.999;
            const start = angle;
            const end = start + sweep;
            angle = end;
            return `<path d="${describeArcSlice(100, 100, 84, 52, start, end)}" fill="${color}" stroke="var(--dip-bg-surface)" stroke-width="2"><title>${escHtml(slice.label)}: ${slice.value.toLocaleString("en-IN")}</title></path>`;
          })
          .join("")
      : "";

  const legendButtons = params.slices
    .map((s, idx) => {
      const hidden = state.hiddenDonutIds.has(s.id);
      return `
        <button type="button" data-donut-toggle="${escHtml(s.id)}" class="donut-legend-btn inline-flex items-center gap-1.5 text-xs transition-opacity cursor-pointer ${hidden ? "opacity-40 line-through" : "text-[var(--dip-text-secondary)] hover:text-[var(--dip-text-primary)]"}">
          <span class="h-2.5 w-2.5 rounded-xs shrink-0" style="background-color:${chartColor(idx)}" aria-hidden="true"></span>
          <span>${escHtml(s.label)}</span>
        </button>
      `;
    })
    .join("");

  const breakdownRows = visible
    .map((slice) => {
      const origIdx = params.slices.findIndex((d) => d.id === slice.id);
      const pct = total > 0 ? ((slice.value / total) * 100).toFixed(1) : "0.0";
      return `
        <div class="flex items-center justify-between gap-3 text-xs py-1.5 border-b border-[var(--dip-border)] last:border-b-0">
          <span class="inline-flex items-center gap-2 text-[var(--dip-text-secondary)]">
            <span class="h-2.5 w-2.5 rounded-xs shrink-0" style="background-color:${chartColor(origIdx)}" aria-hidden="true"></span>
            <span class="font-mono">${escHtml(slice.label)}</span>
          </span>
          <span class="font-mono dip-tabular text-[var(--dip-text-primary)] font-medium">
            ${slice.value.toLocaleString("en-IN")} (${pct}%)
          </span>
        </div>
      `;
    })
    .join("");

  return `
    <section class="rounded-[var(--dip-radius-lg)] border border-[var(--dip-border)] bg-[var(--dip-bg-surface)] p-6 space-y-4">
      <div class="space-y-1">
        <h2 class="dip-font-display text-base font-semibold text-[var(--dip-text-primary)]">${escHtml(params.title)}</h2>
        <p class="text-xs text-[var(--dip-text-muted)]">${escHtml(params.subtitle)}</p>
      </div>
      <div class="flex flex-wrap gap-3">${legendButtons}</div>
      ${
        total > 0
          ? `
        <div class="flex flex-col sm:flex-row items-center gap-6 pt-1">
          <svg viewBox="0 0 200 200" class="w-44 h-44 shrink-0 select-none" role="img" aria-label="${escHtml(params.title)}">
            ${paths}
            <text x="100" y="96" text-anchor="middle" fill="var(--dip-text-primary)" font-size="18" font-weight="700" class="font-mono dip-tabular">${total.toLocaleString("en-IN")}</text>
            <text x="100" y="114" text-anchor="middle" fill="var(--dip-text-muted)" font-size="11">${escHtml(params.centerLabel)}</text>
          </svg>
          <div class="w-full min-w-0">${breakdownRows}</div>
        </div>
      `
          : `<p class="text-xs text-[var(--dip-text-muted)] py-6 text-center">All segments hidden or zero values in window.</p>`
      }
    </section>
  `;
}

function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function fetchOverview(): Promise<void> {
  state.loading = true;
  state.errorMessage = null;
  renderViewport();

  const params = new URLSearchParams({
    tenantId: state.tenantId,
    timeZone: state.timeZone,
    granularity: state.granularity,
  });
  if (state.serviceCode) params.set("serviceCode", state.serviceCode);
  if (state.currency) params.set("currency", state.currency);

  try {
    const res = await fetch(`/api/workbench/overview?${params.toString()}`);
    if (!res.ok) {
      const errBody = (await res.json()) as { message?: string };
      throw new Error(errBody.message ?? `HTTP ${res.status}`);
    }
    state.overview = (await res.json()) as WorkbenchOverviewResponse;
    populateServiceFilterDropdown();
    updateHeaderAndMeta();
  } catch (err) {
    state.errorMessage = err instanceof Error ? err.message : "Failed to load analytics data.";
  } finally {
    state.loading = false;
    renderViewport();
  }
}

async function fetchExportPreview(downloadAfter: boolean = false): Promise<void> {
  const params = new URLSearchParams({
    tenantId: state.tenantId,
    dataset: state.exportDataset,
    format: state.exportFormat,
    minCount: String(state.exportMinCount),
    mode: state.exportMode,
  });
  const res = await fetch(`/api/workbench/export?${params.toString()}`);
  const data = (await res.json()) as ExportPreviewResponse;
  state.exportPreview = data;

  if (downloadAfter) {
    const ext = data.format;
    const mime =
      ext === "csv"
        ? "text/csv;charset=utf-8"
        : ext === "ndjson"
          ? "application/x-ndjson;charset=utf-8"
          : "application/json;charset=utf-8";
    downloadTextFile(`dip-analytics-${state.tenantId}-${data.dataset}.${ext}`, data.content, mime);
    state.exportLog = [
      {
        id: `exp_${Date.now()}`,
        dataset: data.dataset,
        format: data.format.toUpperCase(),
        rowCount: data.rowCount,
        suppressedRowCount: data.suppressedRowCount,
        timestamp: new Date().toISOString().slice(11, 19) + " UTC",
      },
      ...state.exportLog.slice(0, 5),
    ];
  }
  renderViewport();
}

function populateServiceFilterDropdown(): void {
  const select = document.getElementById("filter-service") as HTMLSelectElement | null;
  if (!select || !state.overview) return;
  const current = state.serviceCode;
  const known = state.overview.dashboards.services.servicePerformance.services
    .map((s) => s.serviceCode)
    .filter((c) => c !== "__other__");
  const options = ['<option value="">All Services</option>'];
  for (const code of known) {
    options.push(
      `<option value="${escHtml(code)}"${code === current ? " selected" : ""}>${escHtml(code)}</option>`,
    );
  }
  select.innerHTML = options.join("");
}

function updateHeaderAndMeta(): void {
  const titleEl = document.getElementById("header-breadcrumb-title");
  if (titleEl) titleEl.textContent = VIEW_TITLES[state.activeView];

  const metaEl = document.getElementById("scope-metadata-line");
  if (metaEl && state.overview) {
    const m = state.overview.dashboards.executive.metadata;
    metaEl.textContent = `${m.tenantId} · ${m.timeZone} · ${m.window.from.slice(0, 10)} to ${m.window.to.slice(0, 10)} · ${m.dataCompleteness.totalWindowEvents} events`;
  }

  const sidebar = document.getElementById("workspace-sidebar");
  if (sidebar) {
    if (state.sidebarCollapsed) {
      sidebar.classList.remove("w-[260px]");
      sidebar.classList.add("lg:w-[72px]");
    } else {
      sidebar.classList.add("w-[260px]");
      sidebar.classList.remove("lg:w-[72px]");
    }
    sidebar.querySelectorAll<HTMLElement>(".sidebar-label").forEach((el) => {
      el.classList.toggle("lg:hidden", state.sidebarCollapsed);
    });
  }

  document.querySelectorAll<HTMLButtonElement>(".nav-item").forEach((btn) => {
    const active = btn.dataset["view"] === state.activeView;
    btn.className = `nav-item w-full flex items-center gap-3 rounded-[var(--dip-radius-md)] px-3 min-h-[40px] text-sm font-medium text-left transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--dip-focus-ring)] ${
      active
        ? "bg-[var(--dip-accent-soft)] text-[var(--dip-accent-text)] font-semibold"
        : "text-[var(--dip-text-secondary)] hover:bg-[var(--dip-bg-subtle)] hover:text-[var(--dip-text-primary)]"
    }`;
  });

  document.querySelectorAll<HTMLButtonElement>(".gran-btn").forEach((btn) => {
    const active = btn.dataset["granularity"] === state.granularity;
    btn.className = `gran-btn px-3 py-1 rounded-[var(--dip-radius-sm)] text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
      active
        ? "bg-[var(--dip-bg-surface)] text-[var(--dip-text-primary)] shadow-xs"
        : "text-[var(--dip-text-muted)] hover:text-[var(--dip-text-primary)]"
    }`;
  });
}

function renderLoadingSkeleton(): string {
  return `
    <div class="h-28 rounded-[var(--dip-radius-lg)] bg-[var(--dip-bg-surface)] border border-[var(--dip-border)] animate-pulse"></div>
    <div class="h-72 rounded-[var(--dip-radius-lg)] bg-[var(--dip-bg-surface)] border border-[var(--dip-border)] animate-pulse"></div>
  `;
}

function renderEmptyState(reason: string): string {
  return `
    <div class="rounded-[var(--dip-radius-lg)] bg-[var(--dip-bg-surface)] border border-[var(--dip-border)] p-10 text-center space-y-4">
      <h2 class="dip-font-display text-lg font-semibold text-[var(--dip-text-primary)]">No Matching Events in Window</h2>
      <p class="text-sm text-[var(--dip-text-secondary)] max-w-md mx-auto">${escHtml(reason)}</p>
      <button type="button" id="reset-filters-btn" class="px-4 py-2 rounded-[var(--dip-radius-md)] text-xs font-semibold bg-[var(--dip-accent)] hover:bg-[var(--dip-accent-hover)] text-[var(--dip-accent-fg)] transition-colors">
        Reset Active Filters
      </button>
    </div>
  `;
}

function renderTrendSvgChart(buckets: readonly TimeSeriesBucket[]): string {
  if (buckets.length === 0) {
    return `<p class="text-sm text-[var(--dip-text-muted)] py-8 text-center">No time-series buckets available.</p>`;
  }

  const showSubmitted = !state.hiddenTrendSeries.has("submitted");
  const showCompleted = !state.hiddenTrendSeries.has("completed");
  const showBreaches = !state.hiddenTrendSeries.has("breaches");

  const width = 920;
  const height = 240;
  const padLeft = 42;
  const padRight = 20;
  const padTop = 18;
  const padBottom = 34;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const maxVal = Math.max(
    1,
    ...buckets.map((b) =>
      Math.max(
        showSubmitted ? b.applicationsSubmitted : 0,
        showCompleted ? b.applicationsCompleted : 0,
        showBreaches ? b.slaBreaches : 0,
      ),
    ),
  );
  const stepX = chartW / buckets.length;
  const barW = Math.max(6, Math.min(28, stepX * 0.56));

  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const y = padTop + chartH * (1 - ratio);
      const val = Math.round(maxVal * ratio);
      return `
        <line x1="${padLeft}" y1="${y.toFixed(1)}" x2="${width - padRight}" y2="${y.toFixed(1)}" stroke="var(--dip-chart-grid)" stroke-dasharray="3 3" />
        <text x="${padLeft - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="var(--dip-chart-axis)" font-size="10" font-family="JetBrains Mono, monospace">${val}</text>
      `;
    })
    .join("");

  const bars = buckets
    .map((b, idx) => {
      const cx = padLeft + idx * stepX + stepX / 2;
      const subH = showSubmitted ? (b.applicationsSubmitted / maxVal) * chartH : 0;
      const cmpH = showCompleted ? (b.applicationsCompleted / maxVal) * chartH : 0;
      const subY = padTop + chartH - subH;
      const cmpY = padTop + chartH - cmpH;
      const showLabel = buckets.length <= 16 || idx % 2 === 0;
      const shortLabel = b.bucketKey.length >= 10 ? b.bucketKey.slice(5, 10) : b.bucketKey;
      const breachMarker =
        showBreaches && b.slaBreaches > 1
          ? `<circle cx="${cx.toFixed(1)}" cy="${Math.max(padTop + 6, Math.min(subY, cmpY) - 8).toFixed(1)}" r="4" fill="var(--dip-chart-4)"><title>${escHtml(b.bucketKey)}: ${b.slaBreaches} SLA breaches</title></circle>`
          : "";

      return `
        <g>
          ${
            showSubmitted
              ? `<rect x="${(cx - barW / 2).toFixed(1)}" y="${subY.toFixed(1)}" width="${(barW * 0.5).toFixed(1)}" height="${subH.toFixed(1)}" rx="2" fill="var(--dip-chart-1)"><title>${escHtml(b.bucketKey)} · Submitted: ${b.applicationsSubmitted}</title></rect>`
              : ""
          }
          ${
            showCompleted
              ? `<rect x="${(cx - barW / 2 + barW * 0.52).toFixed(1)}" y="${cmpY.toFixed(1)}" width="${(barW * 0.48).toFixed(1)}" height="${cmpH.toFixed(1)}" rx="2" fill="var(--dip-chart-3)"><title>${escHtml(b.bucketKey)} · Completed: ${b.applicationsCompleted}</title></rect>`
              : ""
          }
          ${breachMarker}
          ${
            showLabel
              ? `<text x="${cx.toFixed(1)}" y="${height - 10}" text-anchor="middle" fill="var(--dip-chart-axis)" font-size="10" font-family="JetBrains Mono, monospace">${escHtml(shortLabel)}</text>`
              : ""
          }
        </g>
      `;
    })
    .join("");

  const legendItems = [
    { id: "submitted", label: "Submitted", color: "var(--dip-chart-1)" },
    { id: "completed", label: "Completed", color: "var(--dip-chart-3)" },
    { id: "breaches", label: "SLA Spike (>1)", color: "var(--dip-chart-4)" },
  ];

  const legendHtml = legendItems
    .map((item) => {
      const hidden = state.hiddenTrendSeries.has(item.id);
      return `
        <button type="button" data-trend-toggle="${item.id}" class="trend-legend-btn inline-flex items-center gap-1.5 text-xs transition-opacity cursor-pointer ${hidden ? "opacity-40 line-through" : "text-[var(--dip-text-secondary)] hover:text-[var(--dip-text-primary)]"}">
          <span class="h-2.5 w-2.5 rounded-xs shrink-0" style="background-color:${item.color}" aria-hidden="true"></span>
          <span>${escHtml(item.label)}</span>
        </button>
      `;
    })
    .join("");

  return `
    <div class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="text-xs text-[var(--dip-text-muted)]">Click legend items to toggle series visibility</span>
        <div class="flex items-center gap-4">${legendHtml}</div>
      </div>
      <div class="w-full overflow-x-auto">
        <svg viewBox="0 0 ${width} ${height}" class="w-full min-w-[600px] h-56" role="img" aria-label="Application submission and completion time-series chart">
          ${gridLines}
          ${bars}
        </svg>
      </div>
    </div>
  `;
}

function renderExecutiveView(data: WorkbenchOverviewResponse): string {
  const exec = data.dashboards.executive;
  if (exec.metadata.dataCompleteness.totalWindowEvents === 0) {
    return renderEmptyState("Try clearing the service or currency filter, or switching tenants.");
  }

  const revenueCurrencies = exec.revenue?.byCurrency ?? [];
  const primaryCurrency = revenueCurrencies[0];
  const secondaryCurrency = revenueCurrencies[1];

  const header = renderPageHeader(
    "Executive Overview",
    `${data.activeProfile.label} · Deterministic tenant-scoped summary`,
  );

  const statStrip = renderStatStrip([
    {
      label: "Applications Submitted",
      value: exec.funnel.submittedCount.toLocaleString("en-IN"),
      context: `Completion ${fmtBps(exec.funnel.completionRateBps)} · Approval ${fmtBps(exec.funnel.approvalRateOfCompletedBps)}`,
    },
    {
      label: "Net Revenue After Refunds",
      value: primaryCurrency
        ? `${primaryCurrency.currency} ${primaryCurrency.formattedNetRevenueAfterRefunds}`
        : "—",
      context: secondaryCurrency
        ? `Also ${secondaryCurrency.currency} ${secondaryCurrency.formattedNetRevenueAfterRefunds}`
        : `Refund rate ${fmtBps(primaryCurrency?.refundRateBps)}`,
    },
    {
      label: "SLA Target Compliance",
      value: fmtBps(exec.sla.slaComplianceRateBps),
      context: `p95 ${fmtDurationMs(exec.sla.processingDuration?.p95Ms)} · ${exec.sla.criticalBreaches} critical`,
    },
    {
      label: "API Health & Latency",
      value: exec.apiHealth.totalRequests.toLocaleString("en-IN"),
      context: `Error ${fmtBps(exec.apiHealth.errorRateBps)} · p95 ${fmtDurationMs(exec.apiHealth.p95LatencyMs)}`,
    },
  ]);

  const trendAndDonut = `
    <div class="grid grid-cols-1 xl:grid-cols-12 gap-6">
      <section class="xl:col-span-7 rounded-[var(--dip-radius-lg)] border border-[var(--dip-border)] bg-[var(--dip-bg-surface)] p-6">
        <div class="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <h2 class="dip-font-display text-base font-semibold text-[var(--dip-text-primary)]">Lifecycle Volume &amp; SLA Trend</h2>
          <span class="text-xs text-[var(--dip-text-muted)] font-mono dip-tabular">${exec.trend.buckets.length} buckets · ${escHtml(data.activeProfile.defaultTimeZone)}</span>
        </div>
        ${renderTrendSvgChart(exec.trend.buckets)}
      </section>

      <div class="xl:col-span-5">
        ${renderDonutChartCard({
          title: "Regional Submission Share",
          subtitle: "Aggregated by opaque regionCode",
          centerLabel: "Submissions",
          slices: exec.geographic.regions.map((r) => ({
            id: r.regionCode,
            label: r.regionCode,
            value: r.submittedCount,
          })),
        })}
      </div>
    </div>
  `;

  // Service Catalogue Pattern (dip-ui ServiceCataloguePattern)
  const serviceCards = data.dashboards.services.servicePerformance.services
    .filter((s) => s.serviceCode !== "__other__")
    .map((s) => {
      const active = state.serviceCode === s.serviceCode;
      return `
        <button
          type="button"
          data-filter-service-card="${escHtml(s.serviceCode)}"
          class="svc-catalogue-card text-left rounded-[var(--dip-radius-lg)] border p-4 transition-colors cursor-pointer ${
            active
              ? "border-[var(--dip-accent)] bg-[var(--dip-accent-soft)]"
              : "border-[var(--dip-border)] bg-[var(--dip-bg-surface)] hover:border-[var(--dip-border-strong)]"
          }"
        >
          <div class="flex items-start justify-between gap-2">
            <span class="font-mono text-xs font-semibold text-[var(--dip-text-primary)] truncate">${escHtml(s.serviceCode)}</span>
            ${renderStatusLabel(
              s.slaBreachCount > 0 ? "yellow" : "green",
              s.slaBreachCount > 0 ? `${s.slaBreachCount} SLA` : "Nominal",
            )}
          </div>
          <div class="mt-3 flex items-baseline justify-between text-xs text-[var(--dip-text-secondary)] font-mono dip-tabular">
            <span>${s.submittedCount} submitted</span>
            <span>${fmtBps(s.completionRateBps)} done</span>
          </div>
        </button>
      `;
    })
    .join("");

  const catalogueSection = `
    <section class="space-y-3">
      <div class="flex items-baseline justify-between gap-2">
        <h2 class="dip-font-display text-base font-semibold text-[var(--dip-text-primary)]">Service Lines Catalogue</h2>
        <span class="text-xs text-[var(--dip-text-muted)]">Click a service card to scope dashboard filters</span>
      </div>
      ${
        serviceCards
          ? `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">${serviceCards}</div>`
          : `<div class="rounded-[var(--dip-radius-lg)] border border-[var(--dip-border)] bg-[var(--dip-bg-surface)] p-4 text-xs text-[var(--dip-text-muted)]">No application service events in the current filter scope.</div>`
      }
    </section>
  `;

  const cohortRows = data.advanced.cohortRetention.cohorts
    .slice(0, 6)
    .map((c) => {
      const cells = [0, 1, 2]
        .map((offset) => {
          const p = c.periods[offset];
          return `<td class="py-2.5 px-3 text-right font-mono text-xs dip-tabular">${p ? `${fmtBps(p.retentionRateBps)} (${p.activeAccountsCount})` : "—"}</td>`;
        })
        .join("");
      return `
        <tr class="border-t border-[var(--dip-border)] hover:bg-[var(--dip-bg-subtle)]">
          <td class="py-2.5 pr-4 font-mono text-xs font-medium text-[var(--dip-text-primary)]">${escHtml(c.cohortBucket)}</td>
          <td class="py-2.5 px-3 text-right font-mono text-xs dip-tabular">${c.cohortSize}</td>
          ${cells}
        </tr>
      `;
    })
    .join("");

  const cohortTable = `
    <section class="rounded-[var(--dip-radius-lg)] border border-[var(--dip-border)] bg-[var(--dip-bg-surface)] p-6">
      <div class="flex items-baseline justify-between gap-2 mb-4">
        <h2 class="dip-font-display text-base font-semibold text-[var(--dip-text-primary)]">Account Cohort Retention</h2>
        <span class="text-xs text-[var(--dip-text-muted)] font-mono dip-tabular">${data.advanced.cohortRetention.trackedAccountsCount} opaque accounts · ${fmtBps(exec.accountActivity.repeatAccountRateBps)} repeat</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="text-xs font-medium text-[var(--dip-text-muted)]">
              <th class="pb-2.5 pr-4">Cohort</th>
              <th class="pb-2.5 px-3 text-right">Size</th>
              <th class="pb-2.5 px-3 text-right">Period 0</th>
              <th class="pb-2.5 px-3 text-right">Period +1</th>
              <th class="pb-2.5 pl-3 text-right">Period +2</th>
            </tr>
          </thead>
          <tbody>${cohortRows || `<tr><td colspan="5" class="py-4 text-xs text-[var(--dip-text-muted)]">No tracked account cohorts</td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `;

  return `${header}${statStrip}${trendAndDonut}${catalogueSection}${cohortTable}`;
}

function renderOperationsView(data: WorkbenchOverviewResponse): string {
  const ops = data.dashboards.operations;
  const sla = data.dashboards.executive.sla;
  const backlog = data.advanced.backlogAging;
  const stages = data.advanced.customFunnel.stages;

  const header = renderPageHeader(
    "Operations & Backlog",
    "Custom-stage funnel progression, SLA bottlenecks, and open queue aging histogram",
  );

  const statStrip = renderStatStrip([
    {
      label: "Tracked Applications",
      value: ops.statusDistribution.trackedApplicationsCount.toLocaleString("en-IN"),
      context: `${data.dashboards.executive.funnel.completedCount} completed`,
    },
    {
      label: "Open Backlog",
      value: backlog.openApplicationsCount.toLocaleString("en-IN"),
      context: `Oldest open ${fmtDurationMs(backlog.oldestOpenAgeMs)}`,
    },
    {
      label: "SLA Compliance",
      value: fmtBps(sla.slaComplianceRateBps),
      context: `${sla.withinSlaTargetCount} of ${sla.completedApplicationsCount} within target`,
    },
    {
      label: "Handling Time (p50 / p95)",
      value: fmtDurationMs(sla.processingDuration?.p50Ms),
      context: `p95 ${fmtDurationMs(sla.processingDuration?.p95Ms)}`,
    },
  ]);

  const maxStage = Math.max(stages[0]?.reachedCount ?? 1, 1);
  // dip-ui FunnelChart pattern (AnalyticalCharts.tsx)
  const funnelBars = stages
    .map((s, idx) => {
      const widthPct = Math.max(12, Math.round((s.reachedCount / maxStage) * 100));
      const convStep = s.conversionFromPreviousBps !== null ? ` · ${(s.conversionFromPreviousBps / 100).toFixed(0)}% step` : "";
      return `
        <div class="space-y-1.5">
          <div class="flex items-center justify-between gap-2 text-xs">
            <span class="font-medium text-[var(--dip-text-primary)] font-mono">${escHtml(s.stage)}</span>
            <span class="font-mono dip-tabular text-[var(--dip-text-secondary)]">
              ${s.reachedCount.toLocaleString("en-IN")}${idx > 0 ? convStep : ""}
            </span>
          </div>
          <div class="w-full rounded-[var(--dip-radius-sm)] bg-[var(--dip-bg-subtle)] p-1">
            <span class="block h-5 rounded-[var(--dip-radius-sm)]" style="width:${widthPct}%;background-color:${chartColor(idx)}"></span>
          </div>
        </div>
      `;
    })
    .join("");

  const agingBands: Array<{ key: keyof typeof backlog.buckets; label: string; color: string }> = [
    { key: "under_1h", label: "Under 1 hour", color: "var(--dip-chart-3)" },
    { key: "from_1h_to_24h", label: "1 to 24 hours", color: "var(--dip-chart-6)" },
    { key: "from_1d_to_7d", label: "1 to 7 days", color: "var(--dip-chart-4)" },
    { key: "over_7d", label: "Over 7 days (At Risk)", color: "var(--dip-chart-1)" },
  ];
  const maxOpen = Math.max(1, backlog.openApplicationsCount);

  const agingHtml = agingBands
    .map((b) => {
      const val = backlog.buckets[b.key];
      const pct = Math.max(val > 0 ? 8 : 0, Math.round((val / maxOpen) * 100));
      return `
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-[var(--dip-text-primary)]">${escHtml(b.label)}</span>
            <span class="font-mono dip-tabular text-[var(--dip-text-secondary)]">${val} open</span>
          </div>
          <div class="w-full rounded-[var(--dip-radius-sm)] bg-[var(--dip-bg-subtle)] p-1">
            <span class="block h-4 rounded-[var(--dip-radius-sm)]" style="width:${pct}%;background-color:${b.color}"></span>
          </div>
        </div>
      `;
    })
    .join("");

  const bottleneckRows = sla.stageBottlenecks
    .map(
      (b) => `
      <tr class="border-t border-[var(--dip-border)]">
        <td class="py-2.5 pr-4 font-mono text-xs text-[var(--dip-text-primary)]">${escHtml(b.stageCode)}</td>
        <td class="py-2.5 px-3 text-right font-mono text-xs dip-tabular">${b.warningCount}</td>
        <td class="py-2.5 px-3 text-right font-mono text-xs dip-tabular">${b.criticalCount}</td>
        <td class="py-2.5 px-3 text-right font-mono text-xs dip-tabular">${renderStatusLabel(b.criticalCount > 0 ? "red" : "orange", String(b.breachCount))}</td>
        <td class="py-2.5 pl-3 text-right font-mono text-xs dip-tabular">${fmtDurationMs(b.maxOverrunMs)}</td>
      </tr>
    `,
    )
    .join("");

  const statusSlices = (ops.statusDistribution.currentStatuses ?? []).map((s) => ({
    id: s.status,
    label: s.status,
    value: s.applicationCount,
  }));

  return `
    ${header}
    ${statStrip}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section class="rounded-[var(--dip-radius-lg)] border border-[var(--dip-border)] bg-[var(--dip-bg-surface)] p-6 space-y-4">
        <div class="flex items-baseline justify-between gap-2">
          <h2 class="dip-font-display text-base font-semibold text-[var(--dip-text-primary)]">Stage Conversion Funnel</h2>
          <span class="text-xs text-[var(--dip-text-muted)] font-mono dip-tabular">${ops.statusDistribution.trackedApplicationsCount} tracked</span>
        </div>
        <div class="space-y-3">${funnelBars}</div>
      </section>

      <section class="rounded-[var(--dip-radius-lg)] border border-[var(--dip-border)] bg-[var(--dip-bg-surface)] p-6 space-y-4">
        <div class="flex items-baseline justify-between gap-2">
          <h2 class="dip-font-display text-base font-semibold text-[var(--dip-text-primary)]">Open Backlog Aging Histogram</h2>
          <span class="text-xs text-[var(--dip-text-muted)] font-mono dip-tabular">${backlog.openApplicationsCount} open</span>
        </div>
        <div class="space-y-3">${agingHtml}</div>
      </section>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section class="rounded-[var(--dip-radius-lg)] border border-[var(--dip-border)] bg-[var(--dip-bg-surface)] p-6">
        <h2 class="dip-font-display text-base font-semibold text-[var(--dip-text-primary)] mb-4">SLA Stage Bottlenecks</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="text-xs font-medium text-[var(--dip-text-muted)]">
                <th class="pb-2.5 pr-4">Stage</th>
                <th class="pb-2.5 px-3 text-right">Warn</th>
                <th class="pb-2.5 px-3 text-right">Crit</th>
                <th class="pb-2.5 px-3 text-right">Breaches</th>
                <th class="pb-2.5 pl-3 text-right">Max Overrun</th>
              </tr>
            </thead>
            <tbody>${bottleneckRows || `<tr><td colspan="5" class="py-4 text-xs text-[var(--dip-text-muted)]">Zero SLA stage bottlenecks detected.</td></tr>`}</tbody>
          </table>
        </div>
      </section>

      ${renderDonutChartCard({
        title: "Latest Application Status Mix",
        subtitle: "Reconciled chronologically by eventTimestamp",
        centerLabel: "Applications",
        slices: statusSlices,
      })}
    </div>
  `;
}

function renderFinanceView(data: WorkbenchOverviewResponse): string {
  const fin = data.dashboards.finance;
  const econ = data.advanced.unitEconomics;
  const rec = fin.reconciliation;

  const header = renderPageHeader(
    "Finance & Unit Economics",
    "Integer minor-unit ledger, payment reconciliation states, and per-service net margin",
  );

  const statStrip = renderStatStrip([
    {
      label: "Payment Success Rate",
      value: fmtBps(fin.paymentMetrics.successRateBps),
      context: `${fin.paymentMetrics.succeededCount} succeeded · ${fin.paymentMetrics.failedCount} failed`,
    },
    {
      label: "Reconciled Settled",
      value: rec.settledCount.toLocaleString("en-IN"),
      context: `of ${rec.trackedPaymentRefsCount} payment references`,
    },
    {
      label: "Unsettled Initiated",
      value: rec.unsettledInitiatedCount.toLocaleString("en-IN"),
      context: `${rec.failedOnlyCount} terminal failures`,
    },
    {
      label: "Discrepancies",
      value: String(rec.orphanedRefundCount + rec.overRefundedCount + rec.currencyDiscrepancyCount),
      context: `Orphan ${rec.orphanedRefundCount} · Over-refund ${rec.overRefundedCount}`,
    },
  ]);

  const currencyRows = (fin.revenueAndRefunds?.byCurrency ?? [])
    .map(
      (c) => `
      <tr class="border-t border-[var(--dip-border)]">
        <td class="py-2.5 pr-4 font-mono text-xs font-semibold text-[var(--dip-text-primary)]">${escHtml(c.currency)}</td>
        <td class="py-2.5 px-3 text-right font-mono text-xs dip-tabular">${escHtml(fmtMinor(c.grossRevenueMinor, c.currency))}</td>
        <td class="py-2.5 px-3 text-right font-mono text-xs dip-tabular">${escHtml(fmtMinor(c.totalFeesMinor, c.currency))}</td>
        <td class="py-2.5 px-3 text-right font-mono text-xs dip-tabular">${escHtml(fmtMinor(c.totalRefundedMinor, c.currency))}</td>
        <td class="py-2.5 pl-3 text-right font-mono text-xs dip-tabular font-semibold text-[var(--dip-success)]">${escHtml(fmtMinor(c.netRevenueAfterRefundsMinor, c.currency))}</td>
      </tr>
    `,
    )
    .join("");

  const methods = (fin.paymentMetrics.byMethod ?? [])
    .filter((m) => state.financeMethodFilter === "all" || m.paymentMethodCategory === state.financeMethodFilter)
    .map(
      (m) => `
      <tr class="border-t border-[var(--dip-border)]">
        <td class="py-2.5 pr-4 font-mono text-xs font-medium text-[var(--dip-text-primary)]">${escHtml(m.paymentMethodCategory.toUpperCase())}</td>
        <td class="py-2.5 px-3 text-right font-mono text-xs dip-tabular">${m.succeededCount}</td>
        <td class="py-2.5 px-3 text-right font-mono text-xs dip-tabular">${m.failedCount}</td>
        <td class="py-2.5 pl-3 text-right font-mono text-xs dip-tabular">${fmtBps(m.successRateBps)}</td>
      </tr>
    `,
    )
    .join("");

  const unitRows = econ.rows
    .map(
      (r) => `
      <tr class="border-t border-[var(--dip-border)] hover:bg-[var(--dip-bg-subtle)]">
        <td class="py-2.5 pr-4 font-mono text-xs font-medium text-[var(--dip-text-primary)]">${escHtml(r.serviceCode)}</td>
        <td class="py-2.5 px-2 font-mono text-xs">${escHtml(r.currency)}</td>
        <td class="py-2.5 px-3 text-right font-mono text-xs dip-tabular">${r.completedApplicationsCount}</td>
        <td class="py-2.5 px-3 text-right font-mono text-xs dip-tabular">${escHtml(fmtMinor(r.grossRevenueMinor, r.currency))}</td>
        <td class="py-2.5 px-3 text-right font-mono text-xs dip-tabular">${escHtml(fmtMinor(r.gatewayFeesMinor + r.refundedMinor + r.partnerCommissionMinor, r.currency))}</td>
        <td class="py-2.5 px-3 text-right font-mono text-xs dip-tabular font-semibold">${escHtml(fmtMinor(r.netContributionMinor, r.currency))}</td>
        <td class="py-2.5 pl-3 text-right font-mono text-xs dip-tabular">${fmtBps(r.netMarginBps)}</td>
      </tr>
    `,
    )
    .join("");

  const methodTabs = ["all", ...(fin.paymentMetrics.byMethod ?? []).map((m) => m.paymentMethodCategory)]
    .map(
      (m) => `
      <button type="button" data-fin-method="${escHtml(m)}" class="fin-method-btn px-2.5 py-1 rounded-[var(--dip-radius-sm)] text-xs font-medium whitespace-nowrap shrink-0 ${
        state.financeMethodFilter === m
          ? "bg-[var(--dip-bg-surface)] text-[var(--dip-text-primary)] shadow-xs"
          : "text-[var(--dip-text-muted)] hover:text-[var(--dip-text-primary)]"
      }">${escHtml(m === "all" ? "All" : m.toUpperCase())}</button>
    `,
    )
    .join("");

  return `
    ${header}
    ${statStrip}
    <div class="grid grid-cols-1 xl:grid-cols-12 gap-6">
      <section class="xl:col-span-7 rounded-[var(--dip-radius-lg)] border border-[var(--dip-border)] bg-[var(--dip-bg-surface)] p-6">
        <div class="flex items-baseline justify-between gap-2 mb-4">
          <h2 class="dip-font-display text-base font-semibold text-[var(--dip-text-primary)]">Currency-Separated Financial Ledger</h2>
          <span class="text-xs text-[var(--dip-text-muted)]">BigInt minor-unit arithmetic</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="text-xs font-medium text-[var(--dip-text-muted)]">
                <th class="pb-2.5 pr-4">Currency</th>
                <th class="pb-2.5 px-3 text-right">Gross Revenue</th>
                <th class="pb-2.5 px-3 text-right">Fees</th>
                <th class="pb-2.5 px-3 text-right">Refunded</th>
                <th class="pb-2.5 pl-3 text-right">Net Settled</th>
              </tr>
            </thead>
            <tbody>${currencyRows || `<tr><td colspan="5" class="py-4 text-xs text-[var(--dip-text-muted)]">No financial transactions in window.</td></tr>`}</tbody>
          </table>
        </div>
      </section>

      <section class="xl:col-span-5 rounded-[var(--dip-radius-lg)] border border-[var(--dip-border)] bg-[var(--dip-bg-surface)] p-6 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="dip-font-display text-base font-semibold text-[var(--dip-text-primary)]">Payment Channels</h2>
          <div class="inline-flex items-center p-0.5 rounded-[var(--dip-radius-md)] bg-[var(--dip-bg-subtle)] border border-[var(--dip-border)]">${methodTabs}</div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="text-xs font-medium text-[var(--dip-text-muted)]">
                <th class="pb-2.5 pr-4">Method</th>
                <th class="pb-2.5 px-3 text-right">Paid</th>
                <th class="pb-2.5 px-3 text-right">Failed</th>
                <th class="pb-2.5 pl-3 text-right">Success</th>
              </tr>
            </thead>
            <tbody>${methods || `<tr><td colspan="4" class="py-4 text-xs text-[var(--dip-text-muted)]">No payment methods match filter.</td></tr>`}</tbody>
          </table>
        </div>
      </section>
    </div>

    <section class="rounded-[var(--dip-radius-lg)] border border-[var(--dip-border)] bg-[var(--dip-bg-surface)] p-6">
      <div class="flex items-baseline justify-between gap-2 mb-4">
        <h2 class="dip-font-display text-base font-semibold text-[var(--dip-text-primary)]">Service Unit Economics &amp; Net Margin</h2>
        <span class="text-xs text-[var(--dip-text-muted)]">Gross minus fees, refunds &amp; partner commissions</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="text-xs font-medium text-[var(--dip-text-muted)]">
              <th class="pb-2.5 pr-4">Service</th>
              <th class="pb-2.5 px-2">Cur</th>
              <th class="pb-2.5 px-3 text-right">Completed</th>
              <th class="pb-2.5 px-3 text-right">Gross</th>
              <th class="pb-2.5 px-3 text-right">Total Costs</th>
              <th class="pb-2.5 px-3 text-right">Net Contribution</th>
              <th class="pb-2.5 pl-3 text-right">Net Margin</th>
            </tr>
          </thead>
          <tbody>${unitRows || `<tr><td colspan="7" class="py-4 text-xs text-[var(--dip-text-muted)]">No service unit economics rows.</td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderEntitiesView(data: WorkbenchOverviewResponse): string {
  const q = state.entitiesSearch.trim().toLowerCase();
  const header = renderPageHeader(
    "Partners, Operators & Services",
    "Workforce turnaround, queue throughput, and partner commission tracking",
  );

  const tabBar = `
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div class="inline-flex items-center p-1 rounded-[var(--dip-radius-md)] bg-[var(--dip-bg-subtle)] border border-[var(--dip-border)]">
        ${(["partners", "operators", "services"] as const)
          .map(
            (t) => `
          <button type="button" data-entity-tab="${t}" class="entity-tab-btn px-3.5 py-1.5 rounded-[var(--dip-radius-sm)] text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            state.entitiesTab === t
              ? "bg-[var(--dip-bg-surface)] text-[var(--dip-text-primary)] shadow-xs"
              : "text-[var(--dip-text-muted)] hover:text-[var(--dip-text-primary)]"
          }">
            ${t === "partners" ? "Partners" : t === "operators" ? "Operators & Queues" : "Services"}
          </button>
        `,
          )
          .join("")}
      </div>

      <input
        id="entity-search-input"
        type="search"
        value="${escHtml(state.entitiesSearch)}"
        placeholder="Filter by opaque reference or code..."
        class="px-3 py-1.5 rounded-[var(--dip-radius-md)] border border-[var(--dip-border)] bg-[var(--dip-bg-subtle)] text-xs text-[var(--dip-text-primary)] w-full sm:w-64 focus-visible:outline-2 focus-visible:outline-[var(--dip-focus-ring)]"
      />
    </div>
  `;

  let tableHtml = "";
  if (state.entitiesTab === "partners") {
    const rows = data.dashboards.partners.partnerPerformance.partners
      .filter((p) => !q || p.partnerRef.toLowerCase().includes(q))
      .map((p) => {
        const comm = Object.entries(p.commissionsByCurrencyMinor)
          .map(([c, amt]) => fmtMinor(amt, c))
          .join(", ");
        return `
          <tr class="border-t border-[var(--dip-border)] hover:bg-[var(--dip-bg-subtle)]">
            <td class="py-2.5 pr-4 font-mono text-xs font-medium text-[var(--dip-text-primary)]">${escHtml(p.partnerRef)}</td>
            <td class="py-2.5 px-3 text-right font-mono text-xs dip-tabular">${p.assignedCount}</td>
            <td class="py-2.5 px-3 text-right font-mono text-xs dip-tabular">${p.workCompletedCount}</td>
            <td class="py-2.5 px-3 text-right font-mono text-xs dip-tabular">${fmtBps(p.completionRateBps)}</td>
            <td class="py-2.5 px-3 text-right font-mono text-xs dip-tabular">${fmtDurationMs(p.turnaround?.p50Ms)}</td>
            <td class="py-2.5 pl-3 text-right font-mono text-xs dip-tabular">${escHtml(comm || "—")}</td>
          </tr>
        `;
      })
      .join("");
    tableHtml = `
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="text-xs font-medium text-[var(--dip-text-muted)]">
            <th class="pb-2.5 pr-4">Partner Ref</th>
            <th class="pb-2.5 px-3 text-right">Assigned</th>
            <th class="pb-2.5 px-3 text-right">Completed</th>
            <th class="pb-2.5 px-3 text-right">Completion</th>
            <th class="pb-2.5 px-3 text-right">p50 Turnaround</th>
            <th class="pb-2.5 pl-3 text-right">Commissions</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="6" class="py-4 text-xs text-[var(--dip-text-muted)]">No partner records match filter.</td></tr>`}</tbody>
      </table>
    `;
  } else if (state.entitiesTab === "operators") {
    const rows = data.dashboards.operators.operatorWorkload.operators
      .filter((o) => !q || o.operatorRef.toLowerCase().includes(q))
      .map(
        (o) => `
        <tr class="border-t border-[var(--dip-border)] hover:bg-[var(--dip-bg-subtle)]">
          <td class="py-2.5 pr-4 font-mono text-xs font-medium text-[var(--dip-text-primary)]">${escHtml(o.operatorRef)}</td>
          <td class="py-2.5 px-3 text-right font-mono text-xs dip-tabular">${o.totalActions}</td>
          <td class="py-2.5 px-3 text-right font-mono text-xs dip-tabular">${o.distinctQueuesCount}</td>
          <td class="py-2.5 px-3 text-right font-mono text-xs dip-tabular">${fmtBps(o.approvalDecisionRateBps)}</td>
          <td class="py-2.5 px-3 text-right font-mono text-xs dip-tabular">${fmtBps(o.escalationRateBps)}</td>
          <td class="py-2.5 pl-3 text-right font-mono text-xs dip-tabular">${fmtDurationMs(o.actionDuration?.avgMs)}</td>
        </tr>
      `,
      )
      .join("");
    tableHtml = `
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="text-xs font-medium text-[var(--dip-text-muted)]">
            <th class="pb-2.5 pr-4">Operator Ref</th>
            <th class="pb-2.5 px-3 text-right">Actions</th>
            <th class="pb-2.5 px-3 text-right">Queues</th>
            <th class="pb-2.5 px-3 text-right">Approval Rate</th>
            <th class="pb-2.5 px-3 text-right">Escalation Rate</th>
            <th class="pb-2.5 pl-3 text-right">Avg Handle</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="6" class="py-4 text-xs text-[var(--dip-text-muted)]">No operator records match filter.</td></tr>`}</tbody>
      </table>
    `;
  } else {
    const rows = data.dashboards.services.servicePerformance.services
      .filter((s) => !q || s.serviceCode.toLowerCase().includes(q))
      .map(
        (s) => `
        <tr class="border-t border-[var(--dip-border)] hover:bg-[var(--dip-bg-subtle)]">
          <td class="py-2.5 pr-4 font-mono text-xs font-medium text-[var(--dip-text-primary)]">${escHtml(s.serviceCode)}</td>
          <td class="py-2.5 px-3 text-right font-mono text-xs dip-tabular">${s.submittedCount}</td>
          <td class="py-2.5 px-3 text-right font-mono text-xs dip-tabular">${s.completedCount}</td>
          <td class="py-2.5 px-3 text-right font-mono text-xs dip-tabular">${fmtBps(s.completionRateBps)}</td>
          <td class="py-2.5 px-3 text-right font-mono text-xs dip-tabular">${s.slaBreachCount}</td>
          <td class="py-2.5 pl-3 text-right font-mono text-xs dip-tabular">${fmtDurationMs(s.duration.p95Ms)}</td>
        </tr>
      `,
      )
      .join("");
    tableHtml = `
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="text-xs font-medium text-[var(--dip-text-muted)]">
            <th class="pb-2.5 pr-4">Service Code</th>
            <th class="pb-2.5 px-3 text-right">Submitted</th>
            <th class="pb-2.5 px-3 text-right">Completed</th>
            <th class="pb-2.5 px-3 text-right">Completion</th>
            <th class="pb-2.5 px-3 text-right">SLA Breaches</th>
            <th class="pb-2.5 pl-3 text-right">p95 Duration</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="6" class="py-4 text-xs text-[var(--dip-text-muted)]">No services match filter.</td></tr>`}</tbody>
      </table>
    `;
  }

  return `
    ${header}
    <section class="rounded-[var(--dip-radius-lg)] border border-[var(--dip-border)] bg-[var(--dip-bg-surface)] p-6 space-y-5">
      ${tabBar}
      <div class="overflow-x-auto">${tableHtml}</div>
    </section>
  `;
}

function renderApiView(data: WorkbenchOverviewResponse): string {
  const api = data.dashboards.apiAnalytics.apiMetrics;
  const alerts = data.advanced.anomalies.alerts;

  const header = renderPageHeader(
    "API Health & Anomaly Detection",
    "Route-level latency percentiles and deterministic integer rolling-baseline alerts",
  );

  const statStrip = renderStatStrip([
    {
      label: "API Request Volume",
      value: api.totalRequests.toLocaleString("en-IN"),
      context: `2xx: ${api.status2xxCount} · 4xx: ${api.status4xxCount} · 5xx: ${api.status5xxCount}`,
    },
    {
      label: "Overall Error Rate",
      value: fmtBps(api.errorRateBps),
      context: `5xx Server Error ${fmtBps(api.serverErrorRateBps)}`,
    },
    {
      label: "p95 Latency",
      value: fmtDurationMs(api.overallLatency?.p95Ms),
      context: `p99 ${fmtDurationMs(api.overallLatency?.p99Ms)}`,
    },
    {
      label: "Detected Anomalies",
      value: String(alerts.length),
      context: `${data.advanced.anomalies.evaluatedBucketsCount} buckets evaluated`,
    },
  ]);

  const endpointRows = (api.endpoints ?? [])
    .map(
      (ep) => `
      <tr class="border-t border-[var(--dip-border)]">
        <td class="py-2.5 pr-4 font-mono text-xs font-medium text-[var(--dip-text-primary)]">${escHtml(ep.routeKey)}</td>
        <td class="py-2.5 px-3 text-right font-mono text-xs dip-tabular">${ep.requestCount}</td>
        <td class="py-2.5 px-3 text-right font-mono text-xs dip-tabular">${fmtBps(ep.errorRateBps)}</td>
        <td class="py-2.5 px-3 text-right font-mono text-xs dip-tabular">${fmtDurationMs(ep.latency?.p50Ms)}</td>
        <td class="py-2.5 pl-3 text-right font-mono text-xs dip-tabular">${fmtDurationMs(ep.latency?.p95Ms)}</td>
      </tr>
    `,
    )
    .join("");

  const alertRows = alerts
    .map(
      (a) => `
      <div class="p-4 rounded-[var(--dip-radius-md)] border border-[var(--dip-border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div class="space-y-1">
          <div class="flex items-center gap-2 text-xs">
            ${renderStatusLabel(a.severity === "critical" ? "red" : "yellow", a.severity.toUpperCase())}
            <span aria-hidden="true" class="text-[var(--dip-text-muted)]">·</span>
            <span class="font-mono font-medium text-[var(--dip-text-primary)]">${escHtml(a.metric)}</span>
            <span aria-hidden="true" class="text-[var(--dip-text-muted)]">·</span>
            <span class="font-mono text-[var(--dip-text-muted)]">${escHtml(a.bucketKey)}</span>
          </div>
          <p class="text-xs text-[var(--dip-text-secondary)]">${escHtml(a.reason)}</p>
        </div>
        <div class="text-xs font-mono dip-tabular text-[var(--dip-text-muted)] shrink-0">
          Observed ${a.observedValue} vs baseline ${a.baselineMean}
        </div>
      </div>
    `,
    )
    .join("");

  return `
    ${header}
    ${statStrip}
    <section class="rounded-[var(--dip-radius-lg)] border border-[var(--dip-border)] bg-[var(--dip-bg-surface)] p-6 space-y-4">
      <div class="flex items-baseline justify-between gap-2">
        <h2 class="dip-font-display text-base font-semibold text-[var(--dip-text-primary)]">Deterministic Rolling-Baseline Alerts</h2>
        <span class="text-xs text-[var(--dip-text-muted)] font-mono dip-tabular">${alerts.length} alerts</span>
      </div>
      <div class="space-y-3">${alertRows || `<p class="text-xs text-[var(--dip-text-muted)]">No rolling-baseline anomalies detected in current window.</p>`}</div>
    </section>

    <section class="rounded-[var(--dip-radius-lg)] border border-[var(--dip-border)] bg-[var(--dip-bg-surface)] p-6">
      <h2 class="dip-font-display text-base font-semibold text-[var(--dip-text-primary)] mb-4">Endpoint Breakdown</h2>
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="text-xs font-medium text-[var(--dip-text-muted)]">
              <th class="pb-2.5 pr-4">Endpoint</th>
              <th class="pb-2.5 px-3 text-right">Requests</th>
              <th class="pb-2.5 px-3 text-right">Error Rate</th>
              <th class="pb-2.5 px-3 text-right">p50</th>
              <th class="pb-2.5 pl-3 text-right">p95</th>
            </tr>
          </thead>
          <tbody>${endpointRows || `<tr><td colspan="5" class="py-4 text-xs text-[var(--dip-text-muted)]">No API telemetry recorded for this tenant.</td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderExportView(): string {
  const preview = state.exportPreview;
  const header = renderPageHeader(
    "Export & K-Anonymity Studio",
    "Aggregate-only exports with OWASP formula neutralization and small-cell suppression",
  );

  // AnalyticsAndReportingPatterns: Saved Report Presets sidebar + configuration card + preview + dispatch log
  const presetButtons = SAVED_REPORT_PRESETS.map(
    (p) => `
      <button type="button" data-report-preset="${p.id}" class="report-preset-btn w-full text-left px-3 py-2.5 rounded-[var(--dip-radius-md)] border border-[var(--dip-border)] hover:border-[var(--dip-border-strong)] bg-[var(--dip-bg-subtle)]/50 transition-colors space-y-0.5 cursor-pointer">
        <div class="text-xs font-semibold text-[var(--dip-text-primary)]">${escHtml(p.label)}</div>
        <div class="text-[11px] font-mono text-[var(--dip-text-muted)]">${p.dataset} · ${p.format.toUpperCase()} · min=${p.minCount}</div>
      </button>
    `,
  ).join("");

  const dispatchLogHtml =
    state.exportLog.length > 0
      ? `
      <section class="rounded-[var(--dip-radius-lg)] border border-[var(--dip-border)] bg-[var(--dip-bg-surface)] p-6 space-y-3">
        <h3 class="dip-font-display text-sm font-semibold text-[var(--dip-text-primary)]">Session Export Dispatch Log</h3>
        <ul class="divide-y divide-[var(--dip-border)] text-xs">
          ${state.exportLog
            .map(
              (item) => `
            <li class="flex items-center justify-between py-2 gap-3">
              <span class="font-medium text-[var(--dip-text-primary)] font-mono">${escHtml(item.dataset)} · ${escHtml(item.format)} (${item.rowCount} rows, ${item.suppressedRowCount} suppressed)</span>
              <div class="flex items-center gap-3">
                <span class="text-[var(--dip-text-muted)] font-mono dip-tabular">${escHtml(item.timestamp)}</span>
                ${renderStatusLabel("green", "Exported")}
              </div>
            </li>
          `,
            )
            .join("")}
        </ul>
      </section>
    `
      : "";

  return `
    ${header}
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <aside class="lg:col-span-4 rounded-[var(--dip-radius-lg)] border border-[var(--dip-border)] bg-[var(--dip-bg-surface)] p-5 space-y-4">
        <div>
          <h2 class="dip-font-display text-sm font-semibold text-[var(--dip-text-primary)]">Saved Report Presets</h2>
          <p class="text-xs text-[var(--dip-text-muted)] mt-1">One-click K-anonymity and financial report configurations</p>
        </div>
        <div class="space-y-2.5">${presetButtons}</div>
      </aside>

      <div class="lg:col-span-8 space-y-6">
        <section class="rounded-[var(--dip-radius-lg)] border border-[var(--dip-border)] bg-[var(--dip-bg-surface)] p-6 space-y-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="dip-font-display text-base font-semibold text-[var(--dip-text-primary)]">Export Parameters</h2>
            <div class="flex items-center gap-2 shrink-0">
              <button type="button" id="run-export-preview-btn" class="px-3.5 py-2 rounded-[var(--dip-radius-md)] text-xs font-medium border border-[var(--dip-border)] hover:bg-[var(--dip-bg-subtle)] transition-colors whitespace-nowrap">
                Refresh Preview
              </button>
              <button type="button" id="download-export-file-btn" class="px-4 py-2 rounded-[var(--dip-radius-md)] text-xs font-semibold bg-[var(--dip-accent)] hover:bg-[var(--dip-accent-hover)] text-[var(--dip-accent-fg)] transition-colors whitespace-nowrap">
                Download ${state.exportFormat.toUpperCase()}
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label class="space-y-1 text-xs">
              <span class="font-medium text-[var(--dip-text-secondary)]">Dataset</span>
              <select id="exp-dataset" class="w-full px-3 py-2 rounded-[var(--dip-radius-md)] border border-[var(--dip-border)] bg-[var(--dip-bg-subtle)] text-xs">
                <option value="regions"${state.exportDataset === "regions" ? " selected" : ""}>Geographic Regions (includes small cells)</option>
                <option value="services"${state.exportDataset === "services" ? " selected" : ""}>Service Performance</option>
                <option value="unit_economics"${state.exportDataset === "unit_economics" ? " selected" : ""}>Service Unit Economics</option>
              </select>
            </label>

            <label class="space-y-1 text-xs">
              <span class="font-medium text-[var(--dip-text-secondary)]">Format</span>
              <select id="exp-format" class="w-full px-3 py-2 rounded-[var(--dip-radius-md)] border border-[var(--dip-border)] bg-[var(--dip-bg-subtle)] text-xs">
                <option value="csv"${state.exportFormat === "csv" ? " selected" : ""}>CSV (RFC 4180 + OWASP Safe)</option>
                <option value="ndjson"${state.exportFormat === "ndjson" ? " selected" : ""}>NDJSON (Streaming Lines)</option>
                <option value="json"${state.exportFormat === "json" ? " selected" : ""}>JSON Report Envelope</option>
              </select>
            </label>

            <label class="space-y-1 text-xs">
              <span class="font-medium text-[var(--dip-text-secondary)]">K-Anonymity Threshold</span>
              <select id="exp-min-count" class="w-full px-3 py-2 rounded-[var(--dip-radius-md)] border border-[var(--dip-border)] bg-[var(--dip-bg-subtle)] text-xs">
                <option value="0"${state.exportMinCount === 0 ? " selected" : ""}>Disabled (0)</option>
                <option value="5"${state.exportMinCount === 5 ? " selected" : ""}>Minimum 5 records</option>
                <option value="15"${state.exportMinCount === 15 ? " selected" : ""}>Minimum 15 records</option>
              </select>
            </label>

            <label class="space-y-1 text-xs">
              <span class="font-medium text-[var(--dip-text-secondary)]">Small-Cell Policy</span>
              <select id="exp-mode" class="w-full px-3 py-2 rounded-[var(--dip-radius-md)] border border-[var(--dip-border)] bg-[var(--dip-bg-subtle)] text-xs">
                <option value="suppress"${state.exportMode === "suppress" ? " selected" : ""}>Omit small rows (suppress)</option>
                <option value="rollup_other"${state.exportMode === "rollup_other" ? " selected" : ""}>Roll into __suppressed_small_cells__</option>
              </select>
            </label>
          </div>

          ${
            preview
              ? `
            <div class="space-y-2 pt-2 border-t border-[var(--dip-border)]">
              <div class="text-xs text-[var(--dip-text-muted)] font-mono dip-tabular">
                Format: ${escHtml(preview.format.toUpperCase())} · Output rows: ${preview.rowCount} · Suppressed small cells: ${preview.suppressedRowCount}
              </div>
              <pre class="p-4 rounded-[var(--dip-radius-md)] bg-[#0b0f17] text-slate-100 font-mono text-xs overflow-x-auto max-h-80 leading-relaxed">${escHtml(preview.content)}</pre>
            </div>
          `
              : `<p class="text-xs text-[var(--dip-text-muted)]">Loading export preview...</p>`
          }
        </section>

        ${dispatchLogHtml}
      </div>
    </div>
  `;
}

function renderGovernanceView(): string {
  const header = renderPageHeader(
    "Privacy, Tenant Isolation & Contracts",
    "Interactive validation against PII rejection, prototype-pollution protection, and fail-closed tenant boundaries",
  );

  return `
    ${header}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section class="rounded-[var(--dip-radius-lg)] border border-[var(--dip-border)] bg-[var(--dip-bg-surface)] p-6 space-y-4">
        <div class="flex items-baseline justify-between gap-2">
          <h2 class="dip-font-display text-base font-semibold text-[var(--dip-text-primary)]">Live Event &amp; PII Guard Validator</h2>
          <span class="text-xs text-[var(--dip-text-muted)] font-mono">validateAnalyticsEvent()</span>
        </div>

        <div class="flex flex-wrap gap-2">
          <button type="button" data-preset="valid" class="preset-btn px-3 py-1.5 rounded-[var(--dip-radius-md)] text-xs font-medium border border-[var(--dip-border)] hover:bg-[var(--dip-bg-subtle)]">Valid Event</button>
          <button type="button" data-preset="pii_aadhaar" class="preset-btn px-3 py-1.5 rounded-[var(--dip-radius-md)] text-xs font-medium border border-[var(--dip-border)] hover:bg-[var(--dip-bg-subtle)]">PII / Aadhaar</button>
          <button type="button" data-preset="document_uri" class="preset-btn px-3 py-1.5 rounded-[var(--dip-radius-md)] text-xs font-medium border border-[var(--dip-border)] hover:bg-[var(--dip-bg-subtle)]">Document Data URI</button>
          <button type="button" data-preset="unknown_safe" class="preset-btn px-3 py-1.5 rounded-[var(--dip-radius-md)] text-xs font-medium border border-[var(--dip-border)] hover:bg-[var(--dip-bg-subtle)]">Unknown Field</button>
        </div>

        <textarea
          id="validator-json-input"
          rows="10"
          aria-label="Event JSON payload to validate"
          class="w-full p-3 rounded-[var(--dip-radius-md)] border border-[var(--dip-border)] bg-[var(--dip-bg-subtle)] font-mono text-xs text-[var(--dip-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--dip-focus-ring)]"
        >${escHtml(state.validatorInput)}</textarea>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <label class="flex items-center gap-2 text-xs text-[var(--dip-text-secondary)]">
            <span>Unknown Field Policy</span>
            <select id="validator-policy" class="px-2.5 py-1.5 rounded-[var(--dip-radius-md)] border border-[var(--dip-border)] bg-[var(--dip-bg-subtle)] text-xs">
              <option value="reject"${state.validatorPolicy === "reject" ? " selected" : ""}>reject</option>
              <option value="strip_and_audit"${state.validatorPolicy === "strip_and_audit" ? " selected" : ""}>strip_and_audit</option>
            </select>
          </label>
          <button type="button" id="run-validator-btn" class="px-4 py-2 rounded-[var(--dip-radius-md)] text-xs font-semibold bg-[var(--dip-accent)] hover:bg-[var(--dip-accent-hover)] text-[var(--dip-accent-fg)] transition-colors">
            Validate Event
          </button>
        </div>

        ${
          state.validatorResult
            ? `<pre class="p-3.5 rounded-[var(--dip-radius-md)] bg-[#0b0f17] text-slate-100 font-mono text-xs overflow-x-auto max-h-64">${escHtml(state.validatorResult)}</pre>`
            : ""
        }
      </section>

      <div class="space-y-6">
        <section class="rounded-[var(--dip-radius-lg)] border border-[var(--dip-border)] bg-[var(--dip-bg-surface)] p-6 space-y-4">
          <h2 class="dip-font-display text-base font-semibold text-[var(--dip-text-primary)]">Tenant Isolation Boundary Probe</h2>
          <p class="text-xs text-[var(--dip-text-secondary)]">
            Tests <code>authorizeTenantQuery()</code> when a client requests a tenant differing from the verified backend session (<code>${escHtml(state.tenantId)}</code>).
          </p>
          <div class="flex flex-wrap items-center gap-3">
            <select id="boundary-requested-tenant" class="px-3 py-2 rounded-[var(--dip-radius-md)] border border-[var(--dip-border)] bg-[var(--dip-bg-subtle)] text-xs">
              <option value="tenant_beta"${state.boundaryRequestedTenant === "tenant_beta" ? " selected" : ""}>Request tenant_beta</option>
              <option value="tenant_alpha"${state.boundaryRequestedTenant === "tenant_alpha" ? " selected" : ""}>Request tenant_alpha</option>
              <option value="tenant_unauthorized"${state.boundaryRequestedTenant === "tenant_unauthorized" ? " selected" : ""}>Request tenant_unauthorized</option>
            </select>
            <button type="button" id="run-boundary-probe-btn" class="px-4 py-2 rounded-[var(--dip-radius-md)] text-xs font-semibold border border-[var(--dip-border)] hover:bg-[var(--dip-bg-subtle)] transition-colors">
              Test Authorization
            </button>
          </div>
          ${
            state.boundaryResult
              ? `<pre class="p-3.5 rounded-[var(--dip-radius-md)] bg-[#0b0f17] text-slate-100 font-mono text-xs overflow-x-auto">${escHtml(state.boundaryResult)}</pre>`
              : ""
          }
        </section>

        <section class="rounded-[var(--dip-radius-lg)] border border-[var(--dip-border)] bg-[var(--dip-bg-surface)] p-6 space-y-3">
          <div class="flex items-center justify-between gap-2">
            <h2 class="dip-font-display text-base font-semibold text-[var(--dip-text-primary)]">Contract &amp; Integration Manifest</h2>
            <button type="button" id="load-manifest-btn" class="px-3 py-1.5 rounded-[var(--dip-radius-md)] text-xs font-medium border border-[var(--dip-border)] hover:bg-[var(--dip-bg-subtle)]">
              Load /manifest
            </button>
          </div>
          ${
            state.contractCatalogJson
              ? `<pre class="p-3.5 rounded-[var(--dip-radius-md)] bg-[#0b0f17] text-slate-100 font-mono text-xs overflow-x-auto max-h-64">${escHtml(state.contractCatalogJson)}</pre>`
              : `<p class="text-xs text-[var(--dip-text-muted)]">Click "Load /manifest" to inspect live ecosystem contracts and security invariants.</p>`
          }
        </section>
      </div>
    </div>
  `;
}

function renderViewport(): void {
  const viewport = document.getElementById("main-viewport");
  if (!viewport) return;

  updateHeaderAndMeta();

  if (state.loading && !state.overview) {
    viewport.innerHTML = renderLoadingSkeleton();
    return;
  }

  if (state.errorMessage) {
    viewport.innerHTML = `
      <div class="rounded-[var(--dip-radius-lg)] bg-[var(--dip-bg-surface)] border border-[var(--dip-danger)] p-6 space-y-3">
        <div class="text-sm font-semibold text-[var(--dip-danger)]">Error Loading Workbench</div>
        <p class="text-xs text-[var(--dip-text-secondary)]">${escHtml(state.errorMessage)}</p>
        <button type="button" id="retry-fetch-btn" class="px-4 py-2 rounded-[var(--dip-radius-md)] text-xs font-semibold bg-[var(--dip-accent)] text-[var(--dip-accent-fg)]">Retry</button>
      </div>
    `;
    document.getElementById("retry-fetch-btn")?.addEventListener("click", () => {
      void fetchOverview();
    });
    return;
  }

  const data = state.overview;
  if (!data) return;

  switch (state.activeView) {
    case "executive":
      viewport.innerHTML = renderExecutiveView(data);
      break;
    case "operations":
      viewport.innerHTML = renderOperationsView(data);
      break;
    case "finance":
      viewport.innerHTML = renderFinanceView(data);
      break;
    case "entities":
      viewport.innerHTML = renderEntitiesView(data);
      break;
    case "api":
      viewport.innerHTML = renderApiView(data);
      break;
    case "export":
      viewport.innerHTML = renderExportView();
      break;
    case "governance":
      viewport.innerHTML = renderGovernanceView();
      break;
  }

  bindViewportHandlers();
}

function bindViewportHandlers(): void {
  document.getElementById("reset-filters-btn")?.addEventListener("click", () => {
    state.serviceCode = "";
    state.currency = "";
    const svcSelect = document.getElementById("filter-service") as HTMLSelectElement | null;
    const curSelect = document.getElementById("filter-currency") as HTMLSelectElement | null;
    if (svcSelect) svcSelect.value = "";
    if (curSelect) curSelect.value = "";
    void fetchOverview();
  });

  document.querySelectorAll<HTMLButtonElement>(".trend-legend-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset["trendToggle"];
      if (!id) return;
      if (state.hiddenTrendSeries.has(id)) state.hiddenTrendSeries.delete(id);
      else state.hiddenTrendSeries.add(id);
      renderViewport();
    });
  });

  document.querySelectorAll<HTMLButtonElement>(".donut-legend-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset["donutToggle"];
      if (!id) return;
      if (state.hiddenDonutIds.has(id)) state.hiddenDonutIds.delete(id);
      else state.hiddenDonutIds.add(id);
      renderViewport();
    });
  });

  document.querySelectorAll<HTMLButtonElement>(".svc-catalogue-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      const code = btn.dataset["filterServiceCard"] ?? "";
      state.serviceCode = state.serviceCode === code ? "" : code;
      const svcSelect = document.getElementById("filter-service") as HTMLSelectElement | null;
      if (svcSelect) svcSelect.value = state.serviceCode;
      void fetchOverview();
    });
  });

  document.querySelectorAll<HTMLButtonElement>(".fin-method-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.financeMethodFilter = btn.dataset["finMethod"] ?? "all";
      renderViewport();
    });
  });

  document.querySelectorAll<HTMLButtonElement>(".entity-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset["entityTab"];
      if (tab === "partners" || tab === "operators" || tab === "services") {
        state.entitiesTab = tab;
        renderViewport();
      }
    });
  });

  const searchInput = document.getElementById("entity-search-input") as HTMLInputElement | null;
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      state.entitiesSearch = searchInput.value;
      const cursorPos = searchInput.selectionStart ?? searchInput.value.length;
      renderViewport();
      const restored = document.getElementById("entity-search-input") as HTMLInputElement | null;
      if (restored) {
        restored.focus();
        restored.setSelectionRange(cursorPos, cursorPos);
      }
    });
  }

  document.querySelectorAll<HTMLButtonElement>(".report-preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const preset = SAVED_REPORT_PRESETS.find((p) => p.id === btn.dataset["reportPreset"]);
      if (!preset) return;
      state.exportDataset = preset.dataset;
      state.exportFormat = preset.format;
      state.exportMinCount = preset.minCount;
      state.exportMode = preset.mode;
      void fetchExportPreview(false);
    });
  });

  document.getElementById("exp-dataset")?.addEventListener("change", (e) => {
    state.exportDataset = (e.target as HTMLSelectElement).value as AppState["exportDataset"];
    void fetchExportPreview(false);
  });
  document.getElementById("exp-format")?.addEventListener("change", (e) => {
    state.exportFormat = (e.target as HTMLSelectElement).value as AppState["exportFormat"];
    void fetchExportPreview(false);
  });
  document.getElementById("exp-min-count")?.addEventListener("change", (e) => {
    state.exportMinCount = Number((e.target as HTMLSelectElement).value);
    void fetchExportPreview(false);
  });
  document.getElementById("exp-mode")?.addEventListener("change", (e) => {
    state.exportMode = (e.target as HTMLSelectElement).value as AppState["exportMode"];
    void fetchExportPreview(false);
  });
  document.getElementById("run-export-preview-btn")?.addEventListener("click", () => {
    void fetchExportPreview(false);
  });
  document.getElementById("download-export-file-btn")?.addEventListener("click", () => {
    void fetchExportPreview(true);
  });

  document.querySelectorAll<HTMLButtonElement>(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset["preset"] ?? "valid";
      const preset = PRESET_EVENTS[key] ?? PRESET_EVENTS["valid"];
      state.validatorInput = JSON.stringify(preset, null, 2);
      state.validatorResult = null;
      renderViewport();
    });
  });

  const valTextarea = document.getElementById("validator-json-input") as HTMLTextAreaElement | null;
  valTextarea?.addEventListener("input", () => {
    state.validatorInput = valTextarea.value;
  });

  document.getElementById("validator-policy")?.addEventListener("change", (e) => {
    state.validatorPolicy = (e.target as HTMLSelectElement).value as AppState["validatorPolicy"];
  });

  document.getElementById("run-validator-btn")?.addEventListener("click", () => {
    void (async () => {
      try {
        const parsed = JSON.parse(state.validatorInput) as unknown;
        const res = await fetch("/api/workbench/validate-event", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ event: parsed, unknownFieldPolicy: state.validatorPolicy }),
        });
        const body = await res.json();
        state.validatorResult = JSON.stringify(body, null, 2);
      } catch (err) {
        state.validatorResult = JSON.stringify(
          { valid: false, error: "CLIENT_PARSE_ERROR", message: String(err) },
          null,
          2,
        );
      }
      renderViewport();
    })();
  });

  document.getElementById("boundary-requested-tenant")?.addEventListener("change", (e) => {
    state.boundaryRequestedTenant = (e.target as HTMLSelectElement).value;
  });

  document.getElementById("run-boundary-probe-btn")?.addEventListener("click", () => {
    void (async () => {
      const res = await fetch("/api/workbench/test-tenant-boundary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          authenticatedTenantId: state.tenantId,
          requestedTenantId: state.boundaryRequestedTenant,
        }),
      });
      const body = (await res.json()) as Record<string, unknown>;
      state.boundaryResult = JSON.stringify({ httpStatus: res.status, ...body }, null, 2);
      renderViewport();
    })();
  });

  document.getElementById("load-manifest-btn")?.addEventListener("click", () => {
    void (async () => {
      const res = await fetch("/manifest");
      const body = await res.json();
      state.contractCatalogJson = JSON.stringify(body, null, 2);
      renderViewport();
    })();
  });
}

function setMobileSidebarOpen(open: boolean): void {
  const sidebar = document.getElementById("workspace-sidebar");
  const backdrop = document.getElementById("mobile-sidebar-backdrop");
  if (!sidebar || !backdrop) return;
  if (open) {
    sidebar.classList.remove("-translate-x-full");
    backdrop.classList.remove("hidden");
  } else {
    sidebar.classList.add("-translate-x-full");
    backdrop.classList.add("hidden");
  }
}

function bootstrap(): void {
  document.querySelectorAll<HTMLButtonElement>(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset["view"] as ViewKey | undefined;
      if (!view) return;
      state.activeView = view;
      setMobileSidebarOpen(false);
      if (view === "export" && !state.exportPreview) {
        void fetchExportPreview(false);
      } else {
        renderViewport();
      }
    });
  });

  document.getElementById("open-sidebar-btn")?.addEventListener("click", () => {
    setMobileSidebarOpen(true);
  });
  document.getElementById("close-sidebar-btn")?.addEventListener("click", () => {
    setMobileSidebarOpen(false);
  });
  document.getElementById("mobile-sidebar-backdrop")?.addEventListener("click", () => {
    setMobileSidebarOpen(false);
  });

  document.getElementById("collapse-sidebar-btn")?.addEventListener("click", () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    updateHeaderAndMeta();
  });

  const themeBtn = document.getElementById("theme-toggle-btn");
  themeBtn?.addEventListener("click", () => {
    state.darkMode = !state.darkMode;
    document.documentElement.classList.toggle("dark", state.darkMode);
    themeBtn.textContent = state.darkMode ? "Light Mode" : "Dark Mode";
  });

  document.getElementById("quick-export-csv-btn")?.addEventListener("click", () => {
    void (async () => {
      state.exportFormat = "csv";
      await fetchExportPreview(true);
    })();
  });

  document.getElementById("filter-tenant")?.addEventListener("change", (e) => {
    state.tenantId = (e.target as HTMLSelectElement).value;
    state.serviceCode = "";
    state.hiddenDonutIds.clear();
    state.exportPreview = null;
    void fetchOverview();
  });

  document.getElementById("filter-timezone")?.addEventListener("change", (e) => {
    state.timeZone = (e.target as HTMLSelectElement).value;
    void fetchOverview();
  });

  document.getElementById("filter-service")?.addEventListener("change", (e) => {
    state.serviceCode = (e.target as HTMLSelectElement).value;
    void fetchOverview();
  });

  document.getElementById("filter-currency")?.addEventListener("change", (e) => {
    state.currency = (e.target as HTMLSelectElement).value;
    void fetchOverview();
  });

  document.querySelectorAll<HTMLButtonElement>(".gran-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const g = btn.dataset["granularity"];
      if (g === "day" || g === "week") {
        state.granularity = g;
        void fetchOverview();
      }
    });
  });

  void fetchOverview();
}

bootstrap();
