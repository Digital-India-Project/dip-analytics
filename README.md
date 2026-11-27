# DIP Analytics

Privacy-conscious analytics and reporting domain package for the Digital India Project ecosystem.

## Scope

This repository owns reusable analytics contracts and deterministic aggregation for application funnels, status reporting, revenue and refunds, partner performance, and aggregate CSV export.

It is a domain package, not a dashboard application, event broker, data warehouse, or source-of-truth database.

## Privacy and tenancy

- Analytics events are tenant-scoped.
- Never send names, email addresses, phone numbers, Aadhaar numbers, PAN, GSTIN, addresses, identity documents, payment credentials, or raw document contents.
- Use opaque internal references and approved one-way pseudonymous hashes only where justified.
- Enforce tenant authorization in the trusted API/service layer before calling this package.
- Never treat a client-supplied tenant ID as proof of authorization.
- Amounts are integer minor units; currency is a three-letter uppercase code.

## Development

Requires Node.js 20 or later.

```bash
npm install
npm run typecheck
npm test
npm run build
```

These commands are documented for local execution. Do not mark CI or tests as passing until they have actually run.

## Integration

DIPINDIA remains the application authority. The API/service layer should authenticate the caller, resolve tenant membership server-side, validate and normalize events, persist them through an approved store adapter, query authorized tenant-scoped ranges, and return aggregate reports rather than raw personal records.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/INTEGRATION_CONTRACTS.md](docs/INTEGRATION_CONTRACTS.md), and [SECURITY.md](SECURITY.md).
