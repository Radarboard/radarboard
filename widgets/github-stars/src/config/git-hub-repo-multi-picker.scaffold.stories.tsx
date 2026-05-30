/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { GitHubRepoMultiPicker } from "./github-repo-multi-picker";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Widgets/Config/GitHubRepoMultiPicker",
  component: GitHubRepoMultiPicker,
} satisfies Meta<typeof GitHubRepoMultiPicker>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "GitHubRepoMultiPicker",
      sourcePath: "widgets/github-stars/src/config/github-repo-multi-picker.tsx",
      Component: GitHubRepoMultiPicker,
      args: {},
    }),
};
