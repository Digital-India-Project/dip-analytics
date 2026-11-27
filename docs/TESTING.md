# Testing Strategy — `dip-analytics`

## 1. Test Runner & Environment

- **Runtime:** Node.js `22.x` using the built-in `node:test` runner and `node:assert/strict` (zero third-party test framework dependencies).
- **Synthetic Data Only:** All fixtures in `tests/helpers/synthetic-fixtures.ts` and `tests/unit/*.test.ts` use synthetic tenant IDs (`tenant_alpha`, `tenant_beta`), synthetic opaque references, and synthetic integer minor-unit amounts. No real customer records, production databases, or credentials exist.

---

## 2. Commands

- Typecheck: `npm run typecheck` (`tsc -p tsconfig.json --noEmit`)
- Lint: `npm run lint` (`eslint src tests && tsc -p tsconfig.json --noEmit`)
- Unit & Contract Tests: `npm test` (`tsc -p tsconfig.test.json && node --test ".test-dist/tests/**/*.test.js"`)
- Build: `npm run build` (`tsc -p tsconfig.build.json`)
- Benchmark (100k synthetic events): `npm run benchmark`

---

## 3. Test Suites (`tests/unit/`)

| Suite File | Coverage Focus |
|---|---|
| `event-contracts.test.ts` | All 13 event types, semver schema compatibility (`1.x.x` vs `2.x.x`), JSON Schema Draft 2020-12 exports, W3C `traceparent` & PII-free OTEL attributes. |
| `privacy-and-tenant.test.ts` | Cross-tenant `claimedTenantId` / `query.tenantId` rejection, untrusted issuer & missing scope rejection, `assertEventsBelongToTenant`, PII keys & regex patterns, prototype pollution (`__proto__`), unknown-field policies (`reject` vs `strip_and_audit`), payload byte limits. |
| `aggregations-core.test.ts` | Empty datasets (no `NaN`/`Infinity`), out-of-order lifecycle reconciliation, duplicate deduplication, high-cardinality `__other__` rollups, SLA compliance & stage bottlenecks. |
| `financial-and-currency.test.ts` | Integer minor-unit arithmetic (`BigInt`), basis-point rounding, currency formatting (INR, USD, JPY), multi-currency separation, `CurrencyMismatchError`, payment success/failure rates. |
| `time-and-timezone.test.ts` | Strict calendar ISO-8601 parsing (leap-year checks), date range limits, UTC vs `Asia/Kolkata` (`+05:30`) day boundaries, `eventTimestamp` vs `ingestedAt` independence. |
| `storage-idempotency.test.ts` | `InMemoryAnalyticsStore` ingestion, idempotent replay vs `IDEMPOTENCY_CONFLICT`, cross-tenant ingestion/read blocking, retention `dryRun` and execution. |
| `reporting-export.test.ts` | OWASP CSV formula injection neutralization (`=`, `+`, `-`, `@`, `\t`, `\r`, leading whitespace), RFC 4180 quoting, pagination bounds, raw-identifier blocking, JSON/NDJSON report tenant validation. |
| `dashboards.test.ts` | End-to-end validation of all 7 dashboard builders (`executive_overview`, `application_operations`, `finance`, `partner_management`, `operator_performance`, `service_performance`, `api_analytics`). |
| `universal-scalable.test.ts` | Geographic analytics, payment reconciliation (settled/unsettled/orphaned/over-refund), opaque account activity, queue-level operator metrics, custom-stage funnels, period comparisons, 10,000-event `AsyncIterable` streaming + `mergeTenantRollups`, NDJSON export, circular object blocking, and bucket cap enforcement. |
| `advanced-capabilities.test.ts` | Account cohort retention curves, deterministic rolling-baseline anomaly detection, service unit economics & net margin, open-application backlog aging histograms, K-anonymity small-cell suppression (`suppress` & `rollup_other`), `StreamingAnalyticsProcessor` checkpoint/resume deduplication, `EventUpcasterRegistry` migrations & cycle detection, and end-to-end `DIPINDIA`/`dip-api`/`dip-automation` ecosystem bridge tests. |
| `workbench-demo.test.ts` | End-to-end verification of synthetic `tenant_alpha` and `tenant_beta` workbench datasets, multi-currency financial aggregations, backlog aging, anomaly alerts, and K-anonymity CSV small-cell suppression. |
