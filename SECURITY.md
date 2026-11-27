# Security Policy

## Data classification

Analytics inputs are restricted to operational metadata and aggregate-safe financial amounts. Direct personal identifiers and document contents are prohibited.

Never ingest:
- Aadhaar, PAN, GSTIN, passport, or other government identifiers
- Names, email addresses, phone numbers, residential addresses, or dates of birth
- Identity documents, uploaded files, document URLs, or OCR contents
- Card, bank, UPI, payment credential, authentication, or session secrets

## Tenant isolation

Tenant authorization must be enforced by the trusted API/service before storage reads and report generation. Never rely on a tenant ID supplied by an untrusted browser client.

## Operational controls required before production

- Authentication and role-based authorization
- Tenant-scoped storage policies and automated isolation tests
- Encryption in transit and at rest
- Event idempotency and replay protection
- Retention and deletion policy
- Audit logging for report access and exports
- Rate limits and bounded date ranges
- Secret management outside source control
- Security review of any storage adapter

## Reporting a vulnerability

Do not publish sensitive vulnerability details in public issues. Contact the repository maintainers through the organization's approved private security reporting channel.
