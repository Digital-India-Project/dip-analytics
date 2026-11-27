import { AnalyticsDomainError } from "../contracts/events.js";
import { assertValidCurrencyCode } from "../utils/money.js";
import { assertValidDateRange, type DateRange } from "../utils/time.js";

export const MAX_EXPORT_PAGE_SIZE = 1000;
export const DEFAULT_EXPORT_PAGE_SIZE = 50;

export interface ReportFilterCriteria {
  readonly dateRange: DateRange;
  readonly serviceCodes?: readonly string[];
  readonly partnerRefs?: readonly string[];
  readonly regionCodes?: readonly string[];
  readonly currencies?: readonly string[];
}

export interface PaginationRequest {
  readonly page?: number;
  readonly pageSize?: number;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
}

export class ReportFilterError extends AnalyticsDomainError {
  public constructor(message: string) {
    super("REPORT_FILTER_ERROR", message);
    this.name = "ReportFilterError";
  }
}

export function validateReportFilters(filters: ReportFilterCriteria): ReportFilterCriteria {
  assertValidDateRange(filters.dateRange);
  if (filters.currencies) {
    for (const c of filters.currencies) {
      assertValidCurrencyCode(c);
    }
  }
  return filters;
}

export function paginateRows<T>(
  rows: readonly T[],
  pagination: PaginationRequest = {},
): PaginatedResult<T> {
  const page = pagination.page ?? 1;
  const pageSize = pagination.pageSize ?? DEFAULT_EXPORT_PAGE_SIZE;

  if (!Number.isSafeInteger(page) || page < 1) {
    throw new ReportFilterError(`Pagination page must be an integer >= 1 (received ${page}).`);
  }
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > MAX_EXPORT_PAGE_SIZE) {
    throw new ReportFilterError(
      `Pagination pageSize must be between 1 and ${MAX_EXPORT_PAGE_SIZE} (received ${pageSize}).`,
    );
  }

  const totalItems = rows.length;
  const totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / pageSize);
  const start = (page - 1) * pageSize;
  const items = rows.slice(start, start + pageSize);

  return {
    items,
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
  };
}
