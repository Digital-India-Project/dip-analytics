import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  aggregateAccountCohortRetention,
  aggregateBacklogAging,
  aggregateCustomStageFunnel,
  aggregateServiceUnitEconomics,
  detectTimeSeriesAnomalies,
} from "../aggregations/index.js";
import {
  ANALYTICS_EVENT_TYPES,
  AnalyticsDomainError,
  CURRENT_EVENT_SCHEMA_VERSION,
} from "../contracts/events.js";
import {
  buildApiAnalyticsDashboard,
  buildApplicationOperationsDashboard,
  buildExecutiveOverviewDashboard,
  buildFinanceDashboard,
  buildOperatorPerformanceDashboard,
  buildPartnerManagementDashboard,
  buildServicePerformanceDashboard,
  DASHBOARD_CONTRACT_VERSION,
} from "../dashboards/index.js";
import { authorizeTenantQuery } from "../privacy/tenant-boundary.js";
import {
  exportAggregateReportToJson,
  exportAggregateRowsToCsv,
  exportAggregateRowsToNdjson,
} from "../reporting/exporters.js";
import {
  EVENT_ENVELOPE_JSON_SCHEMA,
  EVENT_PAYLOAD_JSON_SCHEMAS,
} from "../schemas/event-schemas.js";
import type { InMemoryAnalyticsStore } from "../storage/in-memory-store.js";
import type { TimeGranularity } from "../utils/time.js";
import { validateAnalyticsEvent } from "../validation/event-validator.js";
import {
  createSeededDemoStore,
  DEMO_FIXED_NOW_MS,
  DEMO_TENANT_PROFILES,
  makeDemoAuthContext,
} from "./demo-seed.js";

const PORT = Number(process.env["PORT"] ?? 3000);
const HOST = process.env["HOST"] ?? "0.0.0.0";
const MAX_HTTP_BODY_BYTES = 64 * 1024;

function loadIntegrationManifest(): unknown {
  try {
    const raw = readFileSync(resolve(process.cwd(), "integration/manifest.json"), "utf8");
    return JSON.parse(raw) as unknown;
  } catch {
    return { status: "manifest_not_found" };
  }
}

function tryReadPublicFile(relativePath: string): Buffer | null {
  try {
    const publicRoot = resolve(process.cwd(), "public");
    const fullPath = resolve(publicRoot, relativePath);
    if (!fullPath.startsWith(publicRoot)) return null;
    return readFileSync(fullPath);
  } catch {
    return null;
  }
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body, null, 2));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    total += buf.byteLength;
    if (total > MAX_HTTP_BODY_BYTES) {
      throw new AnalyticsDomainError(
        "INPUT_SIZE_LIMIT_EXCEEDED",
        `Request body exceeded ${MAX_HTTP_BODY_BYTES} byte workbench limit.`,
      );
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (raw.length === 0) {
    return {};
  }
  return JSON.parse(raw) as unknown;
}

const CAPABILITIES_CATALOG = [
  "application_funnel",
  "custom_stage_funnel",
  "application_status_distribution",
  "service_performance",
  "processing_time_and_sla",
  "revenue_and_refunds",
  "payment_success_failure_rates",
  "payment_reconciliation",
  "partner_performance_and_commissions",
  "operator_and_queue_workload",
  "account_activity_metrics",
  "geographic_regional_analytics",
  "api_usage_and_error_rates",
  "historical_time_series",
  "period_over_period_comparison",
  "streaming_mergeable_rollups",
  "checkpointed_streaming",
  "account_cohort_retention",
  "anomaly_detection",
  "service_unit_economics",
  "queue_backlog_aging",
  "small_cell_k_anonymity_suppression",
  "schema_upcaster_registry",
  "ecosystem_bridges",
  "csv_json_ndjson_aggregate_exports",
] as const;

function resolveTenantProfile(requestedTenantId: string | null) {
  return (
    DEMO_TENANT_PROFILES.find((p) => p.tenantId === requestedTenantId) ?? DEMO_TENANT_PROFILES[0]!
  );
}

async function handleOverviewRequest(
  url: URL,
  store: InMemoryAnalyticsStore,
  res: ServerResponse,
): Promise<void> {
  const profile = resolveTenantProfile(url.searchParams.get("tenantId"));
  const auth = makeDemoAuthContext(profile.tenantId);

  const from = url.searchParams.get("from") || profile.windowFrom;
  const to = url.searchParams.get("to") || profile.windowTo;
  const timeZone = url.searchParams.get("timeZone") || profile.defaultTimeZone;
  const rawGran = url.searchParams.get("granularity") || "day";
  const granularity: TimeGranularity =
    rawGran === "hour" || rawGran === "day" || rawGran === "week" || rawGran === "month"
      ? rawGran
      : "day";
  const serviceCode = url.searchParams.get("serviceCode")?.trim() || undefined;
  const currency = url.searchParams.get("currency")?.trim() || undefined;

  const query = authorizeTenantQuery(auth, { dateRange: { from, to } });
  const events = await store.queryByTenant(query, {
    ...(serviceCode ? { serviceCodes: [serviceCode] } : {}),
    ...(currency ? { currencies: [currency] } : {}),
  });

  const buildOpts = {
    timeZone,
    granularity,
    generatedAt: profile.asOfIso,
    ...(serviceCode ? { serviceCodes: [serviceCode] } : {}),
    ...(currency ? { currencies: [currency] } : {}),
  };

  const executive = buildExecutiveOverviewDashboard(events, query, buildOpts);
  const operations = buildApplicationOperationsDashboard(events, query, buildOpts);
  const finance = buildFinanceDashboard(events, query, buildOpts);
  const partners = buildPartnerManagementDashboard(events, query, buildOpts);
  const operators = buildOperatorPerformanceDashboard(events, query, buildOpts);
  const services = buildServicePerformanceDashboard(events, query, buildOpts);
  const apiAnalytics = buildApiAnalyticsDashboard(events, query, buildOpts);

  const serviceFilter = serviceCode ? new Set([serviceCode]) : undefined;
  const unitEconomics = aggregateServiceUnitEconomics(events, query, {
    ...(serviceFilter ? { serviceFilter } : {}),
    ...(currency ? { strictCurrency: currency } : {}),
  });
  const backlogAging = aggregateBacklogAging(events, query, {
    asOfIso: profile.asOfIso,
    ...(serviceFilter ? { serviceFilter } : {}),
  });
  const cohortRetention = aggregateAccountCohortRetention(events, query, {
    granularity: granularity === "hour" ? "day" : granularity,
    timeZone,
  });
  const customFunnel = aggregateCustomStageFunnel(events, query, [
    "submitted",
    "in_review",
    "approved",
  ]);
  const anomalies = detectTimeSeriesAnomalies(executive.trend, {
    baselineWindowSize: 3,
    warningDeviationBps: 5_000,
    criticalDeviationBps: 10_000,
  });

  sendJson(res, 200, {
    profiles: DEMO_TENANT_PROFILES,
    activeProfile: profile,
    appliedFilters: {
      tenantId: profile.tenantId,
      from,
      to,
      timeZone,
      granularity,
      serviceCode: serviceCode ?? null,
      currency: currency ?? null,
    },
    dashboards: {
      executive,
      operations,
      finance,
      partners,
      operators,
      services,
      apiAnalytics,
    },
    advanced: {
      unitEconomics,
      backlogAging,
      cohortRetention,
      customFunnel,
      anomalies,
    },
  });
}

async function handleExportRequest(
  url: URL,
  store: InMemoryAnalyticsStore,
  res: ServerResponse,
): Promise<void> {
  const profile = resolveTenantProfile(url.searchParams.get("tenantId"));
  const auth = makeDemoAuthContext(profile.tenantId);
  const from = url.searchParams.get("from") || profile.windowFrom;
  const to = url.searchParams.get("to") || profile.windowTo;
  const dataset = url.searchParams.get("dataset") || "regions";
  const format = url.searchParams.get("format") || "csv";
  const minCountRaw = Number(url.searchParams.get("minCount") ?? "0");
  const minCount = Number.isFinite(minCountRaw) && minCountRaw > 1 ? Math.floor(minCountRaw) : 0;
  const mode = url.searchParams.get("mode") === "rollup_other" ? "rollup_other" : "suppress";

  const query = authorizeTenantQuery(auth, { dateRange: { from, to } });
  const events = await store.queryByTenant(query);

  let rows: Array<Record<string, unknown>> = [];
  let columns: string[] = [];
  let labelField = "regionCode";
  let countField = "submittedCount";

  if (dataset === "services") {
    const svcDash = buildServicePerformanceDashboard(events, query, { generatedAt: profile.asOfIso });
    rows = svcDash.servicePerformance.services.map((s) => ({
      serviceCode: s.serviceCode,
      submittedCount: s.submittedCount,
      completedCount: s.completedCount,
      approvedCount: s.approvedCount,
      cancelledCount: s.cancelledCount,
      slaBreachCount: s.slaBreachCount,
      completionRateBps: s.completionRateBps ?? 0,
      avgDurationMs: s.duration.avgMs ?? 0,
    }));
    columns = [
      "serviceCode",
      "submittedCount",
      "completedCount",
      "approvedCount",
      "cancelledCount",
      "slaBreachCount",
      "completionRateBps",
      "avgDurationMs",
    ];
    labelField = "serviceCode";
    countField = "submittedCount";
  } else if (dataset === "unit_economics") {
    const econ = aggregateServiceUnitEconomics(events, query);
    rows = econ.rows.map((r) => ({
      serviceCode: r.serviceCode,
      currency: r.currency,
      completedApplicationsCount: r.completedApplicationsCount,
      grossRevenueMinor: r.grossRevenueMinor,
      gatewayFeesMinor: r.gatewayFeesMinor,
      refundedMinor: r.refundedMinor,
      partnerCommissionMinor: r.partnerCommissionMinor,
      netContributionMinor: r.netContributionMinor,
      netMarginBps: r.netMarginBps ?? 0,
    }));
    columns = [
      "serviceCode",
      "currency",
      "completedApplicationsCount",
      "grossRevenueMinor",
      "gatewayFeesMinor",
      "refundedMinor",
      "partnerCommissionMinor",
      "netContributionMinor",
      "netMarginBps",
    ];
    labelField = "serviceCode";
    countField = "completedApplicationsCount";
  } else {
    const exec = buildExecutiveOverviewDashboard(events, query, { generatedAt: profile.asOfIso });
    rows = exec.geographic.regions.map((r) => ({
      regionCode: r.regionCode,
      submittedCount: r.submittedCount,
      completedCount: r.completedCount,
      approvedCount: r.approvedCount,
      cancelledCount: r.cancelledCount,
      slaBreachCount: r.slaBreachCount,
      completionRateBps: r.completionRateBps ?? 0,
    }));
    columns = [
      "regionCode",
      "submittedCount",
      "completedCount",
      "approvedCount",
      "cancelledCount",
      "slaBreachCount",
      "completionRateBps",
    ];
    labelField = "regionCode";
    countField = "submittedCount";
  }

  const suppression =
    minCount > 1
      ? {
          countField,
          minCount,
          mode: mode as "suppress" | "rollup_other",
          labelField,
        }
      : undefined;

  if (format === "ndjson") {
    const out = exportAggregateRowsToNdjson(rows, auth, {
      ...(suppression ? { smallCellSuppression: suppression } : {}),
    });
    sendJson(res, 200, {
      format: "ndjson",
      dataset,
      ...out,
      content: out.ndjson,
    });
    return;
  }

  if (format === "json") {
    const reportPayload = {
      tenantId: profile.tenantId,
      dataset,
      rowCount: rows.length,
      rows,
    };
    const out = exportAggregateReportToJson(reportPayload, auth, {
      exportedAt: profile.asOfIso,
    });
    sendJson(res, 200, {
      format: "json",
      dataset,
      suppressedRowCount: 0,
      rowCount: rows.length,
      content: JSON.stringify(out, null, 2),
      ...out,
    });
    return;
  }

  const csvOut = exportAggregateRowsToCsv(rows, auth, {
    columns,
    ...(suppression ? { smallCellSuppression: suppression } : {}),
  });
  sendJson(res, 200, {
    format: "csv",
    dataset,
    ...csvOut,
    content: csvOut.csv,
  });
}

/**
 * Contract inspection & interactive workbench HTTP server.
 */
export async function startContractInspectionServer(): Promise<void> {
  const store = await createSeededDemoStore();

  const server = createServer((req, res) => {
    void (async () => {
      const requestUrl = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
      const path = requestUrl.pathname;

      try {
        if (req.method === "GET" && path === "/assets/app.css") {
          const css = tryReadPublicFile("assets/app.css");
          if (!css) {
            res.writeHead(404);
            res.end("CSS asset not built");
            return;
          }
          res.writeHead(200, { "content-type": "text/css; charset=utf-8" });
          res.end(css);
          return;
        }

        if (req.method === "GET" && path === "/assets/client.js") {
          const js = tryReadPublicFile("assets/client.js");
          if (!js) {
            res.writeHead(404);
            res.end("JS asset not built");
            return;
          }
          res.writeHead(200, { "content-type": "application/javascript; charset=utf-8" });
          res.end(js);
          return;
        }

        if (req.method === "GET" && path === "/health") {
          sendJson(res, 200, {
            status: "ok",
            package: "@digital-india-project/dip-analytics",
            eventSchemaVersion: CURRENT_EVENT_SCHEMA_VERSION,
            dashboardContractVersion: DASHBOARD_CONTRACT_VERSION,
            capabilitiesCount: CAPABILITIES_CATALOG.length,
          });
          return;
        }

        if (req.method === "GET" && path === "/manifest") {
          sendJson(res, 200, loadIntegrationManifest());
          return;
        }

        if (req.method === "GET" && path === "/schemas") {
          sendJson(res, 200, {
            envelope: EVENT_ENVELOPE_JSON_SCHEMA,
            payloads: EVENT_PAYLOAD_JSON_SCHEMAS,
          });
          return;
        }

        if (req.method === "GET" && path === "/capabilities") {
          sendJson(res, 200, {
            package: "@digital-india-project/dip-analytics",
            capabilities: CAPABILITIES_CATALOG,
            supportedEventTypes: ANALYTICS_EVENT_TYPES,
          });
          return;
        }

        if (req.method === "GET" && path === "/api/workbench/overview") {
          await handleOverviewRequest(requestUrl, store, res);
          return;
        }

        if (req.method === "GET" && path === "/api/workbench/export") {
          await handleExportRequest(requestUrl, store, res);
          return;
        }

        if (req.method === "POST" && path === "/api/workbench/validate-event") {
          const body = (await readJsonBody(req)) as Record<string, unknown>;
          const policy =
            body["unknownFieldPolicy"] === "strip_and_audit" ? "strip_and_audit" : "reject";
          const candidate = body["event"] !== undefined ? body["event"] : body;
          const result = validateAnalyticsEvent(candidate, {
            unknownFieldPolicy: policy,
            nowMs: DEMO_FIXED_NOW_MS,
          });
          sendJson(res, 200, {
            valid: true,
            strippedFields: result.strippedFields,
            normalizedEvent: result.event,
          });
          return;
        }

        if (req.method === "POST" && path === "/api/workbench/test-tenant-boundary") {
          const body = (await readJsonBody(req)) as Record<string, unknown>;
          const sessionTenant =
            typeof body["authenticatedTenantId"] === "string"
              ? body["authenticatedTenantId"]
              : "tenant_alpha";
          const requestedTenant =
            typeof body["requestedTenantId"] === "string"
              ? body["requestedTenantId"]
              : "tenant_beta";
          const auth = makeDemoAuthContext(sessionTenant);
          const authorized = authorizeTenantQuery(auth, {
            tenantId: requestedTenant,
            dateRange: {
              from: "2026-10-01T00:00:00.000Z",
              to: "2026-10-15T23:59:59.000Z",
            },
          });
          sendJson(res, 200, {
            allowed: true,
            boundTenantId: authorized.tenantId,
            message: `Authorized query strictly bound to authenticated tenant "${authorized.tenantId}".`,
          });
          return;
        }

        if (req.method === "GET" && path === "/") {
          const accept = req.headers["accept"] ?? "";
          if (accept.includes("text/html")) {
            const html = tryReadPublicFile("index.html");
            if (html) {
              res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
              res.end(html);
              return;
            }
          }

          sendJson(res, 200, {
            service: "@digital-india-project/dip-analytics",
            role: "Universal, tenant-aware analytics domain, validation, privacy enforcement, streaming rollups, and reporting library",
            eventSchemaVersion: CURRENT_EVENT_SCHEMA_VERSION,
            dashboardContractVersion: DASHBOARD_CONTRACT_VERSION,
            supportedEventTypes: ANALYTICS_EVENT_TYPES,
            capabilities: CAPABILITIES_CATALOG,
            endpoints: [
              "/",
              "/health",
              "/manifest",
              "/schemas",
              "/capabilities",
              "/api/workbench/overview",
              "/api/workbench/export",
              "/api/workbench/validate-event",
              "/api/workbench/test-tenant-boundary",
            ],
          });
          return;
        }

        sendJson(res, 404, { error: "NOT_FOUND", message: `Route ${path} not found.` });
      } catch (err) {
        if (err instanceof AnalyticsDomainError) {
          const statusCode =
            err.code === "TENANT_BOUNDARY_VIOLATION"
              ? 403
              : err.code === "INPUT_SIZE_LIMIT_EXCEEDED"
                ? 413
                : 422;
          sendJson(res, statusCode, {
            valid: false,
            allowed: false,
            error: err.code,
            message: err.message,
          });
          return;
        }
        if (err instanceof SyntaxError) {
          sendJson(res, 400, {
            valid: false,
            error: "INVALID_JSON",
            message: err.message,
          });
          return;
        }
        sendJson(res, 500, {
          error: "INTERNAL_ERROR",
          message: "Unexpected server error.",
        });
      }
    })();
  });

  server.listen(PORT, HOST, () => {
    console.info(
      `[dip-analytics] contract & workbench server listening on http://${HOST}:${PORT}`,
    );
  });
}

void startContractInspectionServer();
