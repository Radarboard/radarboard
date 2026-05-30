/**
 * @radarboard/feature-assistant
 *
 * AI Assistant feature descriptor. Business logic remains in
 * apps/app (ai-tools.ts, ai-actions/, app/api/chat/) and shared
 * packages (assistant-core, llm, llm-adapter-vercel) until a
 * dedicated isolation effort.
 */

import type { FeatureDescriptor } from "@radarboard/feature-sdk/types";

export const assistantDescriptor: FeatureDescriptor = {
  id: "assistant",
  envKey: "NEXT_PUBLIC_FEATURE_ASSISTANT",
  label: "AI Assistant",
  description: "Chat-based AI assistant for project insights and actions.",
  defaultEnabled: true,
  tier: "user",
  plan: "free",
  category: "ai",
  settingsSections: ["ai"],
  gatedTools: ["update_llm_config"],
};
