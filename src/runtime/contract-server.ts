import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ANALYTICS_EVENT_TYPES, CURRENT_EVENT_SCHEMA_VERSION } from "../contracts/events.js";
import { DASHBOARD_CONTRACT_VERSION } from "../dashboards/contracts.js";
import {
  EVENT_ENVELOPE_JSON_SCHEMA,
  EVENT_PAYLOAD_JSON_SCHEMAS,
} from "../schemas/event-schemas.js";

const PORT = Number(process.env["PORT"] ?? 3000);
const HOST = process.env["HOST"] ?? "0.0.0.0";

function loadIntegrationManifest(): unknown {
  try {
    const raw = readFileSync(resolve(process.cwd(), "integration/manifest.json"), "utf8");
    return JSON.parse(raw) as unknown;
  } catch {
    return { status: "manifest_not_found" };
  }
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

/**
 * Lightweight zero-dependency contract inspection HTTP server for runtime health
 * checks. Not a dashboard UI (UI belongs exclusively in dip-ui).
 */
export function startContractInspectionServer(): void {
  const server = createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0] ?? "/";

    if (req.method !== "GET") {
      res.writeHead(405, { "content-type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          error: "Method not allowed. Read-only contract inspection endpoint.",
        }),
      );
      return;
    }

    if (path === "/health") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          status: "ok",
          package: "@digital-india-project/dip-analytics",
          eventSchemaVersion: CURRENT_EVENT_SCHEMA_VERSION,
          dashboardContractVersion: DASHBOARD_CONTRACT_VERSION,
          capabilitiesCount: CAPABILITIES_CATALOG.length,
        }),
      );
      return;
    }

    if (path === "/manifest") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(loadIntegrationManifest(), null, 2));
      return;
    }

    if (path === "/schemas") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify(
          {
            envelope: EVENT_ENVELOPE_JSON_SCHEMA,
            payloads: EVENT_PAYLOAD_JSON_SCHEMAS,
          },
          null,
          2,
        ),
      );
      return;
    }

    if (path === "/capabilities") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify(
          {
            package: "@digital-india-project/dip-analytics",
            capabilities: CAPABILITIES_CATALOG,
            supportedEventTypes: ANALYTICS_EVENT_TYPES,
          },
          null,
          2,
        ),
      );
      return;
    }

    if (path === "/") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify(
          {
            service: "@digital-india-project/dip-analytics",
            role: "Universal, tenant-aware analytics domain, validation, privacy enforcement, streaming rollups, and reporting library",
            note: "Dashboard UI belongs in dip-ui; API authorization belongs in dip-api.",
            eventSchemaVersion: CURRENT_EVENT_SCHEMA_VERSION,
            dashboardContractVersion: DASHBOARD_CONTRACT_VERSION,
            supportedEventTypes: ANALYTICS_EVENT_TYPES,
            capabilities: CAPABILITIES_CATALOG,
            endpoints: ["/health", "/manifest", "/schemas", "/capabilities"],
          },
          null,
          2,
        ),
      );
      return;
    }

    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  server.listen(PORT, HOST, () => {
    console.info(
      `[dip-analytics] contract inspection server listening on http://${HOST}:${PORT}`,
    );
  });
}

startContractInspectionServer();
