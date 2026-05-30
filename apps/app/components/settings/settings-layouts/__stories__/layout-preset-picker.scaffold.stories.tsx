/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { LayoutPresetPicker } from "../preset-picker";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Components/Settings/Settings Layouts/LayoutPresetPicker",
  component: LayoutPresetPicker,
} satisfies Meta<typeof LayoutPresetPicker>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "LayoutPresetPicker",
      sourcePath: "apps/app/components/settings/settings-layouts/preset-picker.tsx",
      Component: LayoutPresetPicker,
      args: {},
    }),
};
