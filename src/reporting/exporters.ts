import { AnalyticsDomainError } from "../contracts/events.js";
import { assertNoPrivacyViolations } from "../privacy/pii-guard.js";
import {
  assertTrustedAuthContext,
  TenantBoundaryViolationError,
  type TenantAuthorizationContext,
} from "../privacy/tenant-boundary.js";
import { paginateRows, type PaginatedResult, type PaginationRequest } from "./filters.js";

/**
 * Raw identifier keys prohibited in aggregate-only exports to guarantee no
 * customer or raw event records are leaked.
 */
const PROHIBITED_RAW_EXPORT_KEYS = new Set([
  "eventId",
  "correlationId",
  "accountRef",
  "applicationRef",
  "paymentRef",
  "traceId",
  "spanId",
]);

const FORMULA_TRIGGER_CHAR_REGEX = /^[=+\-@\t\r]/;
const LEADING_SPACE_FORMULA_REGEX = /^[\s\u00A0]+[=+\-@]/;

export class ExportSecurityError extends AnalyticsDomainError {
  public constructor(message: string) {
    super("EXPORT_SECURITY_ERROR", message);
    this.name = "ExportSecurityError";
  }
}

/**
 * Neutralizes spreadsheet formula injection (OWASP CSV Injection defense).
 * Any cell beginning with `=`, `+`, `-`, `@`, `\t`, `\r` (or leading whitespace
 * followed by `=`, `+`, `-`, `@`) is prefixed with a single quote `'`.
 */
export function sanitizeCsvCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  let safe = str;
  if (FORMULA_TRIGGER_CHAR_REGEX.test(safe) || LEADING_SPACE_FORMULA_REGEX.test(safe)) {
    safe = `'${safe}`;
  }
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function assertAggregateOnlyExportPayload(value: unknown, path: string = "$"): void {
  assertNoPrivacyViolations(value, path);

  if (value === null || value === undefined || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      assertAggregateOnlyExportPayload(value[i], `${path}[${i}]`);
    }
    return;
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (PROHIBITED_RAW_EXPORT_KEYS.has(key)) {
      throw new ExportSecurityError(
        `Raw identifier field "${key}" at ${path}.${key} cannot be included in aggregate-only exports.`,
      );
    }
    assertAggregateOnlyExportPayload(record[key], `${path}.${key}`);
  }
}

export interface SmallCellSuppressionOptions<TRow extends Record<string, unknown>> {
  readonly countField: keyof TRow & string;
  readonly minCount: number;
  readonly mode?: "suppress" | "rollup_other";
  readonly labelField?: keyof TRow & string;
  readonly suppressedLabel?: string;
}

function applySmallCellSuppression<TRow extends Record<string, unknown>>(
  rows: readonly TRow[],
  suppression?: SmallCellSuppressionOptions<TRow>,
): { readonly rows: TRow[]; readonly suppressedRowCount: number } {
  if (!suppression) {
    return { rows: [...rows], suppressedRowCount: 0 };
  }
  const minCount = Math.max(1, suppression.minCount);
  const mode = suppression.mode ?? "suppress";
  const kept: TRow[] = [];
  const small: TRow[] = [];

  for (const row of rows) {
    const rawCount = row[suppression.countField];
    const countVal = typeof rawCount === "number" ? rawCount : 0;
    if (countVal < minCount) {
      small.push(row);
    } else {
      kept.push(row);
    }
  }

  if (small.length === 0 || mode === "suppress") {
    return { rows: kept, suppressedRowCount: small.length };
  }

  let summedCount = 0;
  for (const r of small) {
    const val = r[suppression.countField];
    summedCount += typeof val === "number" ? val : 0;
  }

  const rollupRow: Record<string, unknown> = {
    ...(suppression.labelField
      ? { [suppression.labelField]: suppression.suppressedLabel ?? "__suppressed_small_cells__" }
      : {}),
    [suppression.countField]: summedCount,
  };

  return {
    rows: [...kept, rollupRow as TRow],
    suppressedRowCount: small.length,
  };
}

export interface CsvExportOptions<TRow extends Record<string, unknown>> {
  readonly columns: readonly (keyof TRow & string)[];
  readonly pagination?: PaginationRequest;
  readonly expectedTenantId?: string;
  readonly smallCellSuppression?: SmallCellSuppressionOptions<TRow>;
}

export interface CsvExportOutput {
  readonly tenantId: string;
  readonly contentType: "text/csv; charset=utf-8";
  readonly rowCount: number;
  readonly totalRows: number;
  readonly suppressedRowCount: number;
  readonly page: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
  readonly csv: string;
}

export function exportAggregateRowsToCsv<TRow extends Record<string, unknown>>(
  rows: readonly TRow[],
  authContext: TenantAuthorizationContext,
  options: CsvExportOptions<TRow>,
): CsvExportOutput {
  assertTrustedAuthContext(authContext, "analytics:read");

  if (
    options.expectedTenantId !== undefined &&
    options.expectedTenantId !== authContext.authenticatedTenantId
  ) {
    throw new TenantBoundaryViolationError(
      `Export tenant mismatch: expected "${options.expectedTenantId}", authenticated "${authContext.authenticatedTenantId}".`,
    );
  }

  for (const col of options.columns) {
    if (PROHIBITED_RAW_EXPORT_KEYS.has(col)) {
      throw new ExportSecurityError(
        `Column "${col}" is a raw identifier and cannot be exported.`,
      );
    }
  }

  assertAggregateOnlyExportPayload(rows);
  const { rows: safeRows, suppressedRowCount } = applySmallCellSuppression(
    rows,
    options.smallCellSuppression,
  );
  const paged: PaginatedResult<TRow> = paginateRows(safeRows, options.pagination);

  const headerLine = options.columns.map((c) => sanitizeCsvCellValue(c)).join(",");
  const dataLines = paged.items.map((row) =>
    options.columns.map((col) => sanitizeCsvCellValue(row[col])).join(","),
  );

  return {
    tenantId: authContext.authenticatedTenantId,
    contentType: "text/csv; charset=utf-8",
    rowCount: paged.items.length,
    totalRows: paged.totalItems,
    suppressedRowCount,
    page: paged.page,
    totalPages: paged.totalPages,
    hasNextPage: paged.hasNextPage,
    csv: [headerLine, ...dataLines].join("\r\n"),
  };
}

export interface JsonReportExport<TReport> {
  readonly exportedAt: string;
  readonly tenantId: string;
  readonly contractVersion: string;
  readonly aggregateOnly: true;
  readonly report: TReport;
}

export function exportAggregateReportToJson<
  TReport extends { readonly tenantId: string },
>(
  report: TReport,
  authContext: TenantAuthorizationContext,
  options: { readonly contractVersion?: string; readonly exportedAt?: string } = {},
): JsonReportExport<TReport> {
  assertTrustedAuthContext(authContext, "analytics:read");

  if (report.tenantId !== authContext.authenticatedTenantId) {
    throw new TenantBoundaryViolationError(
      `JSON export denied: report tenant "${report.tenantId}" does not match authenticated tenant "${authContext.authenticatedTenantId}".`,
    );
  }

  assertAggregateOnlyExportPayload(report);

  return {
    exportedAt: options.exportedAt ?? new Date().toISOString(),
    tenantId: authContext.authenticatedTenantId,
    contractVersion: options.contractVersion ?? "1.0.0",
    aggregateOnly: true,
    report,
  };
}

export interface NdjsonExportOutput {
  readonly tenantId: string;
  readonly contentType: "application/x-ndjson; charset=utf-8";
  readonly rowCount: number;
  readonly totalRows: number;
  readonly suppressedRowCount: number;
  readonly page: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
  readonly ndjson: string;
}

export function exportAggregateRowsToNdjson<TRow extends Record<string, unknown>>(
  rows: readonly TRow[],
  authContext: TenantAuthorizationContext,
  options: {
    readonly pagination?: PaginationRequest;
    readonly expectedTenantId?: string;
    readonly smallCellSuppression?: SmallCellSuppressionOptions<TRow>;
  } = {},
): NdjsonExportOutput {
  assertTrustedAuthContext(authContext, "analytics:read");

  if (
    options.expectedTenantId !== undefined &&
    options.expectedTenantId !== authContext.authenticatedTenantId
  ) {
    throw new TenantBoundaryViolationError(
      `NDJSON export tenant mismatch: expected "${options.expectedTenantId}", authenticated "${authContext.authenticatedTenantId}".`,
    );
  }

  assertAggregateOnlyExportPayload(rows);
  const { rows: safeRows, suppressedRowCount } = applySmallCellSuppression(
    rows,
    options.smallCellSuppression,
  );
  const paged: PaginatedResult<TRow> = paginateRows(safeRows, options.pagination);
  const ndjson = paged.items.map((row) => JSON.stringify(row)).join("\n");

  return {
    tenantId: authContext.authenticatedTenantId,
    contentType: "application/x-ndjson; charset=utf-8",
    rowCount: paged.items.length,
    totalRows: paged.totalItems,
    suppressedRowCount,
    page: paged.page,
    totalPages: paged.totalPages,
    hasNextPage: paged.hasNextPage,
    ndjson,
  };
}
