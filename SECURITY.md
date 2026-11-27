# Security Policy — `dip-analytics`

## Supported Versions

| Version | Supported |
|---|---|
| `0.1.x` (v1 event schema) | Active development (`review/dip-analytics-v1-foundation`) |

## Security Design Guarantees

- **Tenant Isolation:** Analytics queries, aggregations, retention operations, and report exports require a trusted backend `TenantAuthorizationContext` (`issuedBy: "dip-api" | "dip-security"`). Browser-supplied `tenantId` values are never trusted as authorization.
- **No PII or Uploaded Documents:** Incoming events and outgoing exports are scanned recursively for PII keys, government IDs (Aadhaar, PAN, passport), contact details, credentials, and embedded file/document URIs.
- **No Spreadsheet Formula Injection:** CSV exports neutralize leading `=`, `+`, `-`, `@`, `\t`, and `\r` characters per OWASP guidance.
- **Zero Runtime Dependencies & No Live Secrets:** The package declares `"dependencies": {}` and contains no credentials, tokens, or production database connections.

## Reporting a Vulnerability

Do **not** open public issues with sensitive exploit details, credentials, or real tenant data. Report security concerns privately to the Digital India Project security maintainers (`dip-security` / repository owners) with:
- Affected module and contract version.
- Minimal synthetic reproduction steps.
- Expected vs. actual security boundary behavior.
