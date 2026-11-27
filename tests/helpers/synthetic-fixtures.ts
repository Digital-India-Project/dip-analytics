import {
  CURRENT_EVENT_SCHEMA_VERSION,
  type AnalyticsEventType,
  type AnalyticsPayloadMap,
  type EventOfType,
} from "../../src/contracts/events.js";
import {
  authorizeTenantQuery,
  type AuthorizedTenantQuery,
  type TenantAuthorizationContext,
} from "../../src/privacy/tenant-boundary.js";

export function makeAuthContext(
  tenantId: string = "tenant_alpha",
  overrides: Partial<TenantAuthorizationContext> = {},
): TenantAuthorizationContext {
  return {
    authenticatedTenantId: tenantId,
    actorId: "svc_test_actor",
    actorRole: "tenant_admin",
    issuedBy: "dip-api",
    scopes: ["analytics:read", "analytics:ingest", "analytics:admin"],
    ...overrides,
  };
}

export function makeAuthorizedQuery(
  tenantId: string = "tenant_alpha",
  from: string = "2026-10-01T00:00:00.000Z",
  to: string = "2026-11-01T00:00:00.000Z",
): AuthorizedTenantQuery {
  return authorizeTenantQuery(makeAuthContext(tenantId), {
    tenantId,
    dateRange: { from, to },
  });
}

let seq = 1;

export function makeEvent<TType extends AnalyticsEventType>(
  eventType: TType,
  payload: AnalyticsPayloadMap[TType],
  overrides: Partial<Omit<EventOfType<TType>, "eventType" | "payload">> = {},
): EventOfType<TType> {
  const id = `evt_syn_${seq++}`;
  return {
    eventId: id,
    eventType,
    schemaVersion: CURRENT_EVENT_SCHEMA_VERSION,
    eventTimestamp: "2026-10-10T10:00:00.000Z",
    tenantId: "tenant_alpha",
    sourceService: "dipindia",
    correlationId: `corr_${id}`,
    payload,
    ...overrides,
  } as EventOfType<TType>;
}
