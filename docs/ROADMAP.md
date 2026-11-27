# Roadmap — `dip-analytics`

## Completed (v0.1.0 Foundation)
- Versioned v1.0.0 analytics event contracts (13 event types) and Draft 2020-12 JSON Schemas.
- Recursive PII, document, credential, size, depth, and prototype-pollution guards.
- Strict tenant isolation boundary (`TenantAuthorizationContext` → branded `AuthorizedTenantQuery`).
- 10 deterministic aggregation modules using integer minor-unit money and explicit IANA timezone bucketing.
- Database-agnostic storage, ingestion, idempotency, retention, and snapshot port interfaces + test-only `InMemoryAnalyticsStore`.
- Aggregate-only CSV/JSON report exporters with OWASP formula injection neutralization and pagination.
- 7 stable dashboard response contracts and deterministic builders for `dip-ui` / `dip-api`.
- GitHub Actions CI workflow and comprehensive `node:test` unit suite.

## Next Milestones (Ecosystem Integration)
1. **Milestone 2 — `dip-core` & `DIPINDIA` Emitter Alignment:** Publish shared opaque ID conventions and wire non-PII event emission from `DIPINDIA` workflows.
2. **Milestone 3 — `dip-api` Boundary & Persistent Storage Adapter:** Implement an approved database adapter behind `AnalyticsEventStorePort` / `IdempotencyStorePort` (governed by `dip-infrastructure`) and mount authenticated ingestion/query endpoints in `dip-api`.
3. **Milestone 4 — `dip-automation` Scheduled Snapshots & Retention:** Wire periodic aggregate snapshot generation and retention policy sweeps via `AggregateSnapshotStorePort` and `RetentionManagerPort`.
4. **Milestone 5 — `dip-ui` Dashboard Consumption & Geographic Expansion:** Connect `dip-ui` views to the 7 dashboard contracts and add region-level rollup reports where `regionCode` coverage matures.
5. **Milestone 6 — Scale & Benchmark Harness:** Add synthetic 100k+ event throughput benchmarks and streaming/chunked aggregation optimizations if required by production volume.
