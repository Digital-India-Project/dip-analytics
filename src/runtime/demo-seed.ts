import { CURRENT_EVENT_SCHEMA_VERSION, type AnyAnalyticsEvent } from "../contracts/events.js";
import type { TenantAuthorizationContext } from "../privacy/tenant-boundary.js";
import { InMemoryAnalyticsStore } from "../storage/in-memory-store.js";

export interface DemoTenantProfile {
  readonly tenantId: string;
  readonly label: string;
  readonly defaultTimeZone: string;
  readonly windowFrom: string;
  readonly windowTo: string;
  readonly asOfIso: string;
}

export const DEMO_TENANT_PROFILES: readonly DemoTenantProfile[] = [
  {
    tenantId: "tenant_alpha",
    label: "National Citizen Portal (Synthetic)",
    defaultTimeZone: "Asia/Kolkata",
    windowFrom: "2026-10-01T00:00:00.000Z",
    windowTo: "2026-10-15T23:59:59.000Z",
    asOfIso: "2026-10-15T18:00:00.000Z",
  },
  {
    tenantId: "tenant_beta",
    label: "State Enterprise Registry (Synthetic)",
    defaultTimeZone: "UTC",
    windowFrom: "2026-10-01T00:00:00.000Z",
    windowTo: "2026-10-15T23:59:59.000Z",
    asOfIso: "2026-10-15T18:00:00.000Z",
  },
];

export const DEMO_FIXED_NOW_MS = Date.parse("2026-10-15T18:00:00.000Z");

export function makeDemoAuthContext(tenantId: string): TenantAuthorizationContext {
  return {
    authenticatedTenantId: tenantId,
    actorId: "workbench_analyst",
    actorRole: "tenant_admin",
    issuedBy: "dip-api",
    scopes: ["analytics:read", "analytics:ingest", "analytics:admin"],
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function buildTenantAlphaEvents(): AnyAnalyticsEvent[] {
  const events: AnyAnalyticsEvent[] = [];
  let seq = 1;
  const nextId = (prefix: string) => `${prefix}_${seq++}`;

  const services = [
    { code: "SVC_PASSPORT_RENEWAL", fee: 150_000, slaMs: 120_000, region: "IN-DL" },
    { code: "SVC_BIRTH_CERT", fee: 25_000, slaMs: 45_000, region: "IN-MH" },
    { code: "SVC_TRADE_LICENSE", fee: 320_000, slaMs: 180_000, region: "IN-KA" },
    { code: "SVC_TAX_CLEARANCE", fee: 85_000, slaMs: 90_000, region: "IN-TN" },
  ] as const;

  const partners = ["ptr_north_kendra", "ptr_west_seva", "ptr_south_assist"] as const;
  const operators = [
    { ref: "opr_desk_01", queue: "Q_VERIFICATION" },
    { ref: "opr_desk_02", queue: "Q_VERIFICATION" },
    { ref: "opr_lead_03", queue: "Q_ESCALATIONS" },
  ] as const;

  // 14 days of synthetic activity (Oct 2 .. Oct 15)
  for (let day = 2; day <= 15; day++) {
    const datePrefix = `2026-10-${pad2(day)}`;
    const dailyApps = day === 14 ? 8 : 6;

    for (let i = 0; i < dailyApps; i++) {
      const svc = services[(day + i) % services.length]!;
      const appRef = `app_a_${day}_${i}`;
      const accountRef = `acct_a_${((day + i) % 14) + 1}`;
      const payRef = `pay_a_${day}_${i}`;
      const partnerRef = partners[(day + i) % partners.length]!;
      const operator = operators[(day + i) % operators.length]!;
      const hour = 6 + (i % 10);

      // 1. Application Submitted
      events.push({
        eventId: nextId("evt_sub"),
        eventType: "application.submitted",
        schemaVersion: CURRENT_EVENT_SCHEMA_VERSION,
        eventTimestamp: `${datePrefix}T${pad2(hour)}:05:00.000Z`,
        tenantId: "tenant_alpha",
        sourceService: "dipindia",
        correlationId: `corr_${appRef}`,
        references: {
          applicationRef: appRef,
          accountRef,
          serviceCode: svc.code,
          regionCode: svc.region,
        },
        payload: {
          serviceCode: svc.code,
          channel: i % 3 === 0 ? "web" : i % 3 === 1 ? "assisted_center" : "mobile",
          regionCode: svc.region,
        },
      });

      // 2. Status changed
      events.push({
        eventId: nextId("evt_st"),
        eventType: "application.status_changed",
        schemaVersion: CURRENT_EVENT_SCHEMA_VERSION,
        eventTimestamp: `${datePrefix}T${pad2(hour)}:12:00.000Z`,
        tenantId: "tenant_alpha",
        sourceService: "dipindia",
        correlationId: `corr_${appRef}`,
        references: { applicationRef: appRef, accountRef, serviceCode: svc.code },
        payload: {
          serviceCode: svc.code,
          previousStatus: "submitted",
          nextStatus: "in_review",
          stageOrder: 2,
        },
      });

      // 3. Partner assigned & operator action
      events.push({
        eventId: nextId("evt_pa"),
        eventType: "partner.assigned",
        schemaVersion: CURRENT_EVENT_SCHEMA_VERSION,
        eventTimestamp: `${datePrefix}T${pad2(hour)}:15:00.000Z`,
        tenantId: "tenant_alpha",
        sourceService: "dipindia",
        correlationId: `corr_${appRef}`,
        references: {
          applicationRef: appRef,
          partnerRef,
          serviceCode: svc.code,
          regionCode: svc.region,
        },
        payload: {
          partnerRef,
          serviceCode: svc.code,
          regionCode: svc.region,
          assignmentType: i % 2 === 0 ? "auto" : "manual",
        },
      });

      events.push({
        eventId: nextId("evt_op"),
        eventType: "operator.action_recorded",
        schemaVersion: CURRENT_EVENT_SCHEMA_VERSION,
        eventTimestamp: `${datePrefix}T${pad2(hour)}:22:00.000Z`,
        tenantId: "tenant_alpha",
        sourceService: "dipindia",
        correlationId: `corr_${appRef}`,
        references: { applicationRef: appRef, operatorRef: operator.ref, serviceCode: svc.code },
        payload: {
          operatorRef: operator.ref,
          actionType: i === 5 ? "escalated" : i % 4 === 0 ? "approved" : "verified",
          serviceCode: svc.code,
          queueCode: operator.queue,
          durationMs: 14_000 + i * 2_500,
        },
      });

      // Keep a controlled set of open backlog apps across different aging bands
      const leaveOpen =
        (day === 15 && i >= 4) || // < 1h or < 24h
        (day === 12 && i === 5) || // 1d-7d
        (day === 4 && i === 5); // > 7d

      if (!leaveOpen) {
        if (i === 4 && day % 2 === 0) {
          events.push({
            eventId: nextId("evt_can"),
            eventType: "application.cancelled",
            schemaVersion: CURRENT_EVENT_SCHEMA_VERSION,
            eventTimestamp: `${datePrefix}T${pad2(hour)}:38:00.000Z`,
            tenantId: "tenant_alpha",
            sourceService: "dipindia",
            correlationId: `corr_${appRef}`,
            references: { applicationRef: appRef, accountRef, serviceCode: svc.code },
            payload: {
              serviceCode: svc.code,
              cancelledByRole: "customer",
              reasonCode: "applicant_withdrawn",
            },
          });
        } else {
          const durationMs =
            day === 14 && i < 3 ? svc.slaMs + 42_000 : Math.round(svc.slaMs * (0.55 + (i % 4) * 0.14));
          const finalStatus = i === 3 && day % 3 === 0 ? "rejected" : "approved";

          events.push({
            eventId: nextId("evt_cmp"),
            eventType: "application.completed",
            schemaVersion: CURRENT_EVENT_SCHEMA_VERSION,
            eventTimestamp: `${datePrefix}T${pad2(hour)}:45:00.000Z`,
            tenantId: "tenant_alpha",
            sourceService: "dipindia",
            correlationId: `corr_${appRef}`,
            references: {
              applicationRef: appRef,
              accountRef,
              serviceCode: svc.code,
              regionCode: svc.region,
            },
            payload: {
              serviceCode: svc.code,
              finalStatus,
              processingDurationMs: durationMs,
              slaTargetMs: svc.slaMs,
              regionCode: svc.region,
            },
          });

          events.push({
            eventId: nextId("evt_pc"),
            eventType: "partner.completed_work",
            schemaVersion: CURRENT_EVENT_SCHEMA_VERSION,
            eventTimestamp: `${datePrefix}T${pad2(hour)}:44:00.000Z`,
            tenantId: "tenant_alpha",
            sourceService: "dipindia",
            correlationId: `corr_${appRef}`,
            references: { applicationRef: appRef, partnerRef, serviceCode: svc.code },
            payload: {
              partnerRef,
              serviceCode: svc.code,
              durationMs: Math.round(durationMs * 0.6),
              outcome: i === 5 ? "returned" : "completed",
              commissionMinor: Math.round(svc.fee * 0.08),
              currency: "INR",
            },
          });
        }
      }

      // 4. Payments (mostly INR, occasional USD consular service)
      const isUsd = svc.code === "SVC_PASSPORT_RENEWAL" && i === 0 && day % 3 === 0;
      const currency = isUsd ? "USD" : "INR";
      const amountMinor = isUsd ? 12_500 : svc.fee;
      const gatewayFeeMinor = Math.round(amountMinor * 0.02);

      events.push({
        eventId: nextId("evt_pi"),
        eventType: "payment.initiated",
        schemaVersion: CURRENT_EVENT_SCHEMA_VERSION,
        eventTimestamp: `${datePrefix}T${pad2(hour)}:06:00.000Z`,
        tenantId: "tenant_alpha",
        sourceService: "dip-api",
        correlationId: `corr_${payRef}`,
        references: { paymentRef: payRef, applicationRef: appRef, accountRef, serviceCode: svc.code },
        payload: {
          currency,
          amountMinor,
          paymentMethodCategory: i % 3 === 0 ? "upi" : i % 3 === 1 ? "card" : "netbanking",
          serviceCode: svc.code,
        },
      });

      if (i === 4 && day % 2 === 0) {
        events.push({
          eventId: nextId("evt_pf"),
          eventType: "payment.failed",
          schemaVersion: CURRENT_EVENT_SCHEMA_VERSION,
          eventTimestamp: `${datePrefix}T${pad2(hour)}:07:00.000Z`,
          tenantId: "tenant_alpha",
          sourceService: "dip-api",
          correlationId: `corr_${payRef}`,
          references: { paymentRef: payRef, applicationRef: appRef, serviceCode: svc.code },
          payload: {
            currency,
            amountMinor,
            failureCategory: day % 4 === 0 ? "gateway_timeout" : "authentication_failed",
            paymentMethodCategory: "card",
            retryable: true,
          },
        });
      } else if (!(day === 15 && i === 5)) {
        // Leave day 15 i=5 as unsettled initiated for reconciliation visibility
        events.push({
          eventId: nextId("evt_ps"),
          eventType: "payment.succeeded",
          schemaVersion: CURRENT_EVENT_SCHEMA_VERSION,
          eventTimestamp: `${datePrefix}T${pad2(hour)}:08:00.000Z`,
          tenantId: "tenant_alpha",
          sourceService: "dip-api",
          correlationId: `corr_${payRef}`,
          references: { paymentRef: payRef, applicationRef: appRef, accountRef, serviceCode: svc.code },
          payload: {
            currency,
            amountMinor,
            feeMinor: gatewayFeeMinor,
            netAmountMinor: amountMinor - gatewayFeeMinor,
            paymentMethodCategory: i % 3 === 0 ? "upi" : i % 3 === 1 ? "card" : "netbanking",
            settlementDurationMs: 1_800 + i * 250,
          },
        });

        if (i === 3 && day % 4 === 0) {
          events.push({
            eventId: nextId("evt_pr"),
            eventType: "payment.refunded",
            schemaVersion: CURRENT_EVENT_SCHEMA_VERSION,
            eventTimestamp: `${datePrefix}T${pad2(hour)}:50:00.000Z`,
            tenantId: "tenant_alpha",
            sourceService: "dip-api",
            correlationId: `corr_${payRef}`,
            references: { paymentRef: payRef, applicationRef: appRef, accountRef, serviceCode: svc.code },
            payload: {
              currency,
              refundAmountMinor: Math.round(amountMinor * 0.5),
              originalAmountMinor: amountMinor,
              reasonCategory: "application_cancelled",
              partial: true,
            },
          });
        }
      }
    }

    // 5. SLA breaches (baseline ~1/day, spike on day 14 = 6 breaches so anomaly detector triggers!)
    const breachCount = day === 14 ? 6 : 1;
    for (let b = 0; b < breachCount; b++) {
      events.push({
        eventId: nextId("evt_sla"),
        eventType: "sla.threshold_breached",
        schemaVersion: CURRENT_EVENT_SCHEMA_VERSION,
        eventTimestamp: `${datePrefix}T14:${pad2(b * 5)}:00.000Z`,
        tenantId: "tenant_alpha",
        sourceService: "dip-automation",
        correlationId: `corr_sla_${day}_${b}`,
        references: { serviceCode: services[b % services.length]!.code },
        payload: {
          serviceCode: services[b % services.length]!.code,
          stageCode: b % 2 === 0 ? "DOC_VERIFICATION" : "PARTNER_DISPATCH",
          elapsedMs: 185_000 + b * 15_000,
          thresholdMs: 120_000,
          severity: day === 14 ? "critical" : "warning",
        },
      });
    }

    // 6. API telemetry (steady ~5% error rate normally, spike to 35% 5xx on day 14)
    const apiSamples = [
      { route: "/v1/applications", method: "POST" as const, normalStatus: 201 },
      { route: "/v1/applications/:id", method: "GET" as const, normalStatus: 200 },
      { route: "/v1/payments/checkout", method: "POST" as const, normalStatus: 200 },
      { route: "/v1/services/catalog", method: "GET" as const, normalStatus: 200 },
    ];
    for (let k = 0; k < 10; k++) {
      const ep = apiSamples[k % apiSamples.length]!;
      const isSpikeError = day === 14 && k >= 6;
      const isRoutine4xx = day !== 14 && k === 9 && day % 2 === 0;
      const statusCode = isSpikeError ? 503 : isRoutine4xx ? 422 : ep.normalStatus;
      events.push({
        eventId: nextId("evt_api"),
        eventType: "api.request_recorded",
        schemaVersion: CURRENT_EVENT_SCHEMA_VERSION,
        eventTimestamp: `${datePrefix}T${pad2(8 + k)}:10:00.000Z`,
        tenantId: "tenant_alpha",
        sourceService: "dip-api",
        correlationId: `corr_api_${day}_${k}`,
        payload: {
          routeTemplate: ep.route,
          method: ep.method,
          statusCode,
          latencyMs: isSpikeError ? 920 + k * 40 : 48 + k * 14,
          clientTier: k % 2 === 0 ? "standard" : "partner",
          ...(statusCode >= 400
            ? { errorCode: statusCode === 503 ? "UPSTREAM_TIMEOUT" : "VALIDATION_REJECTED" }
            : {}),
        },
      });
    }
  }

  // Add 2 low-volume region submissions (IN-GA: 2, IN-SK: 1) for K-anonymity small-cell suppression demo!
  const smallRegions = [
    { region: "IN-GA", day: 10, idx: 1 },
    { region: "IN-GA", day: 11, idx: 2 },
    { region: "IN-SK", day: 12, idx: 1 },
  ];
  for (const item of smallRegions) {
    events.push({
      eventId: nextId("evt_small_reg"),
      eventType: "application.submitted",
      schemaVersion: CURRENT_EVENT_SCHEMA_VERSION,
      eventTimestamp: `2026-10-${pad2(item.day)}T09:00:00.000Z`,
      tenantId: "tenant_alpha",
      sourceService: "dipindia",
      correlationId: `corr_small_${item.region}_${item.idx}`,
      references: {
        applicationRef: `app_small_${item.region}_${item.idx}`,
        regionCode: item.region,
        serviceCode: "SVC_BIRTH_CERT",
      },
      payload: {
        serviceCode: "SVC_BIRTH_CERT",
        channel: "web",
        regionCode: item.region,
      },
    });
  }

  // Add fresh open application < 30m before asOfIso (2026-10-15T18:00:00Z)
  events.push({
    eventId: nextId("evt_fresh"),
    eventType: "application.submitted",
    schemaVersion: CURRENT_EVENT_SCHEMA_VERSION,
    eventTimestamp: "2026-10-15T17:35:00.000Z",
    tenantId: "tenant_alpha",
    sourceService: "dipindia",
    correlationId: "corr_fresh_backlog",
    references: {
      applicationRef: "app_fresh_backlog",
      accountRef: "acct_a_1",
      serviceCode: "SVC_PASSPORT_RENEWAL",
      regionCode: "IN-DL",
    },
    payload: {
      serviceCode: "SVC_PASSPORT_RENEWAL",
      channel: "web",
      regionCode: "IN-DL",
    },
  });

  return events;
}

function buildTenantBetaEvents(): AnyAnalyticsEvent[] {
  const events: AnyAnalyticsEvent[] = [];
  let seq = 1;
  const nextId = (prefix: string) => `${prefix}_b_${seq++}`;

  for (let day = 5; day <= 15; day++) {
    const datePrefix = `2026-10-${pad2(day)}`;
    for (let i = 0; i < 3; i++) {
      const appRef = `app_b_${day}_${i}`;
      const payRef = `pay_b_${day}_${i}`;
      const serviceCode = i === 0 ? "SVC_CORP_FILING" : "SVC_GST_VERIFY";
      const regionCode = i === 0 ? "IN-MH" : "IN-GJ";

      events.push({
        eventId: nextId("sub"),
        eventType: "application.submitted",
        schemaVersion: CURRENT_EVENT_SCHEMA_VERSION,
        eventTimestamp: `${datePrefix}T09:${pad2(i * 10)}:00.000Z`,
        tenantId: "tenant_beta",
        sourceService: "dipindia",
        correlationId: `corr_${appRef}`,
        references: {
          applicationRef: appRef,
          accountRef: `acct_b_${(i % 4) + 1}`,
          serviceCode,
          regionCode,
        },
        payload: { serviceCode, channel: "api", regionCode },
      });

      events.push({
        eventId: nextId("cmp"),
        eventType: "application.completed",
        schemaVersion: CURRENT_EVENT_SCHEMA_VERSION,
        eventTimestamp: `${datePrefix}T10:${pad2(i * 10)}:00.000Z`,
        tenantId: "tenant_beta",
        sourceService: "dipindia",
        correlationId: `corr_${appRef}`,
        references: { applicationRef: appRef, serviceCode, regionCode },
        payload: {
          serviceCode,
          finalStatus: "approved",
          processingDurationMs: 32_000 + i * 4_000,
          slaTargetMs: 60_000,
          regionCode,
        },
      });

      events.push({
        eventId: nextId("pay"),
        eventType: "payment.succeeded",
        schemaVersion: CURRENT_EVENT_SCHEMA_VERSION,
        eventTimestamp: `${datePrefix}T09:${pad2(i * 10 + 2)}:00.000Z`,
        tenantId: "tenant_beta",
        sourceService: "dip-api",
        correlationId: `corr_${payRef}`,
        references: { paymentRef: payRef, applicationRef: appRef, serviceCode },
        payload: {
          currency: "INR",
          amountMinor: 250_000,
          feeMinor: 5_000,
          netAmountMinor: 245_000,
          paymentMethodCategory: "bank_transfer",
        },
      });
    }
  }

  return events;
}

export async function createSeededDemoStore(): Promise<InMemoryAnalyticsStore> {
  const store = new InMemoryAnalyticsStore(() => DEMO_FIXED_NOW_MS);
  await store.appendBatch(buildTenantAlphaEvents());
  await store.appendBatch(buildTenantBetaEvents());
  return store;
}
