import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateAccountCohortRetention,
  aggregateBacklogAging,
  aggregateServiceUnitEconomics,
  detectTimeSeriesAnomalies,
} from "../../src/aggregations/index.js";
import { buildExecutiveOverviewDashboard } from "../../src/dashboards/builders.js";
import { authorizeTenantQuery } from "../../src/privacy/tenant-boundary.js";
import { exportAggregateRowsToCsv } from "../../src/reporting/exporters.js";
import {
  createSeededDemoStore,
  DEMO_TENANT_PROFILES,
  makeDemoAuthContext,
} from "../../src/runtime/demo-seed.js";

describe("Workbench Synthetic Demo Dataset & Flows", () => {
  it("seeds isolated tenant_alpha and tenant_beta datasets with zero PII and deterministic analytics", async () => {
    const store = await createSeededDemoStore();

    for (const profile of DEMO_TENANT_PROFILES) {
      const auth = makeDemoAuthContext(profile.tenantId);
      const query = authorizeTenantQuery(auth, {
        dateRange: { from: profile.windowFrom, to: profile.windowTo },
      });

      const events = await store.queryByTenant(query);
      assert.ok(events.length > 0);
      assert.ok(events.every((e) => e.tenantId === profile.tenantId));

      const exec = buildExecutiveOverviewDashboard(events, query, {
        timeZone: profile.defaultTimeZone,
        generatedAt: profile.asOfIso,
      });
      assert.ok(exec.funnel.submittedCount > 0);

      const unitEcon = aggregateServiceUnitEconomics(events, query);
      assert.ok(unitEcon.rows.length > 0);

      const backlog = aggregateBacklogAging(events, query, { asOfIso: profile.asOfIso });
      assert.ok(backlog.openApplicationsCount >= 0);

      const cohorts = aggregateAccountCohortRetention(events, query, {
        granularity: "week",
        timeZone: profile.defaultTimeZone,
      });
      assert.ok(cohorts.trackedAccountsCount > 0);

      if (profile.tenantId === "tenant_alpha") {
        // tenant_alpha includes day-14 SLA/API spikes and small-cell regions (IN-GA: 2, IN-SK: 1)
        const anomalies = detectTimeSeriesAnomalies(exec.trend);
        assert.ok(anomalies.alerts.length >= 1);

        const csvOut = exportAggregateRowsToCsv(
          exec.geographic.regions.map((r) => ({
            regionCode: r.regionCode,
            submittedCount: r.submittedCount,
          })),
          auth,
          {
            columns: ["regionCode", "submittedCount"],
            smallCellSuppression: {
              countField: "submittedCount",
              minCount: 5,
              mode: "suppress",
              labelField: "regionCode",
            },
          },
        );
        assert.equal(csvOut.suppressedRowCount, 2);
      }
    }
  });
});
