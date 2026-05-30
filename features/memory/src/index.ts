/**
 * @radarboard/feature-memory
 *
 * Memory feature descriptor. Gates persistent memory and
 * artifact storage tools for the AI assistant.
 */

import type { FeatureDescriptor } from "@radarboard/feature-sdk/types";

export const memoryDescriptor: FeatureDescriptor = {
  id: "memory",
  envKey: "NEXT_PUBLIC_FEATURE_MEMORY",
  label: "Memory",
  description: "Persistent memory and artifact storage for the assistant.",
  defaultEnabled: true,
  tier: "user",
  plan: "free",
  category: "ai",
  gatedTools: ["remember", "recall", "forget", "list_memories", "save_artifact", "list_artifacts", "get_artifact"],
};
