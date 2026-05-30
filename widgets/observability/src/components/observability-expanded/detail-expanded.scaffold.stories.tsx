/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { DetailExpanded } from "./index";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Widgets/Observability Expanded/DetailExpanded",
  component: DetailExpanded,
} satisfies Meta<typeof DetailExpanded>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "DetailExpanded",
      sourcePath: "widgets/observability/src/components/observability-expanded/index.tsx",
      Component: DetailExpanded,
      args: {},
    }),
};
