import type { LayoutDefinition, UserProfile } from "@radarboard/types/database";

/** A single cell-to-widget mapping within a blueprint. */
export interface BlueprintWidgetSlot {
  cellId: string;
  widgetId: string;
  /** Human-readable purpose shown in the picker UI. */
  purpose: string;
}

/** A pre-made layout that bundles grid structure + widget assignments + persona affinity. */
export interface LayoutBlueprintDescriptor {
  /** Unique blueprint ID, e.g. "oss-command-center". */
  id: string;
  /** Display name, e.g. "Open Source Command Center". */
  name: string;
  /** 1-2 sentence description. */
  description: string;
  /** Reference to the base layout recipe ID from LAYOUT_RECIPES. */
  recipeId: string;
  /** Full layout definition (copied from recipe, potentially customized). */
  layout: LayoutDefinition;
  /** Widget assignments per cell. */
  slots: BlueprintWidgetSlot[];
  /** Integration IDs this blueprint needs (union of all widgets' requiredIntegrations). */
  requiredIntegrations: string[];
  /** Personas this blueprint is designed for, ordered by relevance. */
  personaAffinities: UserProfile[];
  /** Optional tags for search/filtering as the catalog grows. */
  tags?: string[];
}

/** Result of applying or merging a blueprint. */
export interface ApplyBlueprintResult {
  layout: LayoutDefinition;
  widgetAssignments: Record<string, string | null>;
  missingIntegrations: string[];
  /** Widgets that were already placed and preserved (smart merge). */
  keptWidgets: string[];
  /** Cells that were empty and got a blueprint widget. */
  filledCells: string[];
  /** Blueprint widgets skipped because they're already placed elsewhere. */
  skippedDuplicates: string[];
}
