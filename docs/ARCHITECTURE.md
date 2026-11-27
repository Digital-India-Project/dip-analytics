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
        │
        ├── src/schemas/event-schemas.ts    (JSON Schema Draft 2020-12 exports)
        ├── src/telemetry/context.ts        (W3C traceparent + PII-free OTEL attributes)
        ├── src/utils/time.ts               (strict ISO-8601, date ranges, IANA tz buckets)
        ├── src/utils/money.ts              (integer minor units, BigInt bps, currency guard)
        ├── src/privacy/pii-guard.ts        (recursive PII/doc/prototype-pollution scan)
        └── src/privacy/tenant-boundary.ts  (TenantAuthorizationContext -> AuthorizedTenantQuery)
                │
                ├── src/validation/event-validator.ts
                ├── src/reliability/index.ts        (SHA-256 fingerprint, sort, dedupe, topN cap)
                ├── src/aggregations/*              (10 deterministic aggregation modules)
                ├── src/storage/*                   (ports + test-only InMemoryAnalyticsStore)
                ├── src/reporting/*                 (filters, pagination, CSV/JSON exporters)
                └── src/dashboards/*                (7 dashboard contracts + builders)
```

---

## 3. Event Time vs. Ingestion Time

`dip-analytics` treats `eventTimestamp` and `ingestedAt` as strictly separate concepts:

1. **`eventTimestamp` (Domain Occurrence Time):** Mandatory on every event. Emitted by the authoritative source service (`DIPINDIA`, `dip-api`, etc.) when the business event occurred. **All date-range window filters (`[from, to)`) and time-series buckets (`hour`, `day`, `week`, `month`) use `eventTimestamp`.**
2. **`ingestedAt` (Ingestion Boundary Time):** Optional metadata assigned by the ingestion boundary when the event is accepted. Used for operational lag observability and deterministic tie-breaking during out-of-order reconciliation (`eventTimestamp` → `ingestedAt` → `eventId`), **never** to shift business metrics across reporting days.

---

## 4. Runtime Contract Inspection Server

For container/preview verification in Node.js 22 (`npm run dev` / `npm start`), `src/runtime/contract-server.ts` exposes a minimal read-only HTTP server on `0.0.0.0:3000` with endpoints:
- `GET /` — Package role, contract versions, and supported event types.
- `GET /health` — Service health and schema versions.
- `GET /manifest` — Contents of `integration/manifest.json`.
- `GET /schemas` — Draft 2020-12 JSON Schemas for envelope and payloads.

It is strictly a contract inspection endpoint and **not** a dashboard UI.
