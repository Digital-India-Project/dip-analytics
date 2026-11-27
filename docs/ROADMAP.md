# Roadmap — `dip-analytics`

## Completed (v0.1.0 Foundation + Scalable Capabilities)
- Versioned v1.0.0 analytics event contracts (13 event types), `EventUpcasterRegistry`, and Draft 2020-12 JSON Schemas.
- Recursive PII, document, credential, circular-reference, size, depth, and prototype-pollution guards.
- Strict tenant isolation boundary (`TenantAuthorizationContext` → branded `AuthorizedTenantQuery`).
- Deterministic aggregation modules (funnel, custom-stage funnel, status distribution, backlog aging, service performance, unit economics, SLA, revenue/refunds, payment metrics, payment reconciliation, partner performance, operator/queue workload, account activity, cohort retention, regional analytics, API metrics, time-series, period comparison, anomaly detection) using integer minor-unit money and explicit IANA timezone bucketing.
- Single-pass `StreamingAnalyticsProcessor` with checkpoint/resume and associative `mergeTenantRollups`.
- Database-agnostic storage, ingestion, idempotency, retention, and snapshot port interfaces + test-only `InMemoryAnalyticsStore`, plus framework-agnostic ecosystem bridges (`src/ecosystem/bridges.ts`).
- Aggregate-only CSV/JSON/NDJSON report exporters with OWASP formula injection neutralization, K-anonymity small-cell suppression, and pagination.
- 7 stable dashboard response contracts and deterministic builders for `dip-ui` / `dip-api`.
- GitHub Actions CI workflow, 100k-event synthetic benchmark harness (`npm run benchmark`), and 43 passing unit/contract tests across 10 `node:test` suites.

## Next Milestones (Ecosystem Integration)
1. **Milestone 2 — `dip-core` & `DIPINDIA` Emitter Alignment:** Publish shared opaque ID conventions and wire non-PII event emission in `DIPINDIA` workflows using `buildDipIndiaEvent`.
2. **Milestone 3 — `dip-api` Boundary & Persistent Storage Adapter:** Implement an approved database adapter behind `AnalyticsEventStorePort` / `IdempotencyStorePort` (governed by `dip-infrastructure`) and mount `DipApiAnalyticsHandler` in `dip-api`.
3. **Milestone 4 — `dip-automation` Scheduled Snapshots & Retention:** Wire periodic aggregate snapshot generation and retention policy sweeps via `DipAutomationScheduledRunner`.
4. **Milestone 5 — `dip-ui` Dashboard Consumption:** Connect `dip-ui` visualization components to the 7 dashboard contracts served via `dip-api`.
