import { AnalyticsDomainError } from "../contracts/events.js";

export const DEFAULT_MAX_QUERY_RANGE_DAYS = 366;
export const DEFAULT_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000; // 5 minutes

export type TimeGranularity = "hour" | "day" | "week" | "month";

export interface DateRange {
  /** Inclusive start ISO-8601 timestamp. */
  readonly from: string;
  /** Exclusive end ISO-8601 timestamp. */
  readonly to: string;
}

export class InvalidTimestampError extends AnalyticsDomainError {
  public constructor(message: string) {
    super("INVALID_TIMESTAMP", message);
    this.name = "InvalidTimestampError";
  }
}

export class DateRangeViolationError extends AnalyticsDomainError {
  public constructor(message: string) {
    super("DATE_RANGE_VIOLATION", message);
    this.name = "DateRangeViolationError";
  }
}

/**
 * Strict ISO-8601 timestamp parser that verifies calendar validity (e.g. rejects
 * Feb 29 on non-leap years, Feb 30, month 13, or hour 25) and requires an
 * explicit timezone offset ('Z' or '+HH:MM' / '-HH:MM').
 */
const ISO_TIMESTAMP_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  switch (month) {
    case 1:
    case 3:
    case 5:
    case 7:
    case 8:
    case 10:
    case 12:
      return 31;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    case 2:
      return isLeapYear(year) ? 29 : 28;
    default:
      return 0;
  }
}

export function parseStrictIsoTimestampMs(value: string): number {
  if (typeof value !== "string" || value.length === 0 || value.length > 40) {
    throw new InvalidTimestampError("Timestamp must be a non-empty ISO-8601 string.");
  }

  const match = ISO_TIMESTAMP_REGEX.exec(value);
  if (!match) {
    throw new InvalidTimestampError(
      `Timestamp "${value}" must follow strict ISO-8601 format with explicit timezone (e.g. 2026-01-15T10:30:00.000Z).`,
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const fracRaw = match[7] ?? "0";
  const tzPart = match[8];

  if (month < 1 || month > 12) {
    throw new InvalidTimestampError(`Invalid month ${month} in timestamp "${value}".`);
  }
  const maxDay = daysInMonth(year, month);
  if (day < 1 || day > maxDay) {
    throw new InvalidTimestampError(
      `Invalid day ${day} for ${year}-${String(month).padStart(2, "0")} in timestamp "${value}".`,
    );
  }
  if (hour > 23 || minute > 59 || second > 59) {
    throw new InvalidTimestampError(`Invalid time component in timestamp "${value}".`);
  }

  let offsetMinutes = 0;
  if (tzPart !== "Z") {
    const sign = match[9] === "-" ? -1 : 1;
    const offHours = Number(match[10]);
    const offMins = Number(match[11]);
    if (offHours > 23 || offMins > 59) {
      throw new InvalidTimestampError(`Invalid timezone offset in timestamp "${value}".`);
    }
    offsetMinutes = sign * (offHours * 60 + offMins);
  }

  const msPart = Number(fracRaw.slice(0, 3).padEnd(3, "0"));
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, second, msPart);
  const adjustedMs = utcMs - offsetMinutes * 60_000;

  if (!Number.isFinite(adjustedMs)) {
    throw new InvalidTimestampError(`Timestamp "${value}" resolves to a non-finite epoch.`);
  }
  return adjustedMs;
}

export function assertValidTimezone(timeZone: string): string {
  if (typeof timeZone !== "string" || timeZone.trim().length === 0) {
    throw new InvalidTimestampError("Timezone must be a non-empty IANA timezone identifier.");
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
    return timeZone;
  } catch {
    throw new InvalidTimestampError(`Unsupported or invalid IANA timezone "${timeZone}".`);
  }
}

export function assertValidDateRange(
  range: DateRange,
  maxRangeDays: number = DEFAULT_MAX_QUERY_RANGE_DAYS,
): { readonly fromMs: number; readonly toMs: number } {
  const fromMs = parseStrictIsoTimestampMs(range.from);
  const toMs = parseStrictIsoTimestampMs(range.to);

  if (fromMs >= toMs) {
    throw new DateRangeViolationError(
      `Date range start (${range.from}) must be strictly before end (${range.to}).`,
    );
  }

  const spanMs = toMs - fromMs;
  const maxSpanMs = maxRangeDays * 24 * 60 * 60 * 1000;
  if (spanMs > maxSpanMs) {
    throw new DateRangeViolationError(
      `Date range spans ${Math.ceil(spanMs / 86_400_000)} days, exceeding the maximum allowed window of ${maxRangeDays} days.`,
    );
  }

  return { fromMs, toMs };
}

export function isWithinHalfOpenRange(
  timestampMs: number,
  fromMs: number,
  toMs: number,
): boolean {
  return timestampMs >= fromMs && timestampMs < toMs;
}

interface ZonedDateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
}

const formattersCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = formattersCache.get(timeZone);
  if (!fmt) {
    assertValidTimezone(timeZone);
    fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    });
    formattersCache.set(timeZone, fmt);
  }
  return fmt;
}

export function getZonedDateParts(epochMs: number, timeZone: string): ZonedDateParts {
  const fmt = getFormatter(timeZone);
  const parts = fmt.formatToParts(new Date(epochMs));
  let year = 0;
  let month = 0;
  let day = 0;
  let hour = 0;

  for (const part of parts) {
    if (part.type === "year") year = Number(part.value);
    else if (part.type === "month") month = Number(part.value);
    else if (part.type === "day") day = Number(part.value);
    else if (part.type === "hour") hour = Number(part.value) % 24;
  }

  return { year, month, day, hour };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Formats a deterministic bucket key in the requested IANA timezone.
 * - hour:  YYYY-MM-DDTHH:00
 * - day:   YYYY-MM-DD
 * - week:  YYYY-MM-DD (Monday of ISO week in target timezone)
 * - month: YYYY-MM
 */
export function formatBucketKey(
  epochMs: number,
  granularity: TimeGranularity,
  timeZone: string = "UTC",
): string {
  const { year, month, day, hour } = getZonedDateParts(epochMs, timeZone);

  switch (granularity) {
    case "hour":
      return `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:00`;
    case "day":
      return `${year}-${pad2(month)}-${pad2(day)}`;
    case "month":
      return `${year}-${pad2(month)}`;
    case "week": {
      const utcDate = new Date(Date.UTC(year, month - 1, day));
      const dayOfWeek = utcDate.getUTCDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      utcDate.setUTCDate(utcDate.getUTCDate() + diffToMonday);
      return `${utcDate.getUTCFullYear()}-${pad2(utcDate.getUTCMonth() + 1)}-${pad2(
        utcDate.getUTCDate(),
      )}`;
    }
  }
}

/**
 * Generates ordered bucket keys covering [fromMs, toMs) in the given timezone.
 * Steps at hourly intervals for 'hour', 12-hour checkpoints for 'day'/'week'/'month'
 * to safely preserve DST/offset transitions without missing or duplicating buckets.
 */
export function enumerateBucketKeys(
  fromMs: number,
  toMs: number,
  granularity: TimeGranularity,
  timeZone: string = "UTC",
): string[] {
  assertValidTimezone(timeZone);
  if (fromMs >= toMs) {
    return [];
  }

  const keys: string[] = [];
  const seen = new Set<string>();
  const stepMs = granularity === "hour" ? 60 * 60 * 1000 : 12 * 60 * 60 * 1000;

  for (let t = fromMs; t < toMs; t += stepMs) {
    const key = formatBucketKey(t, granularity, timeZone);
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }
  // Ensure the final instant inside [fromMs, toMs) is represented
  const lastKey = formatBucketKey(toMs - 1, granularity, timeZone);
  if (!seen.has(lastKey)) {
    seen.add(lastKey);
    keys.push(lastKey);
  }
  return keys;
}
