/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import preview from "@radarboard/storybook-preview";
import { SummaryMetricCell } from "@radarboard/widget-engine/summary-metric-cell";

const meta = preview.meta({
  title: "Widgets/Building Blocks/Stats/Metric Cell",
  component: SummaryMetricCell,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Single metric tile used inside a grouped metric grid. Use inside `Metric Grid` or another bounded summary band, not as a standalone dashboard section.",
      },
    },
  },
  args: {
    label: "Revenue",
    value: "$12,450",
    variant: "default",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "podium-gold", "podium-silver", "podium-bronze"],
    },
  },
});

export default meta;

export const Default = meta.story({
  render: (args) => (
    <div className="w-[220px] border border-border bg-surface">
      <SummaryMetricCell {...args} />
    </div>
  ),
});

export const PodiumGold = meta.story({
  args: {
    label: "1st",
    value: "98",
    variant: "podium-gold",
  },
});
