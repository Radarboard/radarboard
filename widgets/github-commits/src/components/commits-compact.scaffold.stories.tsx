/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { CommitsCompact } from "./commits-compact";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Widgets/CommitsCompact",
  component: CommitsCompact,
} satisfies Meta<typeof CommitsCompact>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "CommitsCompact",
      sourcePath: "widgets/github-commits/src/components/commits-compact.tsx",
      Component: CommitsCompact,
      args: {},
    }),
};
