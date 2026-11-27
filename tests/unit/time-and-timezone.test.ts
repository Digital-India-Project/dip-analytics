import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aggregateTimeSeries } from "../../src/aggregations/index.js";
import {
  assertValidDateRange,
  DateRangeViolationError,
  formatBucketKey,
  InvalidTimestampError,
  parseStrictIsoTimestampMs,
} from "../../src/utils/time.js";
import { makeAuthorizedQuery, makeEvent } from "../helpers/synthetic-fixtures.js";

describe("Timestamps, Timezones, Date Boundaries & Time-Series", () => {
  it("rejects non-ISO timestamps and impossible calendar dates (e.g. Feb 29 non-leap year)", () => {
    assert.ok(Number.isFinite(parseStrictIsoTimestampMs("2024-02-29T12:00:00.000Z")));
    assert.throws(
      () => parseStrictIsoTimestampMs("2026-02-29T12:00:00.000Z"),
      InvalidTimestampError,
    );
    assert.throws(
      () => parseStrictIsoTimestampMs("2026-10-10T12:00:00"), // missing timezone
      InvalidTimestampError,
    );
    assert.throws(
      () => parseStrictIsoTimestampMs("not-a-date"),
      InvalidTimestampError,
    );
  });

  it("enforces inverted and oversized date ranges", () => {
    assert.throws(
      () =>
        assertValidDateRange({
          from: "2026-10-10T00:00:00.000Z",
          to: "2026-10-10T00:00:00.000Z",
        }),
      DateRangeViolationError,
    );

    assert.throws(
      () =>
        assertValidDateRange(
          {
            from: "2025-01-01T00:00:00.000Z",
            to: "2026-06-01T00:00:00.000Z",
          },
          366,
        ),
      DateRangeViolationError,
    );
  });

  it("assigns explicit UTC vs Asia/Kolkata (+05:30) day boundaries and uses eventTimestamp instead of ingestedAt", () => {
    // 2026-10-10T20:00:00.000Z is 2026-10-10 in UTC, but 2026-10-11 01:30 in Asia/Kolkata
    const epoch = parseStrictIsoTimestampMs("2026-10-10T20:00:00.000Z");
    assert.equal(formatBucketKey(epoch, "day", "UTC"), "2026-10-10");
    assert.equal(formatBucketKey(epoch, "day", "Asia/Kolkata"), "2026-10-11");

    const query = makeAuthorizedQuery(
      "tenant_alpha",
      "2026-10-10T00:00:00.000Z",
      "2026-10-13T00:00:00.000Z",
    );
    const events = [
      makeEvent(
        "application.submitted",
        { serviceCode: "SVC_1", channel: "web" },
        {
          eventTimestamp: "2026-10-10T20:00:00.000Z",
          // Late ingestion timestamp 2 days later must NOT shift domain bucketing
          ingestedAt: "2026-10-12T12:00:00.000Z",
        },
      ),
    ];

    const utcSeries = aggregateTimeSeries(events, query, {
      granularity: "day",
      timeZone: "UTC",
    });
    assert.equal(
      utcSeries.buckets.find((b) => b.bucketKey === "2026-10-10")?.applicationsSubmitted,
      1,
    );
    assert.equal(
      utcSeries.buckets.find((b) => b.bucketKey === "2026-10-11")?.applicationsSubmitted,
      0,
    );

    const istSeries = aggregateTimeSeries(events, query, {
      granularity: "day",
      timeZone: "Asia/Kolkata",
    });
    assert.equal(
      istSeries.buckets.find((b) => b.bucketKey === "2026-10-11")?.applicationsSubmitted,
      1,
    );
  });
});
