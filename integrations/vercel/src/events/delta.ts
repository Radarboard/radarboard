/**
 * Vercel — Delta detector
 *
 * Accepts VercelDeploymentItem from @radarboard/types/vercel.
 */

import type { DeltaDetector, IntegrationEvent } from "@radarboard/integration-sdk/types";
import type { VercelDeploymentItem } from "@radarboard/types/vercel";

const deploymentState = new Map<string, string>(); // id → state
let bootstrapped = false;

function makeDeployEvent(
  d: VercelDeploymentItem,
  type: "deploy.failed" | "deploy.succeeded",
  projectSlug: string | null | undefined,
  previousState?: string
): IntegrationEvent {
  return {
    source: "vercel",
    sourceEventId: `vercel:deploy:${d.id}:${type.split(".")[1]}`,
    type,
    severity: type === "deploy.failed" ? "warning" : "info",
    projectSlug,
    title: `${d.projectName} ${type === "deploy.failed" ? "deploy failed" : "deployed"}${d.target === "production" ? " (production)" : ""}`,
    body: d.commitMessage ?? undefined,
    metadata: {
      deploymentId: d.id,
      url: d.url,
      target: d.target,
      author: d.commitAuthor,
      previousState,
    },
    occurredAt: Math.floor((d.ready || d.created) / 1000),
  };
}

export const vercelDeploymentDelta: DeltaDetector<VercelDeploymentItem[]> = {
  detect(current, projectSlug) {
    if (!bootstrapped) {
      for (const d of current) deploymentState.set(d.id, d.state);
      bootstrapped = true;
      return [];
    }

    const events: IntegrationEvent[] = [];
    for (const d of current) {
      const prev = deploymentState.get(d.id);
      deploymentState.set(d.id, d.state);

      if (!prev) {
        if (d.state === "ERROR") {
          events.push(makeDeployEvent(d, "deploy.failed", projectSlug));
        } else if (d.state === "READY") {
          events.push(makeDeployEvent(d, "deploy.succeeded", projectSlug));
        }
      } else if (prev !== d.state && d.state === "ERROR") {
        events.push(makeDeployEvent(d, "deploy.failed", projectSlug, prev));
      }
    }
    return events;
  },
};

export function resetVercelDeltaState(): void {
  deploymentState.clear();
  bootstrapped = false;
}
