/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { Dashboard } from "../index";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Components/Dashboard",
  component: Dashboard,
} satisfies Meta<typeof Dashboard>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "Dashboard",
      sourcePath: "apps/app/components/dashboard/dashboard/index.tsx",
      Component: Dashboard,
      args: {},
    }),
};
