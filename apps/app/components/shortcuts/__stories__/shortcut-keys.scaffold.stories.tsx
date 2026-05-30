/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { ShortcutKeys } from "../shortcut-keys";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Components/Shortcuts/ShortcutKeys",
  component: ShortcutKeys,
} satisfies Meta<typeof ShortcutKeys>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "ShortcutKeys",
      sourcePath: "apps/app/components/shortcuts/shortcut-keys.tsx",
      Component: ShortcutKeys,
      args: {},
    }),
};
