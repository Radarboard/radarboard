/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { DemoBanner } from "../demo-banner";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Components/Onboarding/DemoBanner",
  component: DemoBanner,
} satisfies Meta<typeof DemoBanner>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "DemoBanner",
      sourcePath: "apps/app/components/onboarding/demo-banner.tsx",
      Component: DemoBanner,
      args: {},
    }),
};
