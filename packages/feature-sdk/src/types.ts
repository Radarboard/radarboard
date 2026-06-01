/**
 * Core types for the feature flag system.
 *
 * Features are registered via descriptors and resolved at runtime
 * by combining env-var gates with optional user preferences.
 */

import type { ComponentType } from "react";

// ---------------------------------------------------------------------------
// Plan tiers — which subscription plan unlocks a feature
// ---------------------------------------------------------------------------

export type PlanTier = "free" | "pro" | "enterprise";

/** Numeric rank for plan comparison. Higher rank includes all lower tiers. */
export const PLAN_RANK: Record<PlanTier, number> = {
  free: 0,
  pro: 1,
  enterprise: 2,
};

// ---------------------------------------------------------------------------
// Feature descriptor — what a feature declares about itself
// ---------------------------------------------------------------------------

export interface FeatureDescriptor {
  /** Unique identifier (e.g. "assistant", "workflows"). */
  id: string;
  /** Environment variable that controls this feature. */
  envKey: string;
  /** Human-readable label for settings/debug UI. */
  label: string;
  /** Short description shown in the Features settings panel. */
  description: string;
  /** Whether the feature is enabled by default when no env var or user pref is set. */
  defaultEnabled: boolean;
  /** "system" = maintainer-only (env var). "user" = user-togglable + env override. */
  tier: "system" | "user";
  /** Which subscription plan is required. Defaults to "free" if omitted. */
  plan?: PlanTier;
  /** Category for grouping in settings UI (e.g. "ai", "automation"). */
  category?: string;
  /** Settings sidebar section(s) hidden when this feature is disabled. */
  settingsSections?: string[];
  /** AI tool names that should be excluded when this feature is disabled. */
  gatedTools?: string[];
  /** Other feature IDs this feature depends on. If a dependency is disabled, this is too. */
  requires?: string[];
  /**
   * Optional server-side hooks and route handlers owned by this feature.
   * App routes look these up through FEATURE_REGISTRY instead of importing
   * feature internals directly.
   */
  server?: FeatureServerDefinition;
  /** Optional assistant prompt/tool contributions owned by this feature. */
  assistant?: FeatureAssistantDefinition;
  /** Optional UI components exposed by this feature, keyed by host surface ID. */
  // biome-ignore lint/suspicious/noExplicitAny: feature UI surfaces have heterogeneous props
  ui?: Record<string, ComponentType<any>>;
  /** Optional non-UI helper resources exposed to host-owned surfaces. */
  resources?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Feature Assistant Hooks
// ---------------------------------------------------------------------------

/** Server-side assistant services provided by the host app to feature hooks. */
export interface FeatureAssistantRuntime {
  services: Record<string, unknown>;
}

// biome-ignore lint/suspicious/noExplicitAny: assistant tool executors have heterogeneous schemas
export type FeatureAssistantToolExecutor = (params: any) => Promise<unknown>;

/** Assistant extension points exposed by a feature descriptor. */
export interface FeatureAssistantDefinition {
  /** Extra system-prompt sections contributed by this feature. */
  promptContext?: (runtime: FeatureAssistantRuntime) => string[];
  /** Assistant tool execute functions contributed by this feature, keyed by tool ID. */
  toolExecutors?: (
    runtime: FeatureAssistantRuntime
  ) => Record<string, FeatureAssistantToolExecutor>;
}

// ---------------------------------------------------------------------------
// Feature Server Hooks
// ---------------------------------------------------------------------------

/** Server services provided by the host app to feature-owned server handlers. */
export interface FeatureServerRuntime {
  services: Record<string, unknown>;
}

/** Feature-owned background task started by the host runtime. */
export type FeatureServerBackgroundHandler = (
  runtime: FeatureServerRuntime
) => undefined | (() => void);

/** Input passed to a feature-owned server route handler. */
export interface FeatureServerRouteInput {
  request: Request;
  body: Record<string, unknown>;
  runtime: FeatureServerRuntime;
}

/** Standard response shape returned by feature-owned server route handlers. */
export interface FeatureServerRouteResult {
  status: number;
  payload: unknown;
}

/** Feature-owned server route handler. */
export type FeatureServerRouteHandler = (
  input: FeatureServerRouteInput
) => Promise<FeatureServerRouteResult>;

/** Server-side extension points exposed by a feature descriptor. */
export interface FeatureServerDefinition {
  /** Configure feature-owned server internals with host services. */
  configure?: (runtime: FeatureServerRuntime) => void;
  /** Named route handlers delegated to by app shell routes. */
  routes?: Record<string, FeatureServerRouteHandler>;
  /** Named background workers started by host-owned runtime gates. */
  background?: Record<string, FeatureServerBackgroundHandler>;
}

// ---------------------------------------------------------------------------
// User preferences — stored in DB, partial (missing = use default)
// ---------------------------------------------------------------------------

export type FeaturePreferences = Partial<Record<string, boolean>>;

// ---------------------------------------------------------------------------
// Feature info — returned by list functions for UI rendering
// ---------------------------------------------------------------------------

export interface FeatureInfo {
  id: string;
  label: string;
  description: string;
  tier: "system" | "user";
  plan: PlanTier;
  category: string;
  envEnabled: boolean;
  userPref: boolean | undefined;
  effectiveEnabled: boolean;
  /** True when the feature is disabled solely because the user's plan is too low. */
  planLocked: boolean;
}
