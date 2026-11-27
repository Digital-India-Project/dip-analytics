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
  readonly successfulPaymentCount: number;
  readonly refundCount: number;
  readonly grossRevenueMinor: number;
  readonly totalFeesMinor: number;
  readonly netRevenueBeforeRefundsMinor: number;
  readonly totalRefundedMinor: number;
  readonly netRevenueAfterRefundsMinor: number;
  readonly refundRateBps: number | null;
  readonly formattedGrossRevenue: string;
  readonly formattedNetAfterRefunds: string;
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
      readonly sla: {
        readonly totalCompletedEvaluated: number;
        readonly withinSlaTargetCount: number;
        readonly slaComplianceRateBps: number | null;
        readonly warningBreachCount: number;
        readonly criticalBreachCount: number;
        readonly overallDuration: DurationSummary;
        readonly stageBottlenecks: readonly {
          readonly serviceCode: string;
          readonly stageCode: string;
          readonly breachCount: number;
          readonly maxOverrunMs: number;
        }[];
      };
      readonly revenue: {
        readonly currencies: readonly CurrencyFinancialRow[];
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
        readonly countsByStatus: Record<string, number>;
      };
    };
    readonly finance: {
      readonly paymentMetrics: {
        readonly initiatedCount: number;
        readonly succeededCount: number;
        readonly failedCount: number;
        readonly refundedCount: number;
        readonly successRateBps: number | null;
        readonly byMethod: readonly {
          readonly method: string;
          readonly initiatedCount: number;
          readonly succeededCount: number;
          readonly failedCount: number;
          readonly successRateBps: number | null;
        }[];
      };
      readonly reconciliation: {
        readonly totalTrackedPayments: number;
        readonly settledCount: number;
        readonly failedOnlyCount: number;
        readonly unsettledInitiatedCount: number;
        readonly orphanedRefundCount: number;
        readonly overRefundedCount: number;
        readonly currencyDiscrepancyCount: number;
        readonly totalsByCurrency: readonly {
          readonly currency: string;
          readonly settledGrossMinor: number;
          readonly refundedMinor: number;
          readonly netReconciledMinor: number;
        }[];
      };
    };
    readonly partners: {
      readonly partnerPerformance: {
        readonly partners: readonly {
          readonly partnerRef: string;
          readonly assignedCount: number;
          readonly completedCount: number;
          readonly returnedCount: number;
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
          readonly queuesTouchedCount: number;
          readonly approvalRateBps: number | null;
          readonly escalationRateBps: number | null;
          readonly handlingDuration: DurationSummary;
        }[];
        readonly byQueue: readonly {
          readonly queueCode: string;
          readonly totalActions: number;
          readonly distinctOperatorsCount: number;
          readonly handlingDuration: DurationSummary;
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
        readonly success2xxCount: number;
        readonly clientError4xxCount: number;
        readonly serverError5xxCount: number;
        readonly errorRateBps: number | null;
        readonly serverErrorRateBps: number | null;
        readonly overallLatency: DurationSummary;
        readonly endpoints: readonly {
          readonly endpointKey: string;
          readonly totalRequests: number;
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

const VIEW_TITLES: Record<ViewKey, string> = {
  executive: "Executive Overview",
  operations: "Operations & Backlog",
  finance: "Finance & Unit Economics",
  entities: "Partners, Operators & Services",
  api: "API Health & Anomalies",
  export: "Export & K-Anonymity Studio",
  governance: "Privacy, Tenant & Schemas",
};

interface AppState {
  activeView: ViewKey;
  tenantId: string;
  timeZone: string;
  granularity: "day" | "week";
  serviceCode: string;
  currency: string;
  entitiesTab: "partners" | "operators" | "services";
  entitiesSearch: string;
  exportDataset: "regions" | "services" | "unit_economics";
  exportFormat: "csv" | "ndjson" | "json";
  exportMinCount: number;
  exportMode: "suppress" | "rollup_other";
  exportPreview: ExportPreviewResponse | null;
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
  tenantId: "tenant_alpha",
  timeZone: "Asia/Kolkata",
  granularity: "day",
  serviceCode: "",
  currency: "",
  entitiesTab: "partners",
  entitiesSearch: "",
  exportDataset: "regions",
  exportFormat: "csv",
  exportMinCount: 5,
  exportMode: "suppress",
  exportPreview: null,
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

  document.querySelectorAll<HTMLButtonElement>(".nav-item").forEach((btn) => {
    const active = btn.dataset["view"] === state.activeView;
    btn.className = `nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-600 ${
      active
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
    }`;
  });

  document.querySelectorAll<HTMLButtonElement>(".gran-btn").forEach((btn) => {
    const active = btn.dataset["granularity"] === state.granularity;
    btn.className = `gran-btn px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
      active
        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs"
        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
    }`;
  });
}

function renderLoadingSkeleton(): string {
  return `
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 animate-pulse">
      ${[1, 2, 3, 4]
        .map(
          () => `
        <div class="h-28 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
          <div class="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded mb-4"></div>
          <div class="h-7 w-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
        </div>
      `,
        )
        .join("")}
    </div>
    <div class="h-72 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse"></div>
  `;
}

function renderEmptyState(reason: string): string {
  return `
    <div class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-10 text-center space-y-4">
      <h2 class="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">No Matching Events in Window</h2>
      <p class="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">${escHtml(reason)}</p>
      <button type="button" id="reset-filters-btn" class="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors">
        Reset Active Filters
      </button>
    </div>
  `;
}

function renderTrendSvgChart(buckets: readonly TimeSeriesBucket[]): string {
  if (buckets.length === 0) {
    return `<p class="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">No time-series buckets available.</p>`;
  }

  const width = 920;
  const height = 240;
  const padLeft = 42;
  const padRight = 20;
  const padTop = 18;
  const padBottom = 34;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const maxSubmitted = Math.max(
    1,
    ...buckets.map((b) => Math.max(b.applicationsSubmitted, b.applicationsCompleted, b.slaBreaches)),
  );
  const stepX = chartW / buckets.length;
  const barW = Math.max(6, Math.min(28, stepX * 0.56));

  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const y = padTop + chartH * (1 - ratio);
      const val = Math.round(maxSubmitted * ratio);
      return `
        <line x1="${padLeft}" y1="${y.toFixed(1)}" x2="${width - padRight}" y2="${y.toFixed(1)}" stroke="currentColor" stroke-opacity="0.09" stroke-dasharray="3 3" />
        <text x="${padLeft - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="currentColor" fill-opacity="0.55" font-size="10" font-family="JetBrains Mono, monospace">${val}</text>
      `;
    })
    .join("");

  const bars = buckets
    .map((b, idx) => {
      const cx = padLeft + idx * stepX + stepX / 2;
      const subH = (b.applicationsSubmitted / maxSubmitted) * chartH;
      const cmpH = (b.applicationsCompleted / maxSubmitted) * chartH;
      const subY = padTop + chartH - subH;
      const cmpY = padTop + chartH - cmpH;
      const showLabel = buckets.length <= 16 || idx % 2 === 0;
      const shortLabel = b.bucketKey.length >= 10 ? b.bucketKey.slice(5, 10) : b.bucketKey;
      const breachMarker =
        b.slaBreaches > 1
          ? `<circle cx="${cx.toFixed(1)}" cy="${Math.max(padTop + 6, subY - 8).toFixed(1)}" r="3.5" fill="#D97706"><title>${escHtml(b.bucketKey)}: ${b.slaBreaches} SLA breaches</title></circle>`
          : "";

      return `
        <g>
          <rect x="${(cx - barW / 2).toFixed(1)}" y="${subY.toFixed(1)}" width="${(barW * 0.52).toFixed(1)}" height="${subH.toFixed(1)}" rx="2" fill="#2563EB">
            <title>${escHtml(b.bucketKey)} · Submitted: ${b.applicationsSubmitted} · Completed: ${b.applicationsCompleted} · SLA Breaches: ${b.slaBreaches}</title>
          </rect>
          <rect x="${(cx - barW / 2 + barW * 0.54).toFixed(1)}" y="${cmpY.toFixed(1)}" width="${(barW * 0.46).toFixed(1)}" height="${cmpH.toFixed(1)}" rx="2" fill="#16A34A" fill-opacity="0.85">
            <title>${escHtml(b.bucketKey)} · Completed: ${b.applicationsCompleted}</title>
          </rect>
          ${breachMarker}
          ${
            showLabel
              ? `<text x="${cx.toFixed(1)}" y="${height - 10}" text-anchor="middle" fill="currentColor" fill-opacity="0.6" font-size="10" font-family="JetBrains Mono, monospace">${escHtml(shortLabel)}</text>`
              : ""
          }
        </g>
      `;
    })
    .join("");

  return `
    <div class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>Submitted vs. Completed Applications by Bucket</span>
        <div class="flex items-center gap-4">
          <span class="inline-flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-xs bg-blue-600"></span>Submitted</span>
          <span class="inline-flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-xs bg-green-600"></span>Completed</span>
          <span class="inline-flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-amber-600"></span>SLA Spike (&gt;1)</span>
        </div>
      </div>
      <div class="w-full overflow-x-auto">
        <svg viewBox="0 0 ${width} ${height}" class="w-full min-w-[600px] h-56 text-slate-700 dark:text-slate-300" role="img" aria-label="Application submission and completion time-series chart">
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

  const primaryCurrency = exec.revenue.currencies[0];
  const secondaryCurrency = exec.revenue.currencies[1];

  const kpis = `
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <div class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
        <div class="text-xs font-medium text-slate-500 dark:text-slate-400">Applications Submitted</div>
        <div class="mt-2 font-display text-2xl font-bold text-slate-900 dark:text-slate-50 font-mono tabular-nums">${exec.funnel.submittedCount.toLocaleString("en-IN")}</div>
        <div class="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
          Completion ${fmtBps(exec.funnel.completionRateBps)} · Approval ${fmtBps(exec.funnel.approvalRateOfCompletedBps)}
        </div>
      </div>

      <div class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
        <div class="text-xs font-medium text-slate-500 dark:text-slate-400">Net Revenue After Refunds</div>
        <div class="mt-2 font-display text-2xl font-bold text-slate-900 dark:text-slate-50 font-mono tabular-nums">
          ${primaryCurrency ? escHtml(`${primaryCurrency.currency} ${primaryCurrency.formattedNetAfterRefunds}`) : "—"}
        </div>
        <div class="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
          ${secondaryCurrency ? `Also ${escHtml(`${secondaryCurrency.currency} ${secondaryCurrency.formattedNetAfterRefunds}`)}` : `Refund rate ${fmtBps(primaryCurrency?.refundRateBps)}`}
        </div>
      </div>

      <div class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
        <div class="text-xs font-medium text-slate-500 dark:text-slate-400">SLA Target Compliance</div>
        <div class="mt-2 font-display text-2xl font-bold text-slate-900 dark:text-slate-50 font-mono tabular-nums">${fmtBps(exec.sla.slaComplianceRateBps)}</div>
        <div class="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
          p95 ${fmtDurationMs(exec.sla.overallDuration.p95Ms)} · ${exec.sla.criticalBreachCount} critical breaches
        </div>
      </div>

      <div class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
        <div class="text-xs font-medium text-slate-500 dark:text-slate-400">API Requests &amp; Latency</div>
        <div class="mt-2 font-display text-2xl font-bold text-slate-900 dark:text-slate-50 font-mono tabular-nums">${exec.apiHealth.totalRequests.toLocaleString("en-IN")}</div>
        <div class="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
          Error ${fmtBps(exec.apiHealth.errorRateBps)} · p95 ${fmtDurationMs(exec.apiHealth.p95LatencyMs)}
        </div>
      </div>
    </div>
  `;

  const trendCard = `
    <section class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
      <div class="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h2 class="font-display text-base font-semibold text-slate-900 dark:text-slate-100">Lifecycle Volume &amp; SLA Trend</h2>
        <span class="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">${exec.trend.buckets.length} buckets · ${escHtml(data.activeProfile.defaultTimeZone)}</span>
      </div>
      ${renderTrendSvgChart(exec.trend.buckets)}
    </section>
  `;

  const regionRows = exec.geographic.regions
    .map(
      (r) => `
      <tr class="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
        <td class="py-2.5 pr-4 font-mono text-xs font-medium text-slate-900 dark:text-slate-100">${escHtml(r.regionCode)}</td>
        <td class="py-2.5 px-3 text-right font-mono text-xs tabular-nums">${r.submittedCount}</td>
        <td class="py-2.5 px-3 text-right font-mono text-xs tabular-nums">${r.completedCount}</td>
        <td class="py-2.5 px-3 text-right font-mono text-xs tabular-nums">${fmtBps(r.completionRateBps)}</td>
        <td class="py-2.5 pl-3 text-right font-mono text-xs tabular-nums">${r.slaBreachCount}</td>
      </tr>
    `,
    )
    .join("");

  const cohortRows = data.advanced.cohortRetention.cohorts
    .slice(0, 6)
    .map((c) => {
      const cells = [0, 1, 2]
        .map((offset) => {
          const p = c.periods[offset];
          return `<td class="py-2.5 px-3 text-right font-mono text-xs tabular-nums">${p ? `${fmtBps(p.retentionRateBps)} (${p.activeAccountsCount})` : "—"}</td>`;
        })
        .join("");
      return `
        <tr class="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
          <td class="py-2.5 pr-4 font-mono text-xs font-medium text-slate-900 dark:text-slate-100">${escHtml(c.cohortBucket)}</td>
          <td class="py-2.5 px-3 text-right font-mono text-xs tabular-nums">${c.cohortSize}</td>
          ${cells}
        </tr>
      `;
    })
    .join("");

  const bottomGrid = `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
        <div class="flex items-baseline justify-between gap-2 mb-4">
          <h2 class="font-display text-base font-semibold text-slate-900 dark:text-slate-100">Geographic Distribution</h2>
          <span class="text-xs text-slate-500 dark:text-slate-400">Aggregated by regionCode</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="text-xs font-medium text-slate-500 dark:text-slate-400">
                <th class="pb-2.5 pr-4">Region</th>
                <th class="pb-2.5 px-3 text-right">Submitted</th>
                <th class="pb-2.5 px-3 text-right">Completed</th>
                <th class="pb-2.5 px-3 text-right">Completion</th>
                <th class="pb-2.5 pl-3 text-right">Breaches</th>
              </tr>
            </thead>
            <tbody>${regionRows || `<tr><td colspan="5" class="py-4 text-xs text-slate-500">No regional rows</td></tr>`}</tbody>
          </table>
        </div>
      </section>

      <section class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
        <div class="flex items-baseline justify-between gap-2 mb-4">
          <h2 class="font-display text-base font-semibold text-slate-900 dark:text-slate-100">Account Cohort Retention</h2>
          <span class="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">${data.advanced.cohortRetention.trackedAccountsCount} opaque accounts · ${fmtBps(exec.accountActivity.repeatAccountRateBps)} repeat</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="text-xs font-medium text-slate-500 dark:text-slate-400">
                <th class="pb-2.5 pr-4">Cohort</th>
                <th class="pb-2.5 px-3 text-right">Size</th>
                <th class="pb-2.5 px-3 text-right">Period 0</th>
                <th class="pb-2.5 px-3 text-right">Period +1</th>
                <th class="pb-2.5 pl-3 text-right">Period +2</th>
              </tr>
            </thead>
            <tbody>${cohortRows || `<tr><td colspan="5" class="py-4 text-xs text-slate-500">No tracked account cohorts</td></tr>`}</tbody>
          </table>
        </div>
      </section>
    </div>
  `;

  return `${kpis}${trendCard}${bottomGrid}`;
}

function renderOperationsView(data: WorkbenchOverviewResponse): string {
  const ops = data.dashboards.operations;
  const sla = data.dashboards.executive.sla;
  const backlog = data.advanced.backlogAging;
  const stages = data.advanced.customFunnel.stages;

  const maxStage = Math.max(1, ...stages.map((s) => s.reachedCount));
  const funnelBars = stages
    .map((s) => {
      const pct = Math.round((s.reachedCount / maxStage) * 100);
      return `
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-slate-700 dark:text-slate-200 font-mono">${escHtml(s.stage)}</span>
            <span class="font-mono tabular-nums text-slate-500 dark:text-slate-400">${s.reachedCount} reached · ${fmtBps(s.conversionFromStartBps)} of start</span>
          </div>
          <div class="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div class="h-full bg-blue-600 rounded-full" style="width:${pct}%"></div>
          </div>
        </div>
      `;
    })
    .join("");

  const agingBands: Array<{ key: keyof typeof backlog.buckets; label: string; tone: string }> = [
    { key: "under_1h", label: "Under 1 hour", tone: "bg-green-600" },
    { key: "from_1h_to_24h", label: "1 to 24 hours", tone: "bg-blue-600" },
    { key: "from_1d_to_7d", label: "1 to 7 days", tone: "bg-amber-600" },
    { key: "over_7d", label: "Over 7 days (At Risk)", tone: "bg-red-600" },
  ];
  const maxOpen = Math.max(1, backlog.openApplicationsCount);

  const agingHtml = agingBands
    .map((b) => {
      const val = backlog.buckets[b.key];
      const pct = Math.round((val / maxOpen) * 100);
      return `
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-slate-700 dark:text-slate-200">${escHtml(b.label)}</span>
            <span class="font-mono tabular-nums text-slate-600 dark:text-slate-300">${val} open</span>
          </div>
          <div class="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div class="h-full ${b.tone} rounded-full" style="width:${pct}%"></div>
          </div>
        </div>
      `;
    })
    .join("");

  const bottleneckRows = sla.stageBottlenecks
    .map(
      (b) => `
      <tr class="border-t border-slate-100 dark:border-slate-800">
        <td class="py-2.5 pr-4 font-mono text-xs text-slate-900 dark:text-slate-100">${escHtml(b.serviceCode)}</td>
        <td class="py-2.5 px-3 font-mono text-xs text-slate-600 dark:text-slate-300">${escHtml(b.stageCode)}</td>
        <td class="py-2.5 px-3 text-right font-mono text-xs tabular-nums text-amber-700 dark:text-amber-400">${b.breachCount}</td>
        <td class="py-2.5 pl-3 text-right font-mono text-xs tabular-nums">${fmtDurationMs(b.maxOverrunMs)}</td>
      </tr>
    `,
    )
    .join("");

  const statusRows = Object.entries(ops.statusDistribution.countsByStatus)
    .map(
      ([status, count]) => `
      <tr class="border-t border-slate-100 dark:border-slate-800">
        <td class="py-2.5 pr-4 font-mono text-xs text-slate-900 dark:text-slate-100">${escHtml(status)}</td>
        <td class="py-2.5 pl-3 text-right font-mono text-xs tabular-nums">${count}</td>
      </tr>
    `,
    )
    .join("");

  return `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div class="flex items-baseline justify-between gap-2">
          <h2 class="font-display text-base font-semibold text-slate-900 dark:text-slate-100">Custom-Stage Application Funnel</h2>
          <span class="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">${ops.statusDistribution.trackedApplicationsCount} tracked</span>
        </div>
        <div class="space-y-4">${funnelBars}</div>
      </section>

      <section class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div class="flex items-baseline justify-between gap-2">
          <h2 class="font-display text-base font-semibold text-slate-900 dark:text-slate-100">Open Backlog Aging Histogram</h2>
          <span class="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">${backlog.openApplicationsCount} open · oldest ${fmtDurationMs(backlog.oldestOpenAgeMs)}</span>
        </div>
        <div class="space-y-4">${agingHtml}</div>
      </section>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
        <h2 class="font-display text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">SLA Stage Bottlenecks</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="text-xs font-medium text-slate-500 dark:text-slate-400">
                <th class="pb-2.5 pr-4">Service</th>
                <th class="pb-2.5 px-3">Stage</th>
                <th class="pb-2.5 px-3 text-right">Breaches</th>
                <th class="pb-2.5 pl-3 text-right">Max Overrun</th>
              </tr>
            </thead>
            <tbody>${bottleneckRows || `<tr><td colspan="4" class="py-4 text-xs text-slate-500">Zero SLA stage bottlenecks detected.</td></tr>`}</tbody>
          </table>
        </div>
      </section>

      <section class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
        <h2 class="font-display text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Current Status Distribution</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="text-xs font-medium text-slate-500 dark:text-slate-400">
                <th class="pb-2.5 pr-4">Latest Status</th>
                <th class="pb-2.5 pl-3 text-right">Applications</th>
              </tr>
            </thead>
            <tbody>${statusRows}</tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

function renderFinanceView(data: WorkbenchOverviewResponse): string {
  const fin = data.dashboards.finance;
  const econ = data.advanced.unitEconomics;

  const currencyRows = data.dashboards.executive.revenue.currencies
    .map(
      (c) => `
      <tr class="border-t border-slate-100 dark:border-slate-800">
        <td class="py-2.5 pr-4 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">${escHtml(c.currency)}</td>
        <td class="py-2.5 px-3 text-right font-mono text-xs tabular-nums">${escHtml(fmtMinor(c.grossRevenueMinor, c.currency))}</td>
        <td class="py-2.5 px-3 text-right font-mono text-xs tabular-nums">${escHtml(fmtMinor(c.totalFeesMinor, c.currency))}</td>
        <td class="py-2.5 px-3 text-right font-mono text-xs tabular-nums">${escHtml(fmtMinor(c.totalRefundedMinor, c.currency))}</td>
        <td class="py-2.5 pl-3 text-right font-mono text-xs tabular-nums font-semibold text-green-700 dark:text-green-400">${escHtml(fmtMinor(c.netRevenueAfterRefundsMinor, c.currency))}</td>
      </tr>
    `,
    )
    .join("");

  const unitRows = econ.rows
    .map(
      (r) => `
      <tr class="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
        <td class="py-2.5 pr-4 font-mono text-xs font-medium text-slate-900 dark:text-slate-100">${escHtml(r.serviceCode)}</td>
        <td class="py-2.5 px-2 font-mono text-xs">${escHtml(r.currency)}</td>
        <td class="py-2.5 px-3 text-right font-mono text-xs tabular-nums">${r.completedApplicationsCount}</td>
        <td class="py-2.5 px-3 text-right font-mono text-xs tabular-nums">${escHtml(fmtMinor(r.grossRevenueMinor, r.currency))}</td>
        <td class="py-2.5 px-3 text-right font-mono text-xs tabular-nums">${escHtml(fmtMinor(r.gatewayFeesMinor + r.refundedMinor + r.partnerCommissionMinor, r.currency))}</td>
        <td class="py-2.5 px-3 text-right font-mono text-xs tabular-nums font-semibold">${escHtml(fmtMinor(r.netContributionMinor, r.currency))}</td>
        <td class="py-2.5 pl-3 text-right font-mono text-xs tabular-nums">${fmtBps(r.netMarginBps)}</td>
      </tr>
    `,
    )
    .join("");

  const rec = fin.reconciliation;
  return `
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <div class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
        <div class="text-xs font-medium text-slate-500 dark:text-slate-400">Payment Success Rate</div>
        <div class="mt-2 font-display text-2xl font-bold font-mono tabular-nums">${fmtBps(fin.paymentMetrics.successRateBps)}</div>
        <div class="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">${fin.paymentMetrics.succeededCount} succeeded · ${fin.paymentMetrics.failedCount} failed</div>
      </div>
      <div class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
        <div class="text-xs font-medium text-slate-500 dark:text-slate-400">Reconciled Settled</div>
        <div class="mt-2 font-display text-2xl font-bold font-mono tabular-nums text-green-700 dark:text-green-400">${rec.settledCount}</div>
        <div class="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">of ${rec.totalTrackedPayments} payment references</div>
      </div>
      <div class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
        <div class="text-xs font-medium text-slate-500 dark:text-slate-400">Unsettled Initiated</div>
        <div class="mt-2 font-display text-2xl font-bold font-mono tabular-nums text-amber-700 dark:text-amber-400">${rec.unsettledInitiatedCount}</div>
        <div class="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">${rec.failedOnlyCount} terminal failures</div>
      </div>
      <div class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
        <div class="text-xs font-medium text-slate-500 dark:text-slate-400">Discrepancies</div>
        <div class="mt-2 font-display text-2xl font-bold font-mono tabular-nums">${rec.orphanedRefundCount + rec.overRefundedCount + rec.currencyDiscrepancyCount}</div>
        <div class="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">Orphan ${rec.orphanedRefundCount} · Over-refund ${rec.overRefundedCount}</div>
      </div>
    </div>

    <section class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
      <div class="flex items-baseline justify-between gap-2 mb-4">
        <h2 class="font-display text-base font-semibold text-slate-900 dark:text-slate-100">Currency-Separated Financial Ledger</h2>
        <span class="text-xs text-slate-500 dark:text-slate-400">BigInt minor-unit arithmetic (zero floating-point drift)</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="text-xs font-medium text-slate-500 dark:text-slate-400">
              <th class="pb-2.5 pr-4">Currency</th>
              <th class="pb-2.5 px-3 text-right">Gross Revenue</th>
              <th class="pb-2.5 px-3 text-right">Gateway Fees</th>
              <th class="pb-2.5 px-3 text-right">Refunded</th>
              <th class="pb-2.5 pl-3 text-right">Net After Refunds</th>
            </tr>
          </thead>
          <tbody>${currencyRows || `<tr><td colspan="5" class="py-4 text-xs text-slate-500">No financial transactions in window.</td></tr>`}</tbody>
        </table>
      </div>
    </section>

    <section class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
      <div class="flex items-baseline justify-between gap-2 mb-4">
        <h2 class="font-display text-base font-semibold text-slate-900 dark:text-slate-100">Service Unit Economics &amp; Net Margin</h2>
        <span class="text-xs text-slate-500 dark:text-slate-400">Gross minus fees, refunds &amp; partner commissions</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="text-xs font-medium text-slate-500 dark:text-slate-400">
              <th class="pb-2.5 pr-4">Service</th>
              <th class="pb-2.5 px-2">Cur</th>
              <th class="pb-2.5 px-3 text-right">Completed</th>
              <th class="pb-2.5 px-3 text-right">Gross</th>
              <th class="pb-2.5 px-3 text-right">Total Costs</th>
              <th class="pb-2.5 px-3 text-right">Net Contribution</th>
              <th class="pb-2.5 pl-3 text-right">Net Margin</th>
            </tr>
          </thead>
          <tbody>${unitRows || `<tr><td colspan="7" class="py-4 text-xs text-slate-500">No service unit economics rows.</td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderEntitiesView(data: WorkbenchOverviewResponse): string {
  const q = state.entitiesSearch.trim().toLowerCase();
  const tabBar = `
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div class="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        ${(["partners", "operators", "services"] as const)
          .map(
            (t) => `
          <button type="button" data-entity-tab="${t}" class="entity-tab-btn px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            state.entitiesTab === t
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs"
              : "text-slate-600 dark:text-slate-300"
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
        placeholder="Filter by reference or code..."
        class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 w-full sm:w-64 focus-visible:outline-2 focus-visible:outline-blue-600"
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
          <tr class="border-t border-slate-100 dark:border-slate-800">
            <td class="py-2.5 pr-4 font-mono text-xs font-medium text-slate-900 dark:text-slate-100">${escHtml(p.partnerRef)}</td>
            <td class="py-2.5 px-3 text-right font-mono text-xs tabular-nums">${p.assignedCount}</td>
            <td class="py-2.5 px-3 text-right font-mono text-xs tabular-nums">${p.completedCount}</td>
            <td class="py-2.5 px-3 text-right font-mono text-xs tabular-nums">${fmtBps(p.completionRateBps)}</td>
            <td class="py-2.5 px-3 text-right font-mono text-xs tabular-nums">${fmtDurationMs(p.turnaround.p50Ms)}</td>
            <td class="py-2.5 pl-3 text-right font-mono text-xs tabular-nums">${escHtml(comm || "—")}</td>
          </tr>
        `;
      })
      .join("");
    tableHtml = `
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="text-xs font-medium text-slate-500 dark:text-slate-400">
            <th class="pb-2.5 pr-4">Partner Ref</th>
            <th class="pb-2.5 px-3 text-right">Assigned</th>
            <th class="pb-2.5 px-3 text-right">Completed</th>
            <th class="pb-2.5 px-3 text-right">Completion</th>
            <th class="pb-2.5 px-3 text-right">p50 Turnaround</th>
            <th class="pb-2.5 pl-3 text-right">Commissions</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="6" class="py-4 text-xs text-slate-500">No partner records match filter.</td></tr>`}</tbody>
      </table>
    `;
  } else if (state.entitiesTab === "operators") {
    const rows = data.dashboards.operators.operatorWorkload.operators
      .filter((o) => !q || o.operatorRef.toLowerCase().includes(q))
      .map(
        (o) => `
        <tr class="border-t border-slate-100 dark:border-slate-800">
          <td class="py-2.5 pr-4 font-mono text-xs font-medium text-slate-900 dark:text-slate-100">${escHtml(o.operatorRef)}</td>
          <td class="py-2.5 px-3 text-right font-mono text-xs tabular-nums">${o.totalActions}</td>
          <td class="py-2.5 px-3 text-right font-mono text-xs tabular-nums">${o.queuesTouchedCount}</td>
          <td class="py-2.5 px-3 text-right font-mono text-xs tabular-nums">${fmtBps(o.approvalRateBps)}</td>
          <td class="py-2.5 px-3 text-right font-mono text-xs tabular-nums">${fmtBps(o.escalationRateBps)}</td>
          <td class="py-2.5 pl-3 text-right font-mono text-xs tabular-nums">${fmtDurationMs(o.handlingDuration.avgMs)}</td>
        </tr>
      `,
      )
      .join("");
    tableHtml = `
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="text-xs font-medium text-slate-500 dark:text-slate-400">
            <th class="pb-2.5 pr-4">Operator Ref</th>
            <th class="pb-2.5 px-3 text-right">Actions</th>
            <th class="pb-2.5 px-3 text-right">Queues</th>
            <th class="pb-2.5 px-3 text-right">Approval Rate</th>
            <th class="pb-2.5 px-3 text-right">Escalation Rate</th>
            <th class="pb-2.5 pl-3 text-right">Avg Handle</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="6" class="py-4 text-xs text-slate-500">No operator records match filter.</td></tr>`}</tbody>
      </table>
    `;
  } else {
    const rows = data.dashboards.services.servicePerformance.services
      .filter((s) => !q || s.serviceCode.toLowerCase().includes(q))
      .map(
        (s) => `
        <tr class="border-t border-slate-100 dark:border-slate-800">
          <td class="py-2.5 pr-4 font-mono text-xs font-medium text-slate-900 dark:text-slate-100">${escHtml(s.serviceCode)}</td>
          <td class="py-2.5 px-3 text-right font-mono text-xs tabular-nums">${s.submittedCount}</td>
          <td class="py-2.5 px-3 text-right font-mono text-xs tabular-nums">${s.completedCount}</td>
          <td class="py-2.5 px-3 text-right font-mono text-xs tabular-nums">${fmtBps(s.completionRateBps)}</td>
          <td class="py-2.5 px-3 text-right font-mono text-xs tabular-nums">${s.slaBreachCount}</td>
          <td class="py-2.5 pl-3 text-right font-mono text-xs tabular-nums">${fmtDurationMs(s.duration.p95Ms)}</td>
        </tr>
      `,
      )
      .join("");
    tableHtml = `
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="text-xs font-medium text-slate-500 dark:text-slate-400">
            <th class="pb-2.5 pr-4">Service Code</th>
            <th class="pb-2.5 px-3 text-right">Submitted</th>
            <th class="pb-2.5 px-3 text-right">Completed</th>
            <th class="pb-2.5 px-3 text-right">Completion</th>
            <th class="pb-2.5 px-3 text-right">SLA Breaches</th>
            <th class="pb-2.5 pl-3 text-right">p95 Duration</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="6" class="py-4 text-xs text-slate-500">No services match filter.</td></tr>`}</tbody>
      </table>
    `;
  }

  return `
    <section class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5">
      ${tabBar}
      <div class="overflow-x-auto">${tableHtml}</div>
    </section>
  `;
}

function renderApiView(data: WorkbenchOverviewResponse): string {
  const api = data.dashboards.apiAnalytics.apiMetrics;
  const alerts = data.advanced.anomalies.alerts;

  const endpointRows = api.endpoints
    .map(
      (ep) => `
      <tr class="border-t border-slate-100 dark:border-slate-800">
        <td class="py-2.5 pr-4 font-mono text-xs font-medium text-slate-900 dark:text-slate-100">${escHtml(ep.endpointKey)}</td>
        <td class="py-2.5 px-3 text-right font-mono text-xs tabular-nums">${ep.totalRequests}</td>
        <td class="py-2.5 px-3 text-right font-mono text-xs tabular-nums">${fmtBps(ep.errorRateBps)}</td>
        <td class="py-2.5 px-3 text-right font-mono text-xs tabular-nums">${fmtDurationMs(ep.latency.p50Ms)}</td>
        <td class="py-2.5 pl-3 text-right font-mono text-xs tabular-nums">${fmtDurationMs(ep.latency.p95Ms)}</td>
      </tr>
    `,
    )
    .join("");

  const alertRows = alerts
    .map(
      (a) => `
      <div class="p-4 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div class="space-y-1">
          <div class="flex items-center gap-2 text-xs font-semibold ${
            a.severity === "critical"
              ? "text-red-700 dark:text-red-400"
              : "text-amber-700 dark:text-amber-400"
          }">
            <span>${a.severity === "critical" ? "CRITICAL" : "WARNING"}</span>
            <span aria-hidden="true">·</span>
            <span class="font-mono">${escHtml(a.metric)}</span>
            <span aria-hidden="true">·</span>
            <span class="font-mono">${escHtml(a.bucketKey)}</span>
          </div>
          <p class="text-xs text-slate-600 dark:text-slate-300">${escHtml(a.reason)}</p>
        </div>
        <div class="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
          Observed ${a.observedValue} vs baseline ${a.baselineMean}
        </div>
      </div>
    `,
    )
    .join("");

  return `
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
        <div class="text-xs font-medium text-slate-500 dark:text-slate-400">API Request Volume</div>
        <div class="mt-2 font-display text-2xl font-bold font-mono tabular-nums">${api.totalRequests}</div>
        <div class="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">2xx: ${api.success2xxCount} · 4xx: ${api.clientError4xxCount} · 5xx: ${api.serverError5xxCount}</div>
      </div>
      <div class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
        <div class="text-xs font-medium text-slate-500 dark:text-slate-400">Overall Error Rate</div>
        <div class="mt-2 font-display text-2xl font-bold font-mono tabular-nums">${fmtBps(api.errorRateBps)}</div>
        <div class="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">5xx Server Error ${fmtBps(api.serverErrorRateBps)}</div>
      </div>
      <div class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
        <div class="text-xs font-medium text-slate-500 dark:text-slate-400">API p95 / p99 Latency</div>
        <div class="mt-2 font-display text-2xl font-bold font-mono tabular-nums">${fmtDurationMs(api.overallLatency.p95Ms)}</div>
        <div class="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">p99 ${fmtDurationMs(api.overallLatency.p99Ms)}</div>
      </div>
    </div>

    <section class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
      <div class="flex items-baseline justify-between gap-2">
        <h2 class="font-display text-base font-semibold text-slate-900 dark:text-slate-100">Deterministic Rolling-Baseline Anomaly Alerts</h2>
        <span class="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">${alerts.length} alerts across ${data.advanced.anomalies.evaluatedBucketsCount} buckets</span>
      </div>
      <div class="space-y-3">${alertRows || `<p class="text-xs text-slate-500 dark:text-slate-400">No rolling-baseline anomalies detected in current window.</p>`}</div>
    </section>

    <section class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
      <h2 class="font-display text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Endpoint Breakdown</h2>
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="text-xs font-medium text-slate-500 dark:text-slate-400">
              <th class="pb-2.5 pr-4">Endpoint</th>
              <th class="pb-2.5 px-3 text-right">Requests</th>
              <th class="pb-2.5 px-3 text-right">Error Rate</th>
              <th class="pb-2.5 px-3 text-right">p50</th>
              <th class="pb-2.5 pl-3 text-right">p95</th>
            </tr>
          </thead>
          <tbody>${endpointRows || `<tr><td colspan="5" class="py-4 text-xs text-slate-500">No API telemetry recorded for this tenant.</td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderExportView(): string {
  const preview = state.exportPreview;
  return `
    <section class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 class="font-display text-base font-semibold text-slate-900 dark:text-slate-100">Aggregate-Only Export &amp; K-Anonymity Suppression</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Enforces OWASP CSV formula injection neutralization, blocks raw event/account identifiers, and optionally suppresses small cells (&lt; minCount).
          </p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button type="button" id="run-export-preview-btn" class="px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap">
            Refresh Preview
          </button>
          <button type="button" id="download-export-file-btn" class="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap">
            Download ${state.exportFormat.toUpperCase()}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <label class="space-y-1 text-xs">
          <span class="font-medium text-slate-600 dark:text-slate-300">Dataset</span>
          <select id="exp-dataset" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs">
            <option value="regions"${state.exportDataset === "regions" ? " selected" : ""}>Geographic Regions (includes small cells)</option>
            <option value="services"${state.exportDataset === "services" ? " selected" : ""}>Service Performance</option>
            <option value="unit_economics"${state.exportDataset === "unit_economics" ? " selected" : ""}>Service Unit Economics</option>
          </select>
        </label>

        <label class="space-y-1 text-xs">
          <span class="font-medium text-slate-600 dark:text-slate-300">Format</span>
          <select id="exp-format" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs">
            <option value="csv"${state.exportFormat === "csv" ? " selected" : ""}>CSV (RFC 4180 + OWASP Safe)</option>
            <option value="ndjson"${state.exportFormat === "ndjson" ? " selected" : ""}>NDJSON (Streaming Lines)</option>
            <option value="json"${state.exportFormat === "json" ? " selected" : ""}>JSON Report Envelope</option>
          </select>
        </label>

        <label class="space-y-1 text-xs">
          <span class="font-medium text-slate-600 dark:text-slate-300">K-Anonymity Threshold</span>
          <select id="exp-min-count" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs">
            <option value="0"${state.exportMinCount === 0 ? " selected" : ""}>Disabled (0)</option>
            <option value="5"${state.exportMinCount === 5 ? " selected" : ""}>Minimum 5 records</option>
            <option value="15"${state.exportMinCount === 15 ? " selected" : ""}>Minimum 15 records</option>
          </select>
        </label>

        <label class="space-y-1 text-xs">
          <span class="font-medium text-slate-600 dark:text-slate-300">Small-Cell Policy</span>
          <select id="exp-mode" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs">
            <option value="suppress"${state.exportMode === "suppress" ? " selected" : ""}>Omit small rows (suppress)</option>
            <option value="rollup_other"${state.exportMode === "rollup_other" ? " selected" : ""}>Roll into __suppressed_small_cells__</option>
          </select>
        </label>
      </div>

      ${
        preview
          ? `
        <div class="space-y-2">
          <div class="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Format: ${escHtml(preview.format.toUpperCase())} · Output rows: ${preview.rowCount} · Suppressed small cells: ${preview.suppressedRowCount}
          </div>
          <pre class="p-4 rounded-lg bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto max-h-96 leading-relaxed">${escHtml(preview.content)}</pre>
        </div>
      `
          : `<p class="text-xs text-slate-500">Loading export preview...</p>`
      }
    </section>
  `;
}

function renderGovernanceView(): string {
  return `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        <div class="flex items-baseline justify-between gap-2">
          <h2 class="font-display text-base font-semibold text-slate-900 dark:text-slate-100">Live Event &amp; PII Guard Validator</h2>
          <span class="text-xs text-slate-500 dark:text-slate-400">Runs validateAnalyticsEvent()</span>
        </div>

        <div class="flex flex-wrap gap-2">
          <button type="button" data-preset="valid" class="preset-btn px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">Valid Event</button>
          <button type="button" data-preset="pii_aadhaar" class="preset-btn px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">PII / Aadhaar</button>
          <button type="button" data-preset="document_uri" class="preset-btn px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">Document Data URI</button>
          <button type="button" data-preset="unknown_safe" class="preset-btn px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">Unknown Field</button>
        </div>

        <textarea
          id="validator-json-input"
          rows="10"
          aria-label="Event JSON payload to validate"
          class="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs text-slate-900 dark:text-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"
        >${escHtml(state.validatorInput)}</textarea>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <label class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span>Unknown Field Policy</span>
            <select id="validator-policy" class="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs">
              <option value="reject"${state.validatorPolicy === "reject" ? " selected" : ""}>reject</option>
              <option value="strip_and_audit"${state.validatorPolicy === "strip_and_audit" ? " selected" : ""}>strip_and_audit</option>
            </select>
          </label>
          <button type="button" id="run-validator-btn" class="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors">
            Validate Event
          </button>
        </div>

        ${
          state.validatorResult
            ? `<pre class="p-3.5 rounded-lg bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto max-h-64">${escHtml(state.validatorResult)}</pre>`
            : ""
        }
      </section>

      <div class="space-y-6">
        <section class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 class="font-display text-base font-semibold text-slate-900 dark:text-slate-100">Tenant Isolation Boundary Probe</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Tests <code>authorizeTenantQuery()</code> when a client requests a tenant differing from the verified backend session (<code>${escHtml(state.tenantId)}</code>).
          </p>
          <div class="flex flex-wrap items-center gap-3">
            <select id="boundary-requested-tenant" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs">
              <option value="tenant_beta"${state.boundaryRequestedTenant === "tenant_beta" ? " selected" : ""}>Request tenant_beta</option>
              <option value="tenant_alpha"${state.boundaryRequestedTenant === "tenant_alpha" ? " selected" : ""}>Request tenant_alpha</option>
              <option value="tenant_unauthorized"${state.boundaryRequestedTenant === "tenant_unauthorized" ? " selected" : ""}>Request tenant_unauthorized</option>
            </select>
            <button type="button" id="run-boundary-probe-btn" class="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              Test Authorization
            </button>
          </div>
          ${
            state.boundaryResult
              ? `<pre class="p-3.5 rounded-lg bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">${escHtml(state.boundaryResult)}</pre>`
              : ""
          }
        </section>

        <section class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-3">
          <div class="flex items-center justify-between gap-2">
            <h2 class="font-display text-base font-semibold text-slate-900 dark:text-slate-100">Contract &amp; Integration Manifest</h2>
            <button type="button" id="load-manifest-btn" class="px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">
              Load /manifest
            </button>
          </div>
          ${
            state.contractCatalogJson
              ? `<pre class="p-3.5 rounded-lg bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto max-h-64">${escHtml(state.contractCatalogJson)}</pre>`
              : `<p class="text-xs text-slate-500 dark:text-slate-400">Click "Load /manifest" to inspect live ecosystem contracts and security invariants.</p>`
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
      <div class="rounded-xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 p-6 space-y-3">
        <div class="text-sm font-semibold text-red-700 dark:text-red-400">Error Loading Workbench</div>
        <p class="text-xs text-slate-600 dark:text-slate-300">${escHtml(state.errorMessage)}</p>
        <button type="button" id="retry-fetch-btn" class="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white">Retry</button>
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

  // Export Studio bindings
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

  // Governance / Privacy Validator bindings
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
