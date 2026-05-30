// biome-ignore-all lint/performance/noBarrelFile: package subpath export for the template API needs a single entry point

// --- Re-exports from @radarboard/widget-sdk (canonical location) ---

export type {
  CompositionAntiPattern,
  CompositionCapability,
  CompositionExample,
  LayoutNodeDescriptor,
  PrimitiveDescriptor,
  RecipeDescriptor,
} from "@radarboard/widget-sdk/composition-catalog";
export {
  COMPOSITION_ANTI_PATTERNS,
  COMPOSITION_EXAMPLES,
  LAYOUT_NODE_CATALOG,
  PRIMITIVE_EXAMPLES,
  RECIPE_CATALOG,
  SECTION_PRIMITIVE_CATALOG,
} from "@radarboard/widget-sdk/composition-catalog";
export {
  DATA_SOURCE_REGISTRY,
  type DataSourceResolver,
  type DataSourceResolverProps,
  registerTemplateDataSource,
} from "@radarboard/widget-sdk/data-source-registry";
export {
  DETAIL_RENDERER_REGISTRY,
  registerTemplateDetailRenderer,
  type TemplateDetailRendererProps,
} from "@radarboard/widget-sdk/detail-renderer-registry";
export type {
  CanonicalTemplateRecipeKind,
  TemplateRecipeKind,
  TemplateRecipeModel,
  TemplateSectionBucket,
} from "@radarboard/widget-sdk/recipe-model";
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
} from "@radarboard/widget-sdk/recipe-model";
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
} from "@radarboard/widget-sdk/recipes";
export { getDefaultMaxItems, hasMaxItemsSections } from "@radarboard/widget-sdk/section-utils";
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
} from "@radarboard/widget-sdk/types";
export { createTemplateDescriptor } from "./create-template-descriptor";

// --- Local component exports (stay in @radarboard/widget-engine) ---

export {
  DataResolverProvider,
  useResolvedData,
  useResolvedSourceData,
  useResolvedSourceState,
} from "./data-resolver";
export { SectionRenderer } from "./section-renderer";
export { TemplateWidget, TemplateWidgetExpanded } from "./template-widget";

// --- Side-effect imports: register data sources and detail renderers ---
// These files call registerTemplateDataSource() and registerTemplateDetailRenderer()
// at module level, populating the SDK registries.
