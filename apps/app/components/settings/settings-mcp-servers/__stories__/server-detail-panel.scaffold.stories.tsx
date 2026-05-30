/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { ServerDetailPanel } from "../server-detail-panel";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Components/Settings/Settings Mcp Servers/ServerDetailPanel",
  component: ServerDetailPanel,
} satisfies Meta<typeof ServerDetailPanel>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "ServerDetailPanel",
      sourcePath: "apps/app/components/settings/settings-mcp-servers/server-detail-panel.tsx",
      Component: ServerDetailPanel,
      args: {},
    }),
};
