/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { ScoreBar } from "./index";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Widgets/Aso Keywords Compact/ScoreBar",
  component: ScoreBar,
} satisfies Meta<typeof ScoreBar>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "ScoreBar",
      sourcePath: "widgets/aso-keywords/src/components/aso-keywords-compact/index.tsx",
      Component: ScoreBar,
      args: {},
    }),
};
