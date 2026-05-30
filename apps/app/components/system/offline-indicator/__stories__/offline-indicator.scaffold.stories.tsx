/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { OfflineIndicator } from "../index";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Components/System/OfflineIndicator",
  component: OfflineIndicator,
} satisfies Meta<typeof OfflineIndicator>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "OfflineIndicator",
      sourcePath: "apps/app/components/system/offline-indicator/index.tsx",
      Component: OfflineIndicator,
      args: {},
    }),
};
