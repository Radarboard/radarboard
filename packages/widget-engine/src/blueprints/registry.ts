/**
 * Blueprint registry — static catalog of pre-made layout+widget combinations.
 *
 * Each blueprint references a layout recipe for its grid structure and maps
 * specific widgets to each cell. Blueprints are scored against user personas
 * and connected integrations to surface the most relevant options.
 */

import type { UserProfile } from "@radarboard/types/database";
import { LAYOUT_RECIPES } from "@radarboard/widget-engine/layout-recipe-gallery";
import { BASIC_3X3, BASIC_4X3 } from "@radarboard/widget-engine/layouts";
import type { LayoutBlueprintDescriptor } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRecipeLayout(recipeId: string) {
  const recipe = LAYOUT_RECIPES.find((r) => r.id === recipeId);
  if (!recipe) throw new Error(`Layout recipe "${recipeId}" not found`);
  return recipe.layout;
}

// ---------------------------------------------------------------------------
// Blueprint catalog
// ---------------------------------------------------------------------------

export const LAYOUT_BLUEPRINTS: LayoutBlueprintDescriptor[] = [
  {
    id: "oss-command-center",
    name: "Open Source Command Center",
    description:
      "Track sponsorship, roadmap, analytics, and shipping activity at a glance. Designed for open source maintainers who need community health metrics front and center.",
    recipeId: "hero-focus",
    layout: getRecipeLayout("hero-focus"),
    slots: [
      {
        cellId: "hero",
        widgetId: "sponsorship",
        purpose: "Sponsorship and community traction",
      },
      { cellId: "side-a", widgetId: "roadmap", purpose: "Roadmap activity and review queue" },
      { cellId: "side-b", widgetId: "analytics", purpose: "Analytics trends" },
      { cellId: "foot-a", widgetId: "shipping", purpose: "Release cadence" },
      { cellId: "foot-b", widgetId: "sponsorship", purpose: "Sponsor revenue" },
      { cellId: "foot-c", widgetId: "shipping", purpose: "Shipping activity" },
    ],
    requiredIntegrations: [],
    personaAffinities: ["opensource"],
    tags: ["open-source", "community"],
  },
  {
    id: "indie-revenue-dashboard",
    name: "Indie Revenue Dashboard",
    description:
      "Revenue, analytics, and SEO in one view. Built for indie hackers who ship solo and need to track product-market fit signals.",
    recipeId: "basic-3x3",
    layout: BASIC_3X3,
    slots: [
      { cellId: "cell-1", widgetId: "revenue", purpose: "MRR & gross revenue" },
      { cellId: "cell-2", widgetId: "analytics", purpose: "Visitor & session metrics" },
      { cellId: "cell-3", widgetId: "seo", purpose: "Search performance" },
      { cellId: "cell-4", widgetId: "shipping", purpose: "Shipping timeline & releases" },
      { cellId: "cell-5", widgetId: "observability", purpose: "Service monitoring" },
      { cellId: "cell-6", widgetId: "roadmap", purpose: "Roadmap activity" },
      { cellId: "cell-7", widgetId: "sponsorship", purpose: "Community traction" },
      { cellId: "cell-8", widgetId: "shipping", purpose: "Shipping cadence" },
      { cellId: "cell-9", widgetId: "observability", purpose: "Service status" },
    ],
    requiredIntegrations: [],
    personaAffinities: ["indie", "fullstack"],
    tags: ["saas", "revenue"],
  },
  {
    id: "seo-analytics-hub",
    name: "SEO & Analytics Hub",
    description:
      "Deep SEO and traffic analytics with search console data, page views, and content performance tracking.",
    recipeId: "basic-3x3",
    layout: BASIC_3X3,
    slots: [
      { cellId: "cell-1", widgetId: "seo", purpose: "Search rankings & CTR" },
      { cellId: "cell-2", widgetId: "analytics", purpose: "Traffic & sessions" },
      { cellId: "cell-3", widgetId: "analytics", purpose: "Content analytics" },
      { cellId: "cell-4", widgetId: "observability", purpose: "Service feedback and health" },
      { cellId: "cell-5", widgetId: "bookmarks", purpose: "Bookmarks & references" },
      { cellId: "cell-6", widgetId: "shipping", purpose: "Content releases" },
      { cellId: "cell-7", widgetId: "sponsorship", purpose: "Community health" },
      { cellId: "cell-8", widgetId: "observability", purpose: "Service health" },
      { cellId: "cell-9", widgetId: "observability", purpose: "Service reliability" },
    ],
    requiredIntegrations: [],
    personaAffinities: ["seo", "marketing", "content-creator"],
    tags: ["seo", "content"],
  },
  {
    id: "devops-monitor",
    name: "DevOps Monitor",
    description:
      "Observability rail with service health and shipping activity. Designed for platform engineers who need operational awareness.",
    recipeId: "rail-workbench",
    layout: getRecipeLayout("rail-workbench"),
    slots: [
      { cellId: "rail", widgetId: "observability", purpose: "Service monitor overview" },
      { cellId: "main", widgetId: "observability", purpose: "Service health history" },
      { cellId: "queue", widgetId: "shipping", purpose: "Shipping queue" },
      { cellId: "detail", widgetId: "observability", purpose: "Service status" },
    ],
    requiredIntegrations: [],
    personaAffinities: ["devops", "backend"],
    tags: ["infrastructure", "monitoring"],
  },
  {
    id: "mobile-app-tracker",
    name: "Mobile App Tracker",
    description:
      "App Store reviews, ASO keywords, revenue, and analytics. Everything you need to track app health.",
    recipeId: "basic-3x3",
    layout: BASIC_3X3,
    slots: [
      { cellId: "cell-1", widgetId: "observability", purpose: "App health and reviews" },
      { cellId: "cell-2", widgetId: "seo", purpose: "Search performance" },
      { cellId: "cell-3", widgetId: "revenue", purpose: "In-app revenue" },
      { cellId: "cell-4", widgetId: "analytics", purpose: "User analytics" },
      { cellId: "cell-5", widgetId: "observability", purpose: "Crash & service monitoring" },
      { cellId: "cell-6", widgetId: "shipping", purpose: "Release history" },
      { cellId: "cell-7", widgetId: "analytics", purpose: "App analytics" },
      { cellId: "cell-8", widgetId: "observability", purpose: "Service health" },
      { cellId: "cell-9", widgetId: "sponsorship", purpose: "Community health" },
    ],
    requiredIntegrations: [],
    personaAffinities: ["mobile"],
    tags: ["mobile", "app"],
  },
  {
    id: "team-velocity",
    name: "Team Velocity",
    description:
      "Roadmap progress, Roadmap throughput, builds, and shipping cadence. A manager's view of team output and project health.",
    recipeId: "basic-3x3",
    layout: BASIC_3X3,
    slots: [
      { cellId: "cell-1", widgetId: "roadmap", purpose: "Roadmap & milestones" },
      { cellId: "cell-2", widgetId: "roadmap", purpose: "Roadmap throughput" },
      { cellId: "cell-3", widgetId: "shipping", purpose: "Release cadence" },
      { cellId: "cell-4", widgetId: "shipping", purpose: "Shipping activity" },
      { cellId: "cell-5", widgetId: "observability", purpose: "Service health" },
      { cellId: "cell-6", widgetId: "analytics", purpose: "Product usage" },
      { cellId: "cell-7", widgetId: "seo", purpose: "Search visibility" },
      { cellId: "cell-8", widgetId: "observability", purpose: "Service health" },
      { cellId: "cell-9", widgetId: "shipping", purpose: "Shipping cadence" },
    ],
    requiredIntegrations: [],
    personaAffinities: ["team-lead"],
    tags: ["team", "velocity"],
  },
  {
    id: "content-creator-hub",
    name: "Content Creator Hub",
    description:
      "Analytics, SEO, bookmarks, and shipping across 12 tiles. Track content reach and audience growth at a glance.",
    recipeId: "basic-4x3",
    layout: BASIC_4X3,
    slots: [
      { cellId: "cell-1", widgetId: "analytics", purpose: "Traffic & audience overview" },
      { cellId: "cell-2", widgetId: "seo", purpose: "Search performance" },
      { cellId: "cell-3", widgetId: "bookmarks", purpose: "Curated bookmarks" },
      { cellId: "cell-4", widgetId: "observability", purpose: "Audience feedback" },
      { cellId: "cell-5", widgetId: "shipping", purpose: "Content releases" },
      { cellId: "cell-6", widgetId: "analytics", purpose: "Analytics metrics" },
      { cellId: "cell-7", widgetId: "sponsorship", purpose: "Community traction" },
      { cellId: "cell-8", widgetId: "shipping", purpose: "Shipping updates" },
      { cellId: "cell-9", widgetId: "roadmap", purpose: "Roadmap activity" },
      { cellId: "cell-10", widgetId: "observability", purpose: "Service health" },
      { cellId: "cell-11", widgetId: "observability", purpose: "Service monitoring" },
      { cellId: "cell-12", widgetId: "revenue", purpose: "Sponsorship & revenue" },
    ],
    requiredIntegrations: [],
    personaAffinities: ["content-creator"],
    tags: ["content", "audience"],
  },
  {
    id: "growth-dashboard",
    name: "Growth Dashboard",
    description:
      "Analytics, revenue, and SEO metrics across 12 tiles. For marketers and data analysts focused on growth levers.",
    recipeId: "basic-4x3",
    layout: BASIC_4X3,
    slots: [
      { cellId: "cell-1", widgetId: "analytics", purpose: "Traffic & conversion" },
      { cellId: "cell-2", widgetId: "revenue", purpose: "Revenue metrics" },
      { cellId: "cell-3", widgetId: "seo", purpose: "Organic search" },
      { cellId: "cell-4", widgetId: "sponsorship", purpose: "Community health" },
      { cellId: "cell-5", widgetId: "analytics", purpose: "Analytics trends" },
      { cellId: "cell-6", widgetId: "observability", purpose: "Service reliability" },
      { cellId: "cell-7", widgetId: "observability", purpose: "Service sentiment" },
      { cellId: "cell-8", widgetId: "shipping", purpose: "Release cadence" },
      { cellId: "cell-9", widgetId: "roadmap", purpose: "Roadmap activity" },
      { cellId: "cell-10", widgetId: "observability", purpose: "Domain health" },
      { cellId: "cell-11", widgetId: "observability", purpose: "Service status" },
      { cellId: "cell-12", widgetId: "shipping", purpose: "Shipping activity" },
    ],
    requiredIntegrations: [],
    personaAffinities: ["marketing", "data"],
    tags: ["growth", "analytics"],
  },
];

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

/** Look up a blueprint by ID. */
export function getBlueprintById(id: string): LayoutBlueprintDescriptor | undefined {
  return LAYOUT_BLUEPRINTS.find((b) => b.id === id);
}

/** Get blueprints matching any of the given personas, sorted by affinity. */
export function getBlueprintsForPersonas(personas: UserProfile[]): LayoutBlueprintDescriptor[] {
  if (personas.length === 0) return LAYOUT_BLUEPRINTS;
  const personaSet = new Set(personas);
  return LAYOUT_BLUEPRINTS.filter((b) => b.personaAffinities.some((p) => personaSet.has(p))).sort(
    (a, b) => {
      const aScore = a.personaAffinities.filter((p) => personaSet.has(p)).length;
      const bScore = b.personaAffinities.filter((p) => personaSet.has(p)).length;
      return bScore - aScore;
    }
  );
}

/**
 * Score how well a blueprint fits the user's context.
 * Returns a value between 0 and 1.
 *
 * Weighting: persona match = 60%, integration coverage = 40% when a blueprint
 * has hard integration requirements. Provider-neutral blueprints are scored by
 * persona only.
 */
export function scoreBlueprintFit(
  blueprint: LayoutBlueprintDescriptor,
  context: { personas: UserProfile[]; connectedIntegrations: string[] }
): number {
  // Persona score: fraction of blueprint's affinities matched
  const personaScore =
    blueprint.personaAffinities.length > 0
      ? blueprint.personaAffinities.filter((p) => context.personas.includes(p)).length /
        blueprint.personaAffinities.length
      : 0;

  if (blueprint.requiredIntegrations.length === 0) {
    return personaScore;
  }

  // Integration score: fraction of required integrations that are connected
  const integrationScore =
    blueprint.requiredIntegrations.filter((i) => context.connectedIntegrations.includes(i)).length /
    blueprint.requiredIntegrations.length;

  return personaScore * 0.6 + integrationScore * 0.4;
}
