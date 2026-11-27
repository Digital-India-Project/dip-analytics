import { AnalyticsDomainError, CURRENT_EVENT_SCHEMA_VERSION } from "./events.js";

export type RawEventObject = Record<string, unknown>;

export interface EventUpcaster {
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly upcast: (event: RawEventObject) => RawEventObject;
}

export class SchemaUpcastError extends AnalyticsDomainError {
  public constructor(message: string) {
    super("SCHEMA_UPCAST_ERROR", message);
    this.name = "SchemaUpcastError";
  }
}

/**
 * Deterministic schema upcaster registry enabling multi-step migrations
 * (e.g. "0.9.0" -> "1.0.0") before strict runtime validation.
 */
export class EventUpcasterRegistry {
  private readonly upcastersByFrom = new Map<string, EventUpcaster>();

  public register(upcaster: EventUpcaster): this {
    if (upcaster.fromVersion === upcaster.toVersion) {
      throw new SchemaUpcastError(
        `Upcaster cannot map version "${upcaster.fromVersion}" to itself.`,
      );
    }
    this.upcastersByFrom.set(upcaster.fromVersion, upcaster);
    return this;
  }

  public upcastTo(
    rawEvent: RawEventObject,
    targetVersion: string = CURRENT_EVENT_SCHEMA_VERSION,
    maxHops: number = 10,
  ): { readonly event: RawEventObject; readonly appliedVersions: readonly string[] } {
    const initialVersion = rawEvent["schemaVersion"];
    if (typeof initialVersion !== "string" || initialVersion.length === 0) {
      throw new SchemaUpcastError("Event is missing string schemaVersion for upcasting.");
    }

    let current: RawEventObject = rawEvent;
    let currentVersion = initialVersion;
    const appliedVersions: string[] = [currentVersion];
    const visited = new Set<string>([currentVersion]);

    let hops = 0;
    while (currentVersion !== targetVersion) {
      if (hops >= maxHops) {
        throw new SchemaUpcastError(
          `Exceeded max upcast hops (${maxHops}) reaching "${targetVersion}".`,
        );
      }
      const step = this.upcastersByFrom.get(currentVersion);
      if (!step) {
        throw new SchemaUpcastError(
          `No registered upcaster from schemaVersion "${currentVersion}" toward "${targetVersion}".`,
        );
      }
      if (visited.has(step.toVersion)) {
        throw new SchemaUpcastError(
          `Cycle detected in schema upcasters at version "${step.toVersion}".`,
        );
      }
      current = step.upcast({ ...current, schemaVersion: step.toVersion });
      currentVersion = step.toVersion;
      visited.add(currentVersion);
      appliedVersions.push(currentVersion);
      hops++;
    }

    return { event: current, appliedVersions };
  }
}
