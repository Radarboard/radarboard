/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { MiniGridPreview } from "../layout-detail-panel";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Components/Settings/Settings Layouts/MiniGridPreview",
  component: MiniGridPreview,
} satisfies Meta<typeof MiniGridPreview>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "MiniGridPreview",
      sourcePath: "apps/app/components/settings/settings-layouts/layout-detail-panel.tsx",
      Component: MiniGridPreview,
      args: {},
    }),
};
