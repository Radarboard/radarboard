/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { StagePicker } from "../index";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Components/Settings/Projects/Context Editor/StagePicker",
  component: StagePicker,
} satisfies Meta<typeof StagePicker>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "StagePicker",
      sourcePath: "apps/app/components/settings/projects/context-editor/index.tsx",
      Component: StagePicker,
      args: {},
    }),
};
