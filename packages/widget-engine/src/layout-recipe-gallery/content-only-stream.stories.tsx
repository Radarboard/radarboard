/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import preview from "@radarboard/storybook-preview";
import { LayoutRecipeGrid, LAYOUT_RECIPES } from "@radarboard/widget-engine/layout-recipe-gallery";

const recipe = LAYOUT_RECIPES.find((item) => item.id === "content-only-stream");
if (!recipe) throw new Error("Missing layout recipe: content-only-stream");

const meta = preview.meta({
  title: "Layout Recipes/Content Only Stream",
  component: LayoutRecipeGrid,
  parameters: { layout: "fullscreen" },
});

export default meta;
export const Default = meta.story({
  render: () => <LayoutRecipeGrid recipe={recipe} />,
});
