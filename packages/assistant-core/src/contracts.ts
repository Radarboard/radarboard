import type { AssistantMode } from "@radarboard/types/database";

export type AssistantRunStatus = "started" | "completed" | "needs_input" | "failed" | "cancelled";

export type RetrievalActionStatus =
  | "started"
  | "completed"
  | "skipped"
  | "needs_input"
  | "failed"
  | "cancelled";

export type AssistantPresetWebSearchPolicy = "off" | "conditional" | "allowed";
export type AssistantPresetRetrievalDomain = "native" | "indexed" | "live" | "web";
export type AssistantProjectScopeBehavior = "required" | "preferred" | "none";
export type AssistantSkillKind = "builtin" | "custom";
export type AssistantAttachmentOwnerType = "message" | "thread" | "preset" | "mode";
export type AssistantAttachmentTargetType = "skill" | "knowledge" | "artifact" | "note";

export interface AssistantPreset {
  id: string;
  name: string;
  modelId: string;
  defaultMode: AssistantMode;
  projectScopeBehavior: AssistantProjectScopeBehavior;
  allowedRetrievalDomains: AssistantPresetRetrievalDomain[];
  webSearchPolicy: AssistantPresetWebSearchPolicy;
  defaultSkillIds: string[];
  starterPromptIds: string[];
}

export interface AssistantSkill {
  id: string;
  name: string;
  description: string;
  instructions: string;
  kind: AssistantSkillKind;
}

export interface AssistantAttachment {
  id: string;
  ownerType: AssistantAttachmentOwnerType;
  ownerId: string;
  targetType: AssistantAttachmentTargetType;
  targetId: string;
  required: boolean;
  createdAt: string;
}
