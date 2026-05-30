/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useFilenamingConvention: sibling story filenames intentionally encode component names. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { KPIStrip } from "../index";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Widgets/Chrome/Kpi Strip/KPIStrip",
  component: KPIStrip,
} satisfies Meta<typeof KPIStrip>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "KPIStrip",
      sourcePath: "packages/widgets/src/chrome/kpi-strip/index.tsx",
      Component: KPIStrip,
      args: {},
    }),
};
