/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { AppStoreReviews } from "./index";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Widgets/AppStoreReviews",
  component: AppStoreReviews,
} satisfies Meta<typeof AppStoreReviews>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "AppStoreReviews",
      sourcePath: "widgets/observability/src/components/app-store-reviews/index.tsx",
      Component: AppStoreReviews,
      args: {},
    }),
};
