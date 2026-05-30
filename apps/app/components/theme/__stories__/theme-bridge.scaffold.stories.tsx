/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { ThemeBridge } from "../theme-bridge";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Components/Theme/ThemeBridge",
  component: ThemeBridge,
} satisfies Meta<typeof ThemeBridge>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "ThemeBridge",
      sourcePath: "apps/app/components/theme/theme-bridge.tsx",
      Component: ThemeBridge,
      args: {},
    }),
};
