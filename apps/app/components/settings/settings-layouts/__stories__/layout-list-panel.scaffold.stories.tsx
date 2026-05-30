/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { LayoutListPanel } from "../layout-list-panel";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Components/Settings/Settings Layouts/LayoutListPanel",
  component: LayoutListPanel,
} satisfies Meta<typeof LayoutListPanel>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "LayoutListPanel",
      sourcePath: "apps/app/components/settings/settings-layouts/layout-list-panel.tsx",
      Component: LayoutListPanel,
      args: {},
    }),
};
