import { performance } from "node:perf_hooks";
import { StreamingAnalyticsProcessor } from "../aggregations/streaming-rollup.js";
import { aggregateServiceUnitEconomics } from "../aggregations/unit-economics.js";
import { CURRENT_EVENT_SCHEMA_VERSION, type AnyAnalyticsEvent } from "../contracts/events.js";
import { authorizeTenantQuery } from "../privacy/tenant-boundary.js";
import { sortEventsDeterministically } from "../reliability/index.js";

const EVENT_COUNT = 100_000;

function generateSyntheticDataset(count: number): AnyAnalyticsEvent[] {
  const events: AnyAnalyticsEvent[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const day = 1 + (i % 28);
    const ts = `2026-10-${String(day).padStart(2, "0")}T10:00:00.000Z`;
    if (i % 3 === 0) {
      events[i] = {
        eventId: `bench_${i}`,
        eventType: "application.submitted",
        schemaVersion: CURRENT_EVENT_SCHEMA_VERSION,
        eventTimestamp: ts,
        tenantId: "tenant_bench",
        sourceService: "dipindia",
        correlationId: `corr_${i}`,
        references: { applicationRef: `app_${i}`, regionCode: i % 2 === 0 ? "IN-DL" : "IN-KA" },
        payload: {
          serviceCode: `SVC_${i % 10}`,
          channel: "web",
          regionCode: i % 2 === 0 ? "IN-DL" : "IN-KA",
        },
      };
    } else if (i % 3 === 1) {
      events[i] = {
        eventId: `bench_${i}`,
        eventType: "application.completed",
        schemaVersion: CURRENT_EVENT_SCHEMA_VERSION,
        eventTimestamp: ts,
        tenantId: "tenant_bench",
        sourceService: "dipindia",
        correlationId: `corr_${i}`,
        references: { applicationRef: `app_${i - 1}` },
        payload: {
          serviceCode: `SVC_${(i - 1) % 10}`,
          finalStatus: "approved",
          processingDurationMs: 25_000 + (i % 5000),
          slaTargetMs: 60_000,
        },
      };
    } else {
      events[i] = {
        eventId: `bench_${i}`,
        eventType: "payment.succeeded",
        schemaVersion: CURRENT_EVENT_SCHEMA_VERSION,
        eventTimestamp: ts,
        tenantId: "tenant_bench",
        sourceService: "dip-api",
        correlationId: `corr_${i}`,
        references: { serviceCode: `SVC_${(i - 2) % 10}`, paymentRef: `pay_${i}` },
        payload: {
          currency: "INR",
          amountMinor: 50_000,
          feeMinor: 1_000,
          netAmountMinor: 49_000,
          paymentMethodCategory: "upi",
        },
      };
    }
  }
  return events;
}

function runBenchmark(): void {
  const dataset = generateSyntheticDataset(EVENT_COUNT);
  const query = authorizeTenantQuery(
    {
      authenticatedTenantId: "tenant_bench",
      actorId: "bench_runner",
      actorRole: "tenant_admin",
      issuedBy: "dip-api",
      scopes: ["analytics:read"],
    },
    {
      dateRange: {
        from: "2026-10-01T00:00:00.000Z",
        to: "2026-11-01T00:00:00.000Z",
      },
    },
  );

  const tSort0 = performance.now();
  const sorted = sortEventsDeterministically(dataset);
  const tSort1 = performance.now();

  const tStream0 = performance.now();
  const processor = new StreamingAnalyticsProcessor({
    tenantId: "tenant_bench",
    granularity: "day",
    timeZone: "UTC",
    maxDedupWindowSize: EVENT_COUNT,
  });
  processor.processBatch(sorted);
  const snap = processor.snapshot();
  const tStream1 = performance.now();

  const tUnit0 = performance.now();
  const unitEcon = aggregateServiceUnitEconomics(dataset, query);
  const tUnit1 = performance.now();

  console.info(
    JSON.stringify(
      {
        eventCount: EVENT_COUNT,
        sortMs: Math.round(tSort1 - tSort0),
        streamingRollupMs: Math.round(tStream1 - tStream0),
        unitEconomicsMs: Math.round(tUnit1 - tUnit0),
        processedInRollup: snap.processedEventsCount,
        serviceEconomicsGroups: unitEcon.rows.length,
      },
      null,
      2,
    ),
  );
}

runBenchmark();
