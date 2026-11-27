# Architecture

## Responsibilities

`@digital-india-project/dip-analytics` is a framework-independent TypeScript domain library. It defines event contracts, validates analytics input, computes deterministic aggregates, and exports aggregate CSV.

It does not own authentication, tenant membership, payment processing, application workflow, persistent storage, scheduling, or visualization.

## Data flow

1. DIPINDIA or an approved service emits a normalized business event.
2. The trusted integration/API layer authenticates the producer and resolves tenant identity.
3. The producer validates the event and persists it through an implementation of `AnalyticsStore`.
4. A tenant-authorized reporting service reads the relevant events.
5. This package calculates funnel, revenue, and partner metrics.
6. The API returns aggregate results to an authorized dashboard.

## Design rules

- No React, browser APIs, database driver, or cloud-provider dependency in the domain package.
- Use integer minor currency units; never use floating point for money.
- Aggregation functions are pure and deterministic when `generatedAt` is supplied.
- Keep tenant authorization outside the package and enforce it before reads.
- Add event types through reviewed, versioned contract changes.
- Do not infer business completion from payment success or vice versa.

## Storage adapter

The `AnalyticsStore` interface is an abstraction only. No database adapter or production connection is included in this foundation. A future adapter must document retention, tenant isolation, idempotency, encryption, backup, and deletion behavior.
