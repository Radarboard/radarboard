/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { StepWelcome } from "./step-welcome";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Components/Onboarding/Onboarding Wizard/StepWelcome",
  component: StepWelcome,
} satisfies Meta<typeof StepWelcome>;

export default meta;


export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "StepWelcome",
      sourcePath: "apps/app/components/onboarding/onboarding-wizard/step-welcome.tsx",
      Component: StepWelcome,
      args: {},
    }),
};
