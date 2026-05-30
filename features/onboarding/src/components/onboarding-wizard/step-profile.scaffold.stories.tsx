/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { StepProfile } from "./step-profile";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Components/Onboarding/Onboarding Wizard/StepProfile",
  component: StepProfile,
} satisfies Meta<typeof StepProfile>;

export default meta;


export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "StepProfile",
      sourcePath: "apps/app/components/onboarding/onboarding-wizard/step-profile.tsx",
      Component: StepProfile,
      args: {},
    }),
};
