/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import preview from "@radarboard/storybook-preview";
import { HeadlineStat } from "@radarboard/widget-engine/headline-stat";

const meta = preview.meta({
  title: "Widgets/Building Blocks/Stats/Live Metric",
  component: HeadlineStat,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Single metric callout for compact widget headers. Use when one number should anchor the block. Avoid it when the surface needs comparisons, ranking, or multiple peer metrics.",
      },
    },
  },
  args: {
    value: "142",
    label: "live visitors",
    indicatorColor: "#4ade80",
  },
});

export default meta;

export const Default = meta.story({
  render: (args) => (
    <div className="border border-border bg-surface">
      <HeadlineStat {...args} />
    </div>
  ),
});

export const Warning = meta.story({
  args: {
    value: "14",
    label: "open issues",
    indicatorColor: "#facc15",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Use for a single live or top-line metric that needs attention but does not require a full KPI grid.",
      },
    },
  },
});
