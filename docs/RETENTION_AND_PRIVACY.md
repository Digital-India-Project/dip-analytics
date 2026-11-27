# Retention and Privacy Policy — `dip-analytics`

## 1. Privacy-by-Design Controls

`dip-analytics` operates strictly on **pseudonymized / opaque business references** and **aggregate metrics**:

- Direct customer PII (`email`, `phone`, `aadhaar`, `pan`, `passport`, `dob`, `fullName`, `address`, `pincode`, `ipAddress`, `userAgent`) is rejected at validation time by `src/privacy/pii-guard.ts`.
- Uploaded document payloads, file URLs, and base64/data-URI attachments are prohibited and rejected.
- Export helpers (`src/reporting/exporters.ts`) enforce **aggregate-only** outputs and explicitly block raw event/correlation/account identifiers (`eventId`, `correlationId`, `accountRef`, `applicationRef`, `paymentRef`, `traceId`, `spanId`).

---

## 2. Retention Policy Contract

Retention is modeled via `RetentionPolicyConfig` and `RetentionManagerPort` (`src/storage/interfaces.ts`):

- **`rawEventRetentionDays`**: Duration for which validated raw analytics events may be retained before tenant-scoped deletion (`deleteEventsOlderThan(tenantId, cutoffIso, dryRun)`).
- **`aggregateRetentionDays`**: Longer retention window for pre-computed, non-PII `AggregateSnapshotRecord` summaries used for historical trend analysis and `dip-automation` scheduled reports.
- **Dry-Run Support:** `applyRetention(authContext, policy, asOfIso, dryRun)` requires `analytics:admin` scope, computes an exact ISO cutoff timestamp (`asOfMs - rawEventRetentionDays * 86_400_000`), and supports non-destructive dry runs (`dryRun = true`) prior to deletion.
- **Tenant Isolation in Retention:** Retention sweeps operate strictly on `authContext.authenticatedTenantId` and also clean up corresponding `(tenantId, eventId)` idempotency fingerprints when raw events expire.
