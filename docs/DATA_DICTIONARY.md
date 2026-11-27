# Data Dictionary — `dip-analytics`

## 1. Event Envelope (`AnalyticsEventEnvelope`, schema v`1.0.0`)

| Field | Type | Required | Constraints / Semantics |
|---|---|---|---|
| `eventId` | `string` | Yes | Stable unique event ID (`1..128` chars), used with `tenantId` for idempotency. |
| `eventType` | `AnalyticsEventType` | Yes | One of the 13 versioned event types defined in `src/contracts/events.ts`. |
| `schemaVersion` | `string` | Yes | Semver string (`MAJOR.MINOR.PATCH`). Major version `1` supported. |
| `eventTimestamp` | `string` | Yes | Strict ISO-8601 UTC or explicit offset timestamp (`YYYY-MM-DDTHH:mm:ss[.sss]Z\|±HH:MM`). |
| `ingestedAt` | `string` | No | Strict ISO-8601 timestamp assigned at ingestion boundary. |
| `tenantId` | `string` | Yes | Opaque tenant identifier matching `^[a-zA-Z0-9_-]{1,64}$`. |
| `sourceService` | `string` | Yes | Emitting service slug matching `^[a-z0-9-]{1,64}$`. |
| `correlationId` | `string` | Yes | End-to-end request/workflow correlation token (`1..128` chars). |
| `traceContext` | `TraceContext` | No | OpenTelemetry W3C fields: `traceId` (32 hex), `spanId` (16 hex), optional `traceFlags` (2 hex). |
| `references` | `OpaqueBusinessReferences` | No | Opaque non-PII IDs: `applicationRef`, `serviceCode`, `paymentRef`, `partnerRef`, `operatorRef`, `accountRef`, `regionCode`, `endpointKey`. |
| `payload` | `AnalyticsPayloadMap[T]` | Yes | Typed payload object specific to `eventType`. |

---

## 2. Event Types & Payload Fields

| Event Type | Required Payload Fields | Optional Payload Fields |
|---|---|---|
| `application.submitted` | `serviceCode`, `channel` (`web\|mobile\|assisted_center\|api\|partner_portal`) | `regionCode`, `categoryCode` |
| `application.status_changed` | `serviceCode`, `previousStatus`, `nextStatus` | `reasonCode`, `stageOrder` (int >= 0) |
| `application.completed` | `serviceCode`, `finalStatus` (`approved\|rejected\|completed`), `processingDurationMs` (int >= 0) | `slaTargetMs` (int >= 1), `regionCode` |
| `application.cancelled` | `serviceCode`, `cancelledByRole` (`customer\|operator\|system\|partner`) | `reasonCode` |
| `payment.initiated` | `currency` (`^[A-Z]{3}$`), `amountMinor` (safe int >= 0), `paymentMethodCategory` | `serviceCode` |
| `payment.succeeded` | `currency`, `amountMinor`, `paymentMethodCategory` | `feeMinor`, `netAmountMinor` (`feeMinor + netAmountMinor === amountMinor`), `settlementDurationMs` |
| `payment.failed` | `currency`, `amountMinor`, `failureCategory`, `paymentMethodCategory`, `retryable` (boolean) | — |
| `payment.refunded` | `currency`, `refundAmountMinor` (safe int >= 0), `reasonCategory`, `partial` (boolean) | `originalAmountMinor` (`>= refundAmountMinor`) |
| `partner.assigned` | `partnerRef`, `serviceCode`, `assignmentType` (`auto\|manual`) | `regionCode` |
| `partner.completed_work` | `partnerRef`, `serviceCode`, `durationMs`, `outcome` (`completed\|returned\|reassigned`) | `commissionMinor`, `currency` (required if `commissionMinor` set) |
| `operator.action_recorded` | `operatorRef`, `actionType` (`claimed\|verified\|requested_clarification\|approved\|rejected\|escalated\|reassigned`) | `serviceCode`, `queueCode`, `durationMs` |
| `sla.threshold_breached` | `serviceCode`, `stageCode`, `elapsedMs`, `thresholdMs` (>= 1), `severity` (`warning\|critical`) | — |
| `api.request_recorded` | `routeTemplate`, `method` (`GET\|POST\|PUT\|PATCH\|DELETE`), `statusCode` (`100..599`), `latencyMs` | `clientTier`, `errorCode` |

---

## 3. Prohibited Data Classes

The following must **never** appear anywhere in event envelopes, payloads, references, or exports:
- Names (`fullName`, `firstName`, `lastName`, `customerName`, `applicantName`)
- Contact details (`email`, `phone`, `mobile`, `address`, `pincode`)
- Government/tax IDs (`aadhaar`, `pan`, `passport`, `ssn`, `tin`, `gstin`)
- Financial credentials (`bankAccount`, `ifsc`, `cardNumber`, `cvv`, `upiId`)
- Network/client PII (`ipAddress`, `userAgent`)
- Secrets & documents (`password`, `token`, `apiKey`, `documentUrl`, `fileUrl`, `base64`, `data:*` URIs)
