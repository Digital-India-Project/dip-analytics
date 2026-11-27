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

## 3. Metric Definitions (Aggregation Modules)

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
   - Per-`operatorRef` total actions, breakdown by `OperatorActionType`, distinct queues touched (`byQueue`), approval/escalation rates, and handling duration summary.
8. **Payment Metrics (`aggregatePaymentMetrics`):**
   - `initiatedCount`, `succeededCount`, `failedCount`, `refundedCount`, `successRateBps = succeeded / (succeeded + failed)`, `failureRateBps = failed / (succeeded + failed)`, `retryableFailedCount`, failure category breakdown, and method breakdown.
9. **API Metrics (`aggregateApiMetrics`):**
   - Total and per-endpoint (`METHOD routeTemplate`) request volume, 2xx/4xx/5xx counts, `errorRateBps = (4xx + 5xx) / total`, `serverErrorRateBps = 5xx / total`, latency summary, and top 20 `errorCode`s.
10. **Historical Time-Series (`aggregateTimeSeries`):**
    - Zero-filled ordered buckets across `[from, to)` in the requested timezone and granularity (capped at `10,000` buckets) covering event volume, application lifecycle counts, SLA breaches, API error rates, and currency-keyed revenue/refund totals.
11. **Geographic & Regional Analytics (`aggregateGeographicAnalytics`):**
    - Per-`regionCode` submitted, completed, approved, rejected, cancelled, SLA breaches, partner assignments, completion/approval rates, and currency-grouped revenue, capped with `__other__`.
12. **Payment Reconciliation (`aggregatePaymentReconciliation`):**
    - Correlates `references.paymentRef` across `payment.initiated`, `payment.succeeded`, `payment.failed`, and `payment.refunded` to classify `settledCount`, `failedOnlyCount`, `unsettledInitiatedCount`, `orphanedRefundCount`, `overRefundedCount`, `currencyDiscrepancyCount`, and currency-grouped net settled vs refunded reconciliation totals.
13. **Customer & Business Account Activity (`aggregateAccountActivity`):**
    - Uses opaque `references.accountRef` only (zero PII) to track `activeAccountsCount`, `repeatAccountsCount`, `repeatAccountRateBps`, activity count distribution, and per-account spend by currency.
14. **Period-over-Period Comparison (`compareMetricValue`, `compareExecutivePeriods`):**
    - Exact integer `absoluteDelta`, direction (`up` | `down` | `flat`), and `changeRateBps` (`null` when previous period is `0`).
15. **Universal Custom-Stage Funnel & Checkpointed Streaming Rollups (`aggregateCustomStageFunnel`, `StreamingAnalyticsProcessor`, `mergeTenantRollups`):**
    - Configurable ordered stage funnels for any business pipeline, plus single-pass `O(N)` `AsyncIterable` streaming rollups with `exportCheckpoint`/`fromCheckpoint` resumability and associative multi-worker rollup merging.
16. **Account Cohort Retention (`aggregateAccountCohortRetention`):**
    - Groups opaque `references.accountRef` identities by first active `day`/`week`/`month` bucket and computes retention curves (`retentionRateBps`) and currency-separated cohort revenue per offset period, capped with `__other__`.
17. **Deterministic Anomaly Detection (`detectTimeSeriesAnomalies`):**
    - Rolling-baseline integer spike detector over `HistoricalTimeSeriesSummary` for `api_error_rate_bps`, `sla_breaches`, `applications_cancelled`, and `api_requests`, emitting `warning` / `critical` alerts with `deviationBps`.
18. **Service Unit Economics (`aggregateServiceUnitEconomics`):**
    - Computes per-`(serviceCode, currency)` `grossRevenueMinor`, `gatewayFeesMinor`, `refundedMinor`, `partnerCommissionMinor`, `netContributionMinor`, `netMarginBps`, `revenuePerCompletedMinor`, and `netContributionPerCompletedMinor` using exact integer minor-unit arithmetic.
19. **Queue & Application Backlog Aging (`aggregateBacklogAging`):**
    - Tracks non-terminated applications (`submitted`/`status_changed` without `completed`/`cancelled`) as of `asOfIso`, returning open counts, `oldestOpenAgeMs`, age summary percentiles, per-service breakdown, and SLA aging bands (`under_1h`, `from_1h_to_24h`, `from_1d_to_7d`, `over_7d`).
