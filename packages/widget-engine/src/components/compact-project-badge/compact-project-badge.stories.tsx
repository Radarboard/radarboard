/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import preview from "@radarboard/storybook-preview";
import { CompactProjectBadge } from "@radarboard/widget-engine/compact-project-badge";

const meta = preview.meta({
  title: "Widgets/Building Blocks/Stats/Project Badge",
  component: CompactProjectBadge,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Compact ownership/status badge for rows and metadata rails. Use to attach a project label to another primary surface, not as the main content of a block.",
      },
    },
  },
  args: {
    color: "#5b8af5",
    label: "radarboard",
  },
});

export default meta;

export const Default = meta.story({});

export const LongLabel = meta.story({
  args: {
    label: "goshuin-atlas-ios",
    color: "#e05555",
  },
});
