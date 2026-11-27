# Architecture — `dip-analytics`

## 1. Purpose and Boundaries

`@digital-india-project/dip-analytics` is the pure TypeScript analytics domain, validation, privacy enforcement, deterministic aggregation, and reporting contract package for Digital India Project.

### What Belongs Here
- Versioned analytics event envelopes and typed payloads (`src/contracts/`, `src/schemas/`).
- Strict runtime validation, PII/document prohibition, input size/depth limits, and unknown-field policies (`src/validation/`, `src/privacy/`).
- Tenant isolation boundaries (`AuthorizedTenantQuery`, `TenantAuthorizationContext`) (`src/privacy/tenant-boundary.ts`).
- Deterministic aggregation engines using integer minor-unit money and explicit timezone bucketing (`src/aggregations/`, `src/utils/`).
- Database-agnostic storage, ingestion, idempotency, retention, and snapshot port interfaces plus a test-only `InMemoryAnalyticsStore` (`src/storage/`).
- Aggregate-only CSV/JSON report export with spreadsheet formula injection neutralization (`src/reporting/`).
- Stable dashboard response contracts and deterministic builders for `dip-ui` and `dip-api` (`src/dashboards/`).

### What Does NOT Belong Here
- Business workflow orchestration (remains in `DIPINDIA`).
- HTTP API routing, JWT verification, or rate limiting (remains in `dip-api`).
- Shared core entity definitions (remains in `dip-core`).
- Auth/security policy enforcement infrastructure (remains in `dip-security`).
- Frontend UI rendering or charts (remains in `dip-ui`).
- Cron schedulers or event queue workers (remains in `dip-automation`).
- Production database drivers or live cloud provider SDKs.

---

## 2. Module Dependency Graph

```
src/contracts/events.ts        (versioned event types, compat check, base error)
src/contracts/upcasters.ts     (EventUpcasterRegistry for multi-step schema upgrades)
        │
        ├── src/schemas/event-schemas.ts    (JSON Schema Draft 2020-12 exports)
        ├── src/telemetry/context.ts        (W3C traceparent + PII-free OTEL attributes)
        ├── src/utils/time.ts               (strict ISO-8601, date ranges, IANA tz buckets)
        ├── src/utils/money.ts              (integer minor units, BigInt bps, currency guard)
        ├── src/privacy/pii-guard.ts        (recursive PII/doc/circular/prototype-pollution scan)
        └── src/privacy/tenant-boundary.ts  (TenantAuthorizationContext -> AuthorizedTenantQuery)
                │
                ├── src/validation/event-validator.ts
                ├── src/reliability/index.ts        (SHA-256 fingerprint, sort, dedupe, topN cap)
                ├── src/aggregations/*              (cohort, anomaly, unit-econ, backlog, streaming, etc.)
                ├── src/storage/*                   (ports + test-only InMemoryAnalyticsStore)
                ├── src/reporting/*                 (filters, pagination, k-anonymity, CSV/JSON/NDJSON)
                ├── src/dashboards/*                (7 dashboard contracts + builders)
                └── src/ecosystem/*                 (DIPINDIA, dip-api, dip-automation bridges)
```

---

## 3. Event Time vs. Ingestion Time

`dip-analytics` treats `eventTimestamp` and `ingestedAt` as strictly separate concepts:

1. **`eventTimestamp` (Domain Occurrence Time):** Mandatory on every event. Emitted by the authoritative source service (`DIPINDIA`, `dip-api`, etc.) when the business event occurred. **All date-range window filters (`[from, to)`) and time-series buckets (`hour`, `day`, `week`, `month`) use `eventTimestamp`.**
2. **`ingestedAt` (Ingestion Boundary Time):** Optional metadata assigned by the ingestion boundary when the event is accepted. Used for operational lag observability and deterministic tie-breaking during out-of-order reconciliation (`eventTimestamp` → `ingestedAt` → `eventId`), **never** to shift business metrics across reporting days.

---

## 4. Runtime Contract & Interactive Workbench Server

For local preview and contract verification in Node.js 22 (`npm run dev` / `npm start`), `src/runtime/contract-server.ts` runs on `0.0.0.0:3000`:
- `GET /` — Serves the interactive DIP Analytics Workbench UI (`public/index.html`, Tailwind v4 `ui/styles.css`, and strict TypeScript `ui/client.ts`) for browser `text/html` requests, or returns the JSON package/contract summary for API clients.
- `GET /health`, `/manifest`, `/schemas`, `/capabilities` — Contract inspection endpoints for health, integration manifest, Draft 2020-12 schemas, and capabilities catalog.
- `GET /api/workbench/overview`, `GET /api/workbench/export`, `POST /api/workbench/validate-event`, `POST /api/workbench/test-tenant-boundary` — Synthetic-only sandbox endpoints powered by the `dip-analytics` domain engine (`src/runtime/demo-seed.ts`), demonstrating multi-tenant isolation, live PII/schema validation, K-anonymity exports, and all dashboard/advanced aggregations with zero PII or external databases.
