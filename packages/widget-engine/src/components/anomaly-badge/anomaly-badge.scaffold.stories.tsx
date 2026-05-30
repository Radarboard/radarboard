/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { AnomalyBadge } from "./index";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Widget Engine/AnomalyBadge",
  component: AnomalyBadge,
} satisfies Meta<typeof AnomalyBadge>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "AnomalyBadge",
      sourcePath: "packages/widget-engine/src/components/anomaly-badge/index.tsx",
      Component: AnomalyBadge,
      args: {},
    }),
};
