/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { StepPlugins } from "./step-plugins";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Components/Onboarding/Onboarding Wizard/StepPlugins",
  component: StepPlugins,
} satisfies Meta<typeof StepPlugins>;

export default meta;


export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "StepPlugins",
      sourcePath: "apps/app/components/onboarding/onboarding-wizard/step-plugins.tsx",
      Component: StepPlugins,
      args: {},
    }),
};
