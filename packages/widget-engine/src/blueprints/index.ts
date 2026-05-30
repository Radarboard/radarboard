// biome-ignore lint/performance/noBarrelFile: package entrypoint — consumers use subpath exports for tree-shaking
export { applyBlueprint, smartMergeBlueprint } from "./apply";
export {
  getBlueprintById,
  getBlueprintsForPersonas,
  LAYOUT_BLUEPRINTS,
  scoreBlueprintFit,
} from "./registry";
export type { ApplyBlueprintResult, BlueprintWidgetSlot, LayoutBlueprintDescriptor } from "./types";
