# `@digital-india-project/dip-analytics`

Universal, secure, tenant-aware analytics domain, versioned event contracts, single-pass streaming rollups, deterministic aggregations, and aggregate reporting foundation for **Digital India Project**.

> **Scope:** Pure TypeScript domain & contract library (`dependencies: {}`, Node.js `>=22.0.0 <23.0.0`). Independent of any specific dashboard UI (`dip-ui`), API gateway (`dip-api`), cloud provider, or production database.

---

## Implemented Capabilities

- **Versioned Event Contracts (`v1.0.0`), Upcasters & JSON Schemas:** 13 strongly typed business and operational event contracts (`application.*`, `payment.*`, `partner.*`, `operator.action_recorded`, `sla.threshold_breached`, `api.request_recorded`), `EventUpcasterRegistry` for deterministic legacy schema migrations, Draft 2020-12 JSON Schema exports, and W3C OpenTelemetry trace context validation.
- **Privacy & Tenant Isolation Boundaries:**
  - Trusted backend `TenantAuthorizationContext` (`issuedBy: "dip-api" | "dip-security"`) required to mint branded `AuthorizedTenantQuery` objects; browser-supplied `tenantId` overrides are rejected.
  - Deep recursive PII, government ID (Aadhaar/PAN/passport), credential, uploaded document/data-URI, circular-reference, prototype-pollution, input-size (`16 KiB`), and date-range (`366` days / `10,000` bucket cap) guards.
  - Optional K-anonymity small-cell suppression (`suppress` or `rollup_other`) in CSV and NDJSON exports.
- **Deterministic & Scalable Analytics Capabilities:**
  - Application funnel & universal custom-stage funnel (`aggregateCustomStageFunnel`), application status distribution & transitions, **open-application backlog & SLA aging histogram** (`aggregateBacklogAging`), service performance, processing time percentiles & SLA bottlenecks.
  - Integer minor-unit (`BigInt`-backed) revenue & refunds, **service unit economics & net contribution margin** (`aggregateServiceUnitEconomics`), payment success/failure rates, **payment reconciliation** (`settled`, `unsettled`, `orphanedRefund`, `overRefunded`, `currencyDiscrepancy`), partner performance & commissions, operator & queue workload.
  - **Account activity metrics** & **cohort retention curves** (`aggregateAccountCohortRetention` using opaque `accountRef` only), **geographic & regional aggregate analytics** (`regionCode`), API volume/error/latency metrics, IANA timezone-aware historical time-series, **period-over-period comparisons**, and **deterministic rolling-baseline anomaly detection** (`detectTimeSeriesAnomalies`).
  - **Single-pass `StreamingAnalyticsProcessor` (with `exportCheckpoint`/`fromCheckpoint` resumability) & associative `mergeTenantRollups`** for `AsyncIterable` streams and horizontally scalable distributed rollups.
- **Storage, Ecosystem Bridges & Ingestion Ports:** Database-agnostic interfaces for event ingestion, persistence, `AsyncIterable` cursor reads (`iterateByTenant`), SHA-256 idempotency conflict detection, retention sweeps, and aggregate snapshots; test-only `InMemoryAnalyticsStore`; and framework-agnostic bridges (`src/ecosystem/bridges.ts`) for `DIPINDIA`, `dip-api`, and `dip-automation`.
- **Aggregate-Only Reporting & Exports:** Date-range, service, partner, region, and currency filters; bounded pagination (`<= 1000`); JSON & NDJSON (`application/x-ndjson`) report exports; and RFC 4180 CSV export with OWASP spreadsheet formula injection neutralization and K-anonymity small-cell suppression.
- **7 Dashboard Response Contracts:** Typed response models and builders for `dip-ui` and `dip-api` (Executive Overview, Application Operations, Finance, Partner Management, Operator Performance, Service Performance, API Analytics).

---

## Quick Verification

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
npm run benchmark
```

For the interactive DIP Analytics Workbench UI and contract inspection endpoints on `http://0.0.0.0:3000` (`/`, `/health`, `/manifest`, `/schemas`, `/capabilities`):

```bash
npm run dev
```

---

## Documentation Index

- [Implementation Audit](docs/IMPLEMENTATION_AUDIT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Integration Contracts](docs/INTEGRATION_CONTRACTS.md)
- [Data Dictionary](docs/DATA_DICTIONARY.md)
- [Analytics Metrics Specification](docs/ANALYTICS_METRICS.md)
- [Security Model](docs/SECURITY_MODEL.md)
- [Retention & Privacy Policy](docs/RETENTION_AND_PRIVACY.md)
- [Testing Strategy](docs/TESTING.md)
- [Roadmap](docs/ROADMAP.md)
- [Security Policy](SECURITY.md)
- [Changelog](CHANGELOG.md)
- [Integration Manifest](integration/manifest.json)
