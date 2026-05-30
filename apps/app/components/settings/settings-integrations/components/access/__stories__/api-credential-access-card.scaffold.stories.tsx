/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { ApiCredentialAccessCard } from "../api-access";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Components/Settings/Settings Integrations/Access/ApiCredentialAccessCard",
  component: ApiCredentialAccessCard,
} satisfies Meta<typeof ApiCredentialAccessCard>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "ApiCredentialAccessCard",
      sourcePath: "apps/app/components/settings/settings-integrations/components/access/api-access.tsx",
      Component: ApiCredentialAccessCard,
      args: {},
    }),
};
