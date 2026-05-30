/**
 * @radarboard/widget-sdk — Public API for building widgets.
 *
 * This package provides the core types, registries, and template utilities
 * that widget authors need. Component-heavy pieces (section renderers,
 * TemplateWidget, DataResolverProvider) remain in @radarboard/widget-engine for now
 * and will be migrated incrementally.
 */

export type { WidgetCapability } from "@radarboard/types/extension";
// Capability utilities
export {
  getConnectedCapabilityProviders,
  getProjectIntegrationKeyCandidates,
  getWidgetCapability,
  isCapabilityProviderConnected,
  resolveCapabilityProvider,
} from "./capability-utils";
// Composition catalog
export type {
  CompositionAntiPattern,
  CompositionCapability,
  CompositionExample,
  LayoutNodeDescriptor,
  PrimitiveDescriptor,
  RecipeDescriptor,
} from "./composition-catalog";
export {
  COMPOSITION_ANTI_PATTERNS,
  COMPOSITION_EXAMPLES,
  LAYOUT_NODE_CATALOG,
  PRIMITIVE_EXAMPLES,
  RECIPE_CATALOG,
  SECTION_PRIMITIVE_CATALOG,
} from "./composition-catalog";
// Data source registry
export {
  DATA_SOURCE_REGISTRY,
  type DataSourceResolver,
  type DataSourceResolverProps,
  registerTemplateDataSource,
  reportResolverState,
} from "./data-source-registry";
// Debug events
export { emitWidgetDebugEvent } from "./debug-events";
// Detail renderer registry
export {
  DETAIL_RENDERER_REGISTRY,
  registerTemplateDetailRenderer,
  type TemplateDetailRenderer,
  type TemplateDetailRendererProps,
} from "./detail-renderer-registry";
// Recipe model
export type {
  CanonicalTemplateRecipeKind,
  TemplateRecipeKind,
  TemplateRecipeModel,
  TemplateSectionBucket,
} from "./recipe-model";
export {
  buildTemplateRecipe,
  getTemplateRecipeBuckets,
  inferTemplateRecipe,
  isTemplateConfig,
  isTemplateRecipeModelValid,
  migrateTemplateConfig,
  normalizeTemplateRecipeKind,
  normalizeTemplateRecipeModel,
  synchronizeTemplateConfig,
  TEMPLATE_CONFIG_VERSION,
} from "./recipe-model";
// Recipes (layout factories)
export {
  createContentOnlyRecipe,
  createFeedListRecipe,
  createRailContentRecipe,
  createRailListRecipe,
  createSummaryChartListRecipe,
  createSummaryContentRecipe,
  createSummaryListRecipe,
  createSummaryOnlyRecipe,
  gridLayout,
  splitLayout,
  stackLayout,
} from "./recipes";
// Route helpers
export { integrationRoute, pluginRoute } from "./route-helpers";
// Section helpers (shorthand section constructors)
export {
  alert,
  cardList,
  chart,
  headlineStat,
  kpiRow,
  list,
  rowList,
  summaryQuad,
  tabs,
} from "./section-helpers";
// Section utilities
export { getDefaultMaxItems, hasMaxItemsSections } from "./section-utils";
// Testing utilities
export {
  createEmptyWidgetData,
  createMockWidgetData,
  createWidgetPreviewStates,
  extractDataSources,
  type MockDataShape,
  type WidgetPreviewStates,
} from "./testing";
// Template config types
export type {
  ActivityChartSectionConfig,
  AlertSectionConfig,
  CardListSectionConfig,
  ChartSectionConfig,
  CreateTemplateDescriptorOptions,
  DataSource,
  DataSourceDeclaration,
  DenseRankedTableSectionConfig,
  FilterBarSectionConfig,
  GridLayoutConfig,
  HeadlineStatSectionConfig,
  KPIMetricConfig,
  KPIRowSectionConfig,
  LayoutGap,
  ListSectionConfig,
  OverviewPanelRowConfig,
  OverviewPanelSectionConfig,
  RowListSectionConfig,
  SectionConfig,
  SplitLayoutConfig,
  StackLayoutConfig,
  StreamListSectionConfig,
  SummaryQuadSectionConfig,
  TableSectionConfig,
  TabsSectionConfig,
  TemplateSelectionConfig,
  WidgetTemplateConfig,
} from "./types";
// Variant utilities
export {
  createCustomVariant,
  DEFAULT_VARIANT_ID,
  extractInstanceOverrides,
  getActiveVariantId,
  getAvailableVariants,
  getDefaultVariant,
  getVariantConfig,
  isBuiltInVariant,
  resolveVariantConfig,
  type VariantOption,
} from "./variant-utils";
// Widget types (WidgetDescriptor, WidgetRenderProps, etc.)
export type {
  CustomVariant,
  GridSlot,
  WidgetAuth,
  WidgetAuthField,
  WidgetDescriptor,
  WidgetDisplayContext,
  WidgetExpandAction,
  WidgetModalSize,
  WidgetOAuthConfig,
  WidgetPollingConfig,
  WidgetRenderProps,
  WidgetTemplateVisualEditorBinding,
  WidgetVariant,
  WidgetVisualEditorBinding,
} from "./widget-types";
