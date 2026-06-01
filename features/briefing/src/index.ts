/**
 * @radarboard/feature-briefing
 *
 * Isolated daily briefing feature package.
 * Exports the feature descriptor and public API.
 */

import type { FeatureDescriptor, FeatureServerRuntime } from "@radarboard/feature-sdk/types";
import { buildBriefingPromptContext, getBriefingRoute } from "./server/routes";
import { buildBriefingToolExecutor } from "./tools";

type BriefingRouteServices = {
  listCredentialKeys: () => Promise<string[]>;
  buildDataSourceContext: Parameters<typeof getBriefingRoute>[0]["buildDataSourceContext"];
  emitNotificationEvents: Parameters<typeof getBriefingRoute>[0]["emitNotificationEvents"];
  onSourceError?: Parameters<typeof getBriefingRoute>[0]["onSourceError"];
};

function getBriefingRouteServices(runtime: FeatureServerRuntime): BriefingRouteServices | null {
  const { listCredentialKeys, buildDataSourceContext, emitNotificationEvents, onSourceError } =
    runtime.services;
  if (
    typeof listCredentialKeys !== "function" ||
    typeof buildDataSourceContext !== "function" ||
    typeof emitNotificationEvents !== "function"
  ) {
    return null;
  }

  return {
    listCredentialKeys: listCredentialKeys as BriefingRouteServices["listCredentialKeys"],
    buildDataSourceContext:
      buildDataSourceContext as BriefingRouteServices["buildDataSourceContext"],
    emitNotificationEvents: emitNotificationEvents as BriefingRouteServices["emitNotificationEvents"],
    ...(typeof onSourceError === "function"
      ? { onSourceError: onSourceError as BriefingRouteServices["onSourceError"] }
      : {}),
  };
}

export const briefingDescriptor: FeatureDescriptor = {
  id: "briefing",
  envKey: "NEXT_PUBLIC_FEATURE_BRIEFING",
  label: "Daily Briefing",
  description: "AI-generated daily project summary.",
  defaultEnabled: true,
  tier: "user",
  plan: "free",
  category: "ai",
  gatedTools: ["generate_daily_briefing"],
  server: {
    routes: {
      briefing: async ({ runtime }) => {
        const services = getBriefingRouteServices(runtime);
        if (!services) {
          return { status: 503, payload: { error: "Briefing services unavailable" } };
        }

        const result = await getBriefingRoute(services);
        if (!result.ok) {
          return { status: result.status, payload: { error: result.error } };
        }
        return { status: 200, payload: result.briefing };
      },
    },
  },
  assistant: {
    promptContext: () => buildBriefingPromptContext(),
    toolExecutors: (runtime) => {
      const buildDataSourceContext = runtime.services.buildDataSourceContext;
      if (typeof buildDataSourceContext !== "function") return {};

      return buildBriefingToolExecutor(
        buildDataSourceContext as BriefingRouteServices["buildDataSourceContext"]
      );
    },
  },
};

export {
  analyzeBriefingMetric,
  determineOverallStatus,
  formatBriefingMarkdown,
  getLatestBriefing,
  storeBriefing,
  type BriefingSection,
  type MorningBriefing,
} from "./morning-briefing";

export { buildBriefingToolExecutor, extractNumericValues } from "./tools";
export { buildBriefingPromptContext, getBriefingRoute };
