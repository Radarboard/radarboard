/**
 * BetterStack — Delta detector
 *
 * Accepts HealthCheck from @radarboard/types/health.
 */

import type { DeltaDetector, IntegrationEvent } from "@radarboard/integration-sdk/types";
import type { HealthCheck } from "@radarboard/types/health";

const monitorState = new Map<string, "up" | "down">();
let bootstrapped = false;

function makeMonitorEvent(
  check: HealthCheck,
  status: "up" | "down",
  projectSlug: string | null | undefined
): IntegrationEvent {
  return {
    source: "betterstack",
    sourceEventId: `betterstack:monitor:${check.id}:${status}`,
    type: status === "down" ? "monitor.down" : "monitor.up",
    severity: status === "down" ? "critical" : "info",
    projectSlug,
    title: status === "down" ? `${check.name} is DOWN` : `${check.name} is back up`,
    body: check.url,
    metadata: { monitorId: check.id, url: check.url, status },
  };
}

export const betterstackMonitorDelta: DeltaDetector<HealthCheck[]> = {
  detect(current, projectSlug) {
    if (!bootstrapped) {
      for (const check of current) {
        monitorState.set(check.id, check.status === "down" ? "down" : "up");
      }
      bootstrapped = true;
      return [];
    }

    const events: IntegrationEvent[] = [];
    for (const check of current) {
      const currentStatus: "up" | "down" = check.status === "down" ? "down" : "up";
      const prevStatus = monitorState.get(check.id);
      monitorState.set(check.id, currentStatus);

      if (!prevStatus && currentStatus === "down") {
        events.push(makeMonitorEvent(check, "down", projectSlug));
      } else if (prevStatus && prevStatus !== currentStatus) {
        events.push(makeMonitorEvent(check, currentStatus, projectSlug));
      }
    }
    return events;
  },
};

export function resetBetterstackDeltaState(): void {
  monitorState.clear();
  bootstrapped = false;
}
