/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { SeoQueries } from "./index";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Widgets/SeoQueries",
  component: SeoQueries,
} satisfies Meta<typeof SeoQueries>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "SeoQueries",
      sourcePath: "widgets/seo/src/components/seo-queries/index.tsx",
      Component: SeoQueries,
      args: {},
    }),
};
