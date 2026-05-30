/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { OnboardingProgress } from "./onboarding-progress";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Components/Onboarding/Onboarding Wizard/OnboardingProgress",
  component: OnboardingProgress,
} satisfies Meta<typeof OnboardingProgress>;

export default meta;


export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "OnboardingProgress",
      sourcePath: "apps/app/components/onboarding/onboarding-wizard/onboarding-progress.tsx",
      Component: OnboardingProgress,
      args: {},
    }),
};
