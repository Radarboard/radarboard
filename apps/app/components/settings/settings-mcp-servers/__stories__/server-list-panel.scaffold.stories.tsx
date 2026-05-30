/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { ServerListPanel } from "../server-list-panel";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Components/Settings/Settings Mcp Servers/ServerListPanel",
  component: ServerListPanel,
} satisfies Meta<typeof ServerListPanel>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "ServerListPanel",
      sourcePath: "apps/app/components/settings/settings-mcp-servers/server-list-panel.tsx",
      Component: ServerListPanel,
      args: {},
    }),
};
