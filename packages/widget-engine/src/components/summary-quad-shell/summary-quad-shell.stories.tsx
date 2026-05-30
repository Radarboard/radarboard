/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import preview from "@radarboard/storybook-preview";
import { SummaryMetricCell } from "@radarboard/widget-engine/summary-metric-cell";
import { SummaryQuadShell } from "@radarboard/widget-engine/summary-quad-shell";

const meta = preview.meta({
  title: "Widgets/Building Blocks/Containers/Metric Grid",
  component: SummaryQuadShell,
  render: ({ preset, width }) => (
    <div className="@container" style={{ width: `min(${width}px, calc(100vw - 2rem))` }}>
      <SummaryQuadShell
        slots={
          preset === "podium"
            ? [
                <SummaryMetricCell key="gold" label="1st" value="98" variant="podium-gold" />,
                <SummaryMetricCell key="silver" label="2nd" value="91" variant="podium-silver" />,
                <SummaryMetricCell key="bronze" label="3rd" value="84" variant="podium-bronze" />,
                <SummaryMetricCell key="delta" label="Delta" value="+7" />,
              ]
            : [
                <SummaryMetricCell key="revenue" label="Revenue" value="$12,450" />,
                <SummaryMetricCell key="mrr" label="MRR" value="$5,340" />,
                <SummaryMetricCell key="customers" label="Customers" value="812" />,
                <SummaryMetricCell key="growth" label="Growth" value="+12.4%" />,
              ]
        }
      />
    </div>
  ),
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Container for a four-slot KPI band. Use when four peer metrics should read as one unit. Avoid it for mixed content or when a single metric should dominate the section.",
      },
    },
  },
  args: {
    preset: "default",
    width: 520,
  },
  argTypes: {
    preset: {
      control: "select",
      options: ["default", "podium"],
    },
    width: {
      control: { type: "range", min: 260, max: 720, step: 10 },
    },
    slots: {
      control: false,
    },
    className: {
      control: false,
    },
  },
});

export default meta;

export const Default = meta.story({});

export const Podium = meta.story({
  args: {
    preset: "podium",
  },
});
