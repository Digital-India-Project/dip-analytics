import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAnalyticsSnapshot,
  snapshotToCsv,
  validateAnalyticsEvent
} from "../src/index.js";
import type { AnalyticsEvent } from "../src/types.js";

const events: AnalyticsEvent[] = [
  { eventId:"e1", eventType:"application_submitted", occurredAt:"2026-01-02T10:00:00.000Z", tenantId:"tenant-a", applicationRef:"app-1", serviceCode:"PAN" },
  { eventId:"e2", eventType:"partner_assigned", occurredAt:"2026-01-02T11:00:00.000Z", tenantId:"tenant-a", applicationRef:"app-1", serviceCode:"PAN", partnerRef:"partner-1" },
  { eventId:"e3", eventType:"application_status_changed", occurredAt:"2026-01-03T10:00:00.000Z", tenantId:"tenant-a", applicationRef:"app-1", serviceCode:"PAN", partnerRef:"partner-1", status:"completed" },
  { eventId:"e4", eventType:"payment_succeeded", occurredAt:"2026-01-03T11:00:00.000Z", tenantId:"tenant-a", applicationRef:"app-1", serviceCode:"PAN", amountMinor:12500, currency:"INR" },
  { eventId:"e5", eventType:"payment_refunded", occurredAt:"2026-01-04T11:00:00.000Z", tenantId:"tenant-a", applicationRef:"app-1", serviceCode:"PAN", amountMinor:2500, currency:"INR" }
];

test("aggregates funnel, revenue and partner metrics deterministically", () => {
  const snapshot = buildAnalyticsSnapshot(events, {
    from:"2026-01-01T00:00:00.000Z",
    to:"2026-01-31T23:59:59.999Z"
  }, "2026-02-01T00:00:00.000Z");
  assert.equal(snapshot.funnel.submitted, 1);
  assert.equal(snapshot.funnel.conversionRate, 1);
  assert.deepEqual(snapshot.revenue[0], {
    currency:"INR", grossMinor:12500, refundedMinor:2500,
    successfulPayments:1, refunds:1, netMinor:10000
  });
  assert.deepEqual(snapshot.partners[0], {
    partnerRef:"partner-1", assigned:1, completed:1, completionRate:1
  });
});

test("rejects direct personal identifiers", () => {
  assert.throws(() => validateAnalyticsEvent({
    ...events[0], email:"person@example.com"
  }), /Direct identifiers/);
});

test("requires currency and amount for payment events", () => {
  assert.throws(() => validateAnalyticsEvent({
    ...events[0], eventType:"payment_succeeded"
  }), /require amountMinor and currency/);
});

test("rejects malformed event tokens", () => {
  assert.throws(() => validateAnalyticsEvent({
    ...events[0], tenantId:"tenant with spaces"
  }), /tenantId/);
});

test("CSV export contains aggregates and protects spreadsheet formulas", () => {
  const snapshot = buildAnalyticsSnapshot(events, {
    from:"2026-01-01T00:00:00.000Z",
    to:"2026-01-31T23:59:59.999Z"
  });
  const csv = snapshotToCsv(snapshot);
  assert.match(csv, /grossMinor/);
  assert.doesNotMatch(csv, /person@example.com/);
  assert.match(csv, /"INR"/);
});
