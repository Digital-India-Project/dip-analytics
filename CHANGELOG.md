# Changelog

All notable changes to `@digital-india-project/dip-analytics` are documented in this file.

## [0.1.0] - 2026-11-27

### Added
- **Event Contracts & Schemas:** Added 13 versioned v`1.0.0` event contracts (`src/contracts/events.ts`), schema compatibility checker, Draft 2020-12 JSON Schemas (`src/schemas/event-schemas.ts`), and W3C `traceparent` / OpenTelemetry attribute helpers (`src/telemetry/context.ts`).
- **Privacy & Tenant Isolation:** Added recursive PII/document/prototype-pollution guard (`src/privacy/pii-guard.ts`), trusted `TenantAuthorizationContext` and branded `AuthorizedTenantQuery` enforcement (`src/privacy/tenant-boundary.ts`), and strict runtime event/batch validation (`src/validation/event-validator.ts`).
- **Reliability & Utilities:** Added strict calendar-aware ISO-8601 parsing, date-range guardrails, IANA timezone bucketing (`src/utils/time.ts`), `BigInt`-backed integer minor-unit financial arithmetic (`src/utils/money.ts`), deterministic ordering, deduplication, SHA-256 event fingerprinting, and high-cardinality `__other__` rollup (`src/reliability/index.ts`).
- **Aggregations:** Implemented 10 deterministic aggregation modules under `src/aggregations/` (funnel, status distribution, service performance, processing/SLA, revenue/refunds, partner performance, operator workload, payment metrics, API metrics, historical time-series).
- **Storage, Reporting & Dashboards:** Added database-agnostic storage/ingestion/idempotency/retention/snapshot interfaces and test-only `InMemoryAnalyticsStore` (`src/storage/`), aggregate-only CSV/JSON exporters with OWASP formula neutralization (`src/reporting/`), and 7 stable dashboard response contracts and builders (`src/dashboards/`).
- **Documentation, Tests & CI:** Added 8 synthetic `node:test` suites, full `docs/*` suite, `integration/manifest.json`, `SECURITY.md`, and `.github/workflows/ci.yml`.
