import { AnalyticsDomainError } from "../contracts/events.js";
import type { DateRange } from "../utils/time.js";
import { assertValidDateRange, DEFAULT_MAX_QUERY_RANGE_DAYS } from "../utils/time.js";

const TENANT_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

export type AnalyticsActorRole =
  | "tenant_admin"
  | "tenant_analyst"
  | "platform_auditor"
  | "service_ingestion";

export type TrustedAuthIssuer = "dip-api" | "dip-security";

/**
 * Authorization context constructed exclusively by trusted backend boundaries
 * (`dip-api` / `dip-security`) after token verification. Never accept this
 * directly from browser/client request bodies.
 */
export interface TenantAuthorizationContext {
  readonly authenticatedTenantId: string;
  readonly actorId: string;
  readonly actorRole: AnalyticsActorRole;
  readonly issuedBy: TrustedAuthIssuer;
  readonly scopes: readonly string[];
  /**
   * Optional untrusted tenant claim supplied by a caller/browser; if present
   * and mismatched with authenticatedTenantId, authorization fails loudly.
   */
  readonly claimedTenantId?: string;
}

export interface TenantQueryInput {
  readonly tenantId?: string;
  readonly dateRange: DateRange;
  readonly maxRangeDays?: number;
}

declare const AUTHORIZED_TENANT_BRAND: unique symbol;

export interface AuthorizedTenantQuery {
  readonly [AUTHORIZED_TENANT_BRAND]: true;
  readonly tenantId: string;
  readonly actorId: string;
  readonly actorRole: AnalyticsActorRole;
  readonly issuedBy: TrustedAuthIssuer;
  readonly dateRange: DateRange;
  readonly fromMs: number;
  readonly toMs: number;
}

export class TenantBoundaryViolationError extends AnalyticsDomainError {
  public constructor(message: string) {
    super("TENANT_BOUNDARY_VIOLATION", message);
    this.name = "TenantBoundaryViolationError";
  }
}

export function assertValidTenantId(tenantId: string): string {
  if (typeof tenantId !== "string" || !TENANT_ID_REGEX.test(tenantId)) {
    throw new TenantBoundaryViolationError(
      `Invalid tenantId "${String(tenantId)}". Must match ^[a-zA-Z0-9_-]{1,64}$.`,
    );
  }
  return tenantId;
}

export function assertTrustedAuthContext(
  context: TenantAuthorizationContext,
  requiredScope: string = "analytics:read",
): TenantAuthorizationContext {
  if (!context || typeof context !== "object") {
    throw new TenantBoundaryViolationError("Missing tenant authorization context.");
  }

  if (context.issuedBy !== "dip-api" && context.issuedBy !== "dip-security") {
    throw new TenantBoundaryViolationError(
      `Untrusted authorization issuer "${String(context.issuedBy)}".`,
    );
  }

  assertValidTenantId(context.authenticatedTenantId);

  if (typeof context.actorId !== "string" || context.actorId.trim().length === 0) {
    throw new TenantBoundaryViolationError("Authorization context requires a non-empty actorId.");
  }

  if (
    context.claimedTenantId !== undefined &&
    context.claimedTenantId !== context.authenticatedTenantId
  ) {
    throw new TenantBoundaryViolationError(
      `Cross-tenant access denied: claimed tenant "${context.claimedTenantId}" does not match authenticated tenant "${context.authenticatedTenantId}".`,
    );
  }

  if (!Array.isArray(context.scopes) || !context.scopes.includes(requiredScope)) {
    throw new TenantBoundaryViolationError(
      `Missing required authorization scope "${requiredScope}" for tenant "${context.authenticatedTenantId}".`,
    );
  }

  return context;
}

/**
 * Produces a branded AuthorizedTenantQuery guaranteed to bind strictly to the
 * verified authenticatedTenantId. Any mismatched requested tenantId throws a
 * TenantBoundaryViolationError.
 */
export function authorizeTenantQuery(
  authContext: TenantAuthorizationContext,
  query: TenantQueryInput,
  requiredScope: string = "analytics:read",
): AuthorizedTenantQuery {
  assertTrustedAuthContext(authContext, requiredScope);

  if (
    query.tenantId !== undefined &&
    query.tenantId !== authContext.authenticatedTenantId
  ) {
    throw new TenantBoundaryViolationError(
      `Cross-tenant query denied: requested tenant "${query.tenantId}" does not match authenticated tenant "${authContext.authenticatedTenantId}".`,
    );
  }

  const maxDays = query.maxRangeDays ?? DEFAULT_MAX_QUERY_RANGE_DAYS;
  const { fromMs, toMs } = assertValidDateRange(query.dateRange, maxDays);

  return {
    tenantId: authContext.authenticatedTenantId,
    actorId: authContext.actorId,
    actorRole: authContext.actorRole,
    issuedBy: authContext.issuedBy,
    dateRange: query.dateRange,
    fromMs,
    toMs,
  } as AuthorizedTenantQuery;
}

/**
 * Runtime defense-in-depth assertion verifying that every record in a result
 * set belongs exclusively to the authorized tenant.
 */
export function assertEventsBelongToTenant<T extends { readonly tenantId: string }>(
  events: readonly T[],
  expectedTenantId: string,
): void {
  assertValidTenantId(expectedTenantId);
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (!ev || ev.tenantId !== expectedTenantId) {
      throw new TenantBoundaryViolationError(
        `Tenant isolation breach at index ${i}: expected "${expectedTenantId}", found "${ev?.tenantId ?? "undefined"}".`,
      );
    }
  }
}
