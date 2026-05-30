/**
 * @radarboard/feature-briefing
 *
 * Isolated daily briefing feature package.
 * Exports the feature descriptor and public API.
 */

import type { FeatureDescriptor } from "@radarboard/feature-sdk/types";

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
export { buildBriefingPromptContext, getBriefingRoute } from "./server/routes";
