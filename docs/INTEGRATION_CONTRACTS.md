# Integration Contracts

## Event envelope

Required fields:
- `eventId`: producer-generated stable idempotency key
- `eventType`: one of the declared analytics event types
- `occurredAt`: ISO-compatible timestamp
- `tenantId`: opaque tenant identifier resolved by trusted backend
- `applicationRef`: opaque application reference
- `serviceCode`: stable service identifier

Optional fields include channel, partner reference, status, currency, amount in minor units, and an approved pseudonymous subject hash.

## Supported event types

| Event | Purpose | Required additional fields |
|---|---|---|
| application_submitted | Count submitted applications | None |
| application_status_changed | Count status transitions | status |
| payment_succeeded | Aggregate successful payments | amountMinor, currency |
| payment_refunded | Aggregate refunds | amountMinor, currency |
| partner_assigned | Count partner assignments | partnerRef |

## Producer guidance

- Emit events after the authoritative business transaction commits.
- Reuse the same eventId on retries.
- Do not include raw payment gateway payloads, customer PII, KYC attributes, or document content.
- Do not send secrets, access tokens, session identifiers, or provider credentials.
- A future ingestion service must enforce idempotency; this package currently validates and aggregates but does not persist or deduplicate events.

## Consumer guidance

- Authenticate and authorize before querying.
- Resolve tenant scope server-side.
- Use explicit date ranges and timezone policy.
- Treat reports as analytics, not legal, accounting, payment settlement, or regulatory records.
- Display currency and date-range context with every report.
