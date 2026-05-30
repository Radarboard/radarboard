/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { DuplicateLayoutDialog } from "../clone-dialog";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Components/Settings/Settings Layouts/DuplicateLayoutDialog",
  component: DuplicateLayoutDialog,
} satisfies Meta<typeof DuplicateLayoutDialog>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "DuplicateLayoutDialog",
      sourcePath: "apps/app/components/settings/settings-layouts/clone-dialog.tsx",
      Component: DuplicateLayoutDialog,
      args: {},
    }),
};
