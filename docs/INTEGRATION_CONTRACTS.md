# Ecosystem Integration Contracts — `dip-analytics`

This document defines explicit integration boundaries between `@digital-india-project/dip-analytics` and sibling Digital India Project repositories. No other repository is assumed to already implement these calls; each contract specifies ownership, expected I/O, versioning, auth, tenant boundaries, error handling, and current status.

---

## 1. `DIPINDIA` → `dip-analytics` (Authoritative Business Events)

- **Contract Owner:** Shared (`DIPINDIA` emits domain events; `dip-analytics` owns the v1 event schema contract).
- **Expected Input / Output:**
  - Input: `AnalyticsEventEnvelope` (`application.*`, `payment.*`, `partner.*`, `operator.*`, `sla.threshold_breached`) containing opaque references only.
  - Output: `EventIngestionResult` (`accepted` | `duplicate` | `rejected`) or `BatchIngestionSummary`.
- **Version:** `1.0.0` (Envelope & payload major version `1`).
- **Authentication Requirement:** Service-to-service authenticated transport via `dip-api` / `dip-security` issuing `TenantAuthorizationContext` with scope `analytics:ingest`.
- **Tenant Boundary:** `event.tenantId` must strictly equal `authContext.authenticatedTenantId`; cross-tenant emission is rejected with `TENANT_BOUNDARY_VIOLATION`.
- **Error Handling:** Validation errors (`EVENT_VALIDATION_ERROR`, `PRIVACY_VIOLATION`, `INPUT_SIZE_LIMIT_EXCEEDED`), version incompatibility (`EVENT_VALIDATION_ERROR`), and idempotency payload mismatches (`IDEMPOTENCY_CONFLICT`) reject individual events without corrupting valid batch items.
- **Current Implementation Status:** **Defined & tested in `dip-analytics`** (`src/contracts/events.ts`, `src/ecosystem/bridges.ts#buildDipIndiaEvent`, `src/validation/event-validator.ts`, `src/storage/in-memory-store.ts`). Upstream emitter wiring in `DIPINDIA` is pending integration.

---

## 2. `dip-api` → `dip-analytics` (Authenticated Ingestion & Tenant-Authorized Reporting)

- **Contract Owner:** `dip-api` owns HTTP transport & token verification; `dip-analytics` owns validation, query authorization tokens, aggregations, and export serialization.
- **Expected Input / Output:**
  - Ingestion: Untrusted JSON event(s) + verified `TenantAuthorizationContext` → `EventIngestionResult` / `BatchIngestionSummary`.
  - Reporting: `TenantAuthorizationContext` + `TenantQueryInput` → `AuthorizedTenantQuery` → Dashboard responses (`src/dashboards/`) or `CsvExportOutput` / `NdjsonExportOutput` / `JsonReportExport`.
  - API Telemetry: `api.request_recorded` events emitted per route template (no raw query strings containing PII).
- **Version:** `1.0.0`.
- **Authentication Requirement:** `dip-api` must authenticate caller credentials and construct `TenantAuthorizationContext` with `issuedBy: "dip-api"` or `"dip-security"`. Browser-supplied `tenantId` parameters must never be trusted.
- **Tenant Boundary:** `authorizeTenantQuery()` binds the branded `AuthorizedTenantQuery` exclusively to `authContext.authenticatedTenantId` and rejects any mismatched `claimedTenantId` or `query.tenantId` with `TENANT_BOUNDARY_VIOLATION`.
- **Error Handling:** Domain errors inherit `AnalyticsDomainError` with stable machine-readable `code` strings (`TENANT_BOUNDARY_VIOLATION`, `PRIVACY_VIOLATION`, `DATE_RANGE_VIOLATION`, `CURRENCY_MISMATCH`, `EXPORT_SECURITY_ERROR`, `IDEMPOTENCY_CONFLICT`) mapped via `DipApiAnalyticsHandler` (`src/ecosystem/bridges.ts`) to HTTP 400/403/409/413/422 status codes.
- **Current Implementation Status:** **Handler bridge defined & tested in `dip-analytics`** (`src/ecosystem/bridges.ts#DipApiAnalyticsHandler`). HTTP server mounting in `dip-api` is pending integration.

---

## 3. `dip-core` → `dip-analytics` (Shared Domain Identifiers & Compatible Contracts)

- **Contract Owner:** `dip-core` owns canonical domain identifier formats (`tenantId`, `serviceCode`, `regionCode`, opaque refs); `dip-analytics` enforces opaque reference constraints and JSON Schemas.
- **Expected Input / Output:**
  - Shared opaque reference shapes (`OpaqueBusinessReferences`) and JSON Schema Draft 2020-12 definitions (`src/schemas/event-schemas.ts`).
- **Version:** `1.0.0`.
- **Authentication Requirement:** N/A (compile-time & schema-time contract).
- **Tenant Boundary:** `tenantId` format (`^[a-zA-Z0-9_-]{1,64}$`) must remain consistent across `dip-core` and `dip-analytics`.
- **Error Handling:** Incompatible schema major versions fail `checkSchemaCompatibility()` (`supportedMajor: 1`); legacy compatible payloads can be migrated via `EventUpcasterRegistry` (`src/contracts/upcasters.ts`).
- **Current Implementation Status:** **Defined & tested in `dip-analytics`**. Cross-package import alignment with `dip-core` is pending.

---

## 4. `dip-security` → `dip-analytics` (Security & Authorization Integration)

- **Contract Owner:** `dip-security` owns token verification, RBAC policy definitions, and secret management; `dip-analytics` enforces local boundary invariants (`TenantAuthorizationContext`, `PiiGuard`, CSV formula neutralization).
- **Expected Input / Output:**
  - Input: Verified `TenantAuthorizationContext` (`issuedBy: "dip-security" | "dip-api"`, `actorRole`, `scopes`: `analytics:read` | `analytics:ingest` | `analytics:admin`).
  - Output: Privacy/tenant audit errors (`PrivacyViolationError`, `TenantBoundaryViolationError`, `ExportSecurityError`).
- **Version:** `1.0.0`.
- **Authentication Requirement:** Mandatory before calling any query, aggregation, retention, or export function.
- **Tenant Boundary:** Cross-tenant reads/writes/exports are denied deterministically regardless of caller role unless explicitly mediated by a future audited platform-level contract.
- **Error Handling:** Fail-closed on missing context, untrusted `issuedBy`, missing scope, prototype-pollution keys, or PII detection.
- **Current Implementation Status:** **Defined & tested in `dip-analytics`**. External token-issuer wiring in `dip-security` is pending.

---

## 5. `dip-ui` → `dip-analytics` (Dashboard Response Models)

- **Contract Owner:** `dip-analytics` owns the 7 typed dashboard response contracts (`src/dashboards/contracts.ts`); `dip-ui` owns presentation components.
- **Expected Input / Output:**
  - Output: `ExecutiveOverviewDashboard`, `ApplicationOperationsDashboard`, `FinanceDashboard`, `PartnerManagementDashboard`, `OperatorPerformanceDashboard`, `ServicePerformanceDashboard`, `ApiAnalyticsDashboard`.
- **Version:** `1.0.0` (`DASHBOARD_CONTRACT_VERSION`).
- **Authentication Requirement:** `dip-ui` never calls `dip-analytics` directly with raw DB access; `dip-ui` fetches pre-authorized JSON from `dip-api`.
- **Tenant Boundary:** Every dashboard response includes `metadata.tenantId` and `tenantId`; UI must never supply an authoritative tenant override.
- **Error Handling:** `metadata.dataCompleteness` exposes `partialData`, `duplicatesRemoved`, and human-readable `warnings` for graceful empty/partial UI states.
- **Current Implementation Status:** **Defined & tested in `dip-analytics`**. UI consumption in `dip-ui` is pending.

---

## 6. `dip-automation` → `dip-analytics` (Scheduled Aggregate Reports)

- **Contract Owner:** `dip-automation` owns schedule execution (cron/events); `dip-analytics` owns deterministic aggregation builders, `AggregateSnapshotStorePort`, and `RetentionManagerPort`.
- **Expected Input / Output:**
  - Input: Scheduled `AuthorizedTenantQuery` window + `TenantAuthorizationContext` (`analytics:read`, `analytics:ingest`, `analytics:admin`).
  - Output: `AggregateSnapshotRecord` persisted via `AggregateSnapshotStorePort`, plus `RetentionExecutionResult` from `RetentionManagerPort`.
- **Version:** `1.0.0`.
- **Authentication Requirement:** Service identity authorized per tenant by `dip-security` / `dip-api`.
- **Tenant Boundary:** Snapshots and retention sweeps run strictly per-tenant (`snapshot.tenantId === authContext.authenticatedTenantId`).
- **Error Handling:** Idempotent snapshot generation over fixed `[from, to)` windows; dry-run retention mode supported.
- **Current Implementation Status:** **Runner bridge & in-memory reference tested in `dip-analytics`** (`src/ecosystem/bridges.ts#DipAutomationScheduledRunner`). Scheduler workers in `dip-automation` are pending.

---

## 7. `dip-docs` → `dip-analytics` (Documentation References)

- **Contract Owner:** `dip-analytics` owns local technical/metric/privacy docs and `integration/manifest.json`; `dip-docs` indexes platform documentation.
- **Expected Input / Output:** Markdown specs (`docs/*.md`), `integration/manifest.json`, and Draft 2020-12 JSON Schemas (`src/schemas/event-schemas.ts`).
- **Version:** `1.0.0`.
- **Authentication Requirement:** Public/internal developer documentation (zero secrets or customer data).
- **Tenant Boundary:** Documentation contains synthetic examples only.
- **Error Handling:** CI validates build and schema exports stay synchronized.
- **Current Implementation Status:** **Complete in `dip-analytics`**. Central indexing in `dip-docs` is pending.
