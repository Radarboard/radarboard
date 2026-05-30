/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { DetailRow } from "./index";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "UI/Dialog/DetailRow",
  component: DetailRow,
} satisfies Meta<typeof DetailRow>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "DetailRow",
      sourcePath: "packages/ui/src/dialog/index.tsx",
      Component: DetailRow,
      args: {},
    }),
};
