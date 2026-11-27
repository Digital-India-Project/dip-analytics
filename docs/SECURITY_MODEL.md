# Security Model — `dip-analytics`

## 1. Threat Model & Trust Boundaries

`dip-analytics` is a domain and aggregation library consumed by trusted backend services (`dip-api`, `dip-automation`). It assumes **all raw event payloads and query parameters may originate from untrusted callers** until verified at the boundary.

### Mandatory Invariants
1. **Tenant Isolation as a Hard Security Boundary:**
   - Every read, aggregation, retention sweep, snapshot operation, and report export requires a `TenantAuthorizationContext` constructed by a trusted backend issuer (`"dip-api"` or `"dip-security"`) with an explicit scope (`analytics:read`, `analytics:ingest`, or `analytics:admin`).
   - Browser/client-supplied `tenantId` parameters are **never** accepted as authorization. If a `claimedTenantId` or `query.tenantId` differs from `authContext.authenticatedTenantId`, `TenantBoundaryViolationError` is thrown immediately.
   - All aggregation functions perform a defense-in-depth `assertEventsBelongToTenant()` check before processing.
2. **PII & Document Prohibition:**
   - `pii-guard.ts` recursively inspects every incoming object for forbidden key names (emails, phone numbers, Aadhaar, PAN, passport, bank accounts, uploaded document URLs, base64 files, credentials), forbidden value patterns (emails, PAN, grouped Aadhaar, E.164 phones, JWTs, data URIs, card numbers, IPv4s), and prototype-pollution keys (`__proto__`, `constructor`, `prototype`).
   - Even when `unknownFieldPolicy: "strip_and_audit"` is enabled for forward-compatible minor versions, PII scanning runs **before** field stripping so sensitive data is rejected rather than silently discarded.
3. **Input Size, Nesting & Date-Range Guardrails:**
   - Single event limit: `16 KiB` (`MAX_EVENT_BYTES`), max nesting depth `6`, max string length `512`.
   - Batch limit: `500` events / `1 MiB`.
   - Query window limit: `366` days (`DEFAULT_MAX_QUERY_RANGE_DAYS`), strict calendar-validated ISO-8601 timestamps.
   - Pagination limit: `1000` rows per page (`MAX_EXPORT_PAGE_SIZE`).
4. **Export & CSV Formula Injection Protection:**
   - Exports are strictly aggregate-only. Raw identifiers (`eventId`, `correlationId`, `accountRef`, `applicationRef`, `paymentRef`, `traceId`, `spanId`) and PII patterns are blocked by `exportAggregateRowsToCsv` and `exportAggregateReportToJson`.
   - `sanitizeCsvCellValue()` neutralizes OWASP CSV injection vectors (`=`, `+`, `-`, `@`, `\t`, `\r`, including after leading whitespace) by prefixing `'` and applying RFC 4180 quoting.
5. **No Production Connections or Secrets:**
   - Zero runtime dependencies, zero embedded credentials, zero live database/cloud SDK connections.
