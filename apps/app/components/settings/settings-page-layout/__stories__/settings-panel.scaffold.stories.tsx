/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { SettingsPanel } from "../index";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Components/Settings/Settings Page Layout/SettingsPanel",
  component: SettingsPanel,
} satisfies Meta<typeof SettingsPanel>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "SettingsPanel",
      sourcePath: "apps/app/components/settings/settings-page-layout/index.tsx",
      Component: SettingsPanel,
      args: {},
    }),
};
