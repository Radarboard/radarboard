/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { OAuthServiceCard } from "../index";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Components/Credentials/Oauth Service Card/OAuthServiceCard",
  component: OAuthServiceCard,
} satisfies Meta<typeof OAuthServiceCard>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "OAuthServiceCard",
      sourcePath: "apps/app/components/credentials/oauth-service-card/index.tsx",
      Component: OAuthServiceCard,
      args: {},
    }),
};
