/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { StepLayout } from "../step-layout";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Components/Onboarding/StepLayout",
  component: StepLayout,
} satisfies Meta<typeof StepLayout>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "StepLayout",
      sourcePath: "apps/app/components/onboarding/step-layout.tsx",
      Component: StepLayout,
      args: {},
    }),
};
