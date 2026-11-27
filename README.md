# `@digital-india-project/dip-analytics`

Secure, tenant-aware analytics domain, versioned event contracts, deterministic aggregations, and aggregate reporting foundation for **Digital India Project**.

> **Scope:** Pure TypeScript domain & contract library (`dependencies: {}`, Node.js `>=22.0.0 <23.0.0`). Independent of any specific dashboard UI (`dip-ui`), API gateway (`dip-api`), cloud provider, or production database.

---

## Implemented Capabilities

- **Versioned Event Contracts (`v1.0.0`) & JSON Schemas:** 13 strongly typed business and operational event contracts (`application.*`, `payment.*`, `partner.*`, `operator.action_recorded`, `sla.threshold_breached`, `api.request_recorded`) with Draft 2020-12 JSON Schema exports and W3C OpenTelemetry trace context validation.
- **Privacy & Tenant Isolation Boundaries:**
  - Trusted backend `TenantAuthorizationContext` (`issuedBy: "dip-api" | "dip-security"`) required to mint branded `AuthorizedTenantQuery` objects; browser-supplied `tenantId` overrides are rejected.
  - Deep recursive PII, government ID (Aadhaar/PAN/passport), credential, uploaded document/data-URI, prototype-pollution, input-size (`16 KiB`), and date-range (`366` days) guards.
- **10 Deterministic Aggregation Modules:**
  - Application funnel, application status distribution & transitions, service performance, processing time percentiles & SLA bottlenecks, revenue & refunds, partner performance & commissions, operator workload, payment success/failure rates, API volume/error/latency metrics, and timezone-aware historical time-series.
  - Integer minor-unit financial arithmetic (`BigInt`-backed) with strict currency separation (`CurrencyMismatchError`).
- **Storage & Ingestion Ports:** Database-agnostic interfaces for event ingestion, persistence, SHA-256 idempotency conflict detection, tenant-scoped reads, retention sweeps, and aggregate snapshots, plus a test-only `InMemoryAnalyticsStore`.
- **Aggregate-Only Reporting & Exports:** Date-range, service, partner, region, and currency filters; bounded pagination (`<= 1000`); JSON report export; and RFC 4180 CSV export with OWASP spreadsheet formula injection neutralization.
- **7 Dashboard Response Contracts:** Typed response models and builders for `dip-ui` and `dip-api` (Executive Overview, Application Operations, Finance, Partner Management, Operator Performance, Service Performance, API Analytics).

---

## Quick Verification

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

For local container/contract inspection on `http://0.0.0.0:3000` (`/health`, `/manifest`, `/schemas`):

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
