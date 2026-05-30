/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { WidgetDetailDialog } from "../index";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Components/Widgets/WidgetDetailDialog",
  component: WidgetDetailDialog,
} satisfies Meta<typeof WidgetDetailDialog>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "WidgetDetailDialog",
      sourcePath: "apps/app/components/widgets/widget-detail-dialog/index.tsx",
      Component: WidgetDetailDialog,
      args: {},
    }),
};
