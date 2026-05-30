/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { GitHubSponsorsList } from "./index";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Widgets/Github Sponsors/GitHubSponsorsList",
  component: GitHubSponsorsList,
} satisfies Meta<typeof GitHubSponsorsList>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "GitHubSponsorsList",
      sourcePath: "widgets/sponsorship/src/components/github-sponsors/index.tsx",
      Component: GitHubSponsorsList,
      args: {},
    }),
};
