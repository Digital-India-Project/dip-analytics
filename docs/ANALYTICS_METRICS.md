# Analytics Metrics Specification — `dip-analytics`

All calculations are deterministic, pure functions operating on deduplicated, chronologically ordered events within a half-open time window `[from, to)` by `eventTimestamp`.

---

## 1. Numeric Precision & Empty-Set Rules

- **Rates (`*RateBps`):** Integer **basis points** (`10000` = `100.00%`, `5000` = `50.00%`), calculated via `BigInt` half-up rounding (`computeBasisPoints(numerator, denominator)`). Returns `null` when `denominator === 0` (never `NaN` or `Infinity`).
- **Monetary Values (`*Minor`):** Safe integers in currency minor units (e.g. INR paise, USD cents). Arithmetic uses `BigInt` overflow-checked helpers (`addMinorUnits`, `subtractMinorUnits`). Mixed currencies are always separated by ISO-4217 currency code or rejected via `CurrencyMismatchError` in strict single-currency mode.
- **Durations & Percentiles:** Nearest-rank integer percentiles (`p50Ms`, `p90Ms`, `p95Ms`, `p99Ms`) plus `minMs`, `maxMs`, `avgMs` (half-up integer mean). Returns `null` when `sampleCount === 0`.

---

## 2. Timezone & Date-Boundary Rules

- Default reporting timezone: `UTC`.
- Explicit IANA timezones (e.g. `Asia/Kolkata`) are supported via `Intl.DateTimeFormat` in `src/utils/time.ts`.
- Window inclusion is half-open: `fromMs <= parseStrictIsoTimestampMs(event.eventTimestamp) < toMs`.
- Bucket keys:
  - `hour`: `YYYY-MM-DDTHH:00`
  - `day`: `YYYY-MM-DD`
  - `week`: `YYYY-MM-DD` (Monday of ISO week in target timezone)
  - `month`: `YYYY-MM`

---

## 3. Metric Definitions (10 Aggregation Modules)

1. **Application Funnel (`aggregateApplicationFunnel`):**
   - `submittedCount`, `inProgressTouchedCount`, `completedCount`, `approvedCount`, `rejectedCount`, `cancelledCount`
   - `completionRateBps = completedCount / submittedCount`
   - `approvalRateOfCompletedBps = approvedCount / completedCount`
   - `cancellationRateBps = cancelledCount / submittedCount`
   - `dropOffBeforeCompletionCount = max(0, submittedCount - (completedCount + cancelledCount))`
   - `partialData = (completedCount + cancelledCount) > submittedCount`
2. **Application Status Distribution (`aggregateApplicationStatusDistribution`):**
   - Latest terminal/in-progress status per `references.applicationRef` after deterministic sorting (`eventTimestamp` → `ingestedAt` → `eventId`), plus transition edge counts.
3. **Service Performance (`aggregateServicePerformance`):**
   - Per-`serviceCode` volume, completion/approval rates, SLA breaches, and duration summary, capped at `maxServices` (default `100`) with `__other__` rollup.
4. **Processing Time & SLA (`aggregateProcessingAndSla`):**
   - `slaComplianceRateBps = withinSlaTargetCount / evaluatedAgainstTargetCount`
   - Warning/critical breach counts and `stageBottlenecks` ordered by breach count with `maxOverrunMs`.
5. **Revenue & Refunds (`aggregateRevenueAndRefunds`):**
   - Per-currency `grossRevenueMinor`, `totalFeesMinor`, `netRevenueBeforeRefundsMinor`, `totalRefundedMinor`, `netRevenueAfterRefundsMinor`, and `refundRateBps = totalRefundedMinor / grossRevenueMinor`.
6. **Partner Performance (`aggregatePartnerPerformance`):**
   - Per-`partnerRef` auto/manual assignments, completed/returned/reassigned outcomes, `completionRateBps`, turnaround duration summary, and currency-grouped `commissionsByCurrencyMinor`.
7. **Operator Workload (`aggregateOperatorWorkload`):**
   - Per-`operatorRef` total actions, breakdown by `OperatorActionType`, distinct queues touched, and handling duration summary.
8. **Payment Metrics (`aggregatePaymentMetrics`):**
   - `initiatedCount`, `succeededCount`, `failedCount`, `refundedCount`, `successRateBps = succeeded / (succeeded + failed)`, `failureRateBps = failed / (succeeded + failed)`, `retryableFailedCount`, failure category breakdown, and method breakdown.
9. **API Metrics (`aggregateApiMetrics`):**
   - Total and per-endpoint (`METHOD routeTemplate`) request volume, 2xx/4xx/5xx counts, `errorRateBps = (4xx + 5xx) / total`, `serverErrorRateBps = 5xx / total`, latency summary, and top 20 `errorCode`s.
10. **Historical Time-Series (`aggregateTimeSeries`):**
    - Zero-filled ordered buckets across `[from, to)` in the requested timezone and granularity covering event volume, application lifecycle counts, SLA breaches, API error rates, and currency-keyed revenue/refund totals.
