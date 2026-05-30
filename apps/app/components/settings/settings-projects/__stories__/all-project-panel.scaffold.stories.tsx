/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { AllProjectPanel } from "../project-detail-panel";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Components/Settings/Settings Projects/AllProjectPanel",
  component: AllProjectPanel,
} satisfies Meta<typeof AllProjectPanel>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "AllProjectPanel",
      sourcePath: "apps/app/components/settings/settings-projects/project-detail-panel.tsx",
      Component: AllProjectPanel,
      args: {},
    }),
};
