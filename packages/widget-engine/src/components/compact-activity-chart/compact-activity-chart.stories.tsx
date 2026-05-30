/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import preview from "@radarboard/storybook-preview";
import { CompactActivityChart } from "@radarboard/widget-engine/compact-activity-chart";

const meta = preview.meta({
  title: "Widgets/Building Blocks/Stats/Activity Spark Bar",
  component: CompactActivityChart,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Tiny activity or health distribution chart for summary blocks. Use when trend shape matters more than exact axes. Avoid it for detailed analysis where a full chart section belongs.",
      },
    },
  },
  args: {
    buckets: [
      { id: "m", title: "Mon", values: { ok: 12, warn: 2, error: 1 } },
      { id: "t", title: "Tue", values: { ok: 15, warn: 1, error: 0 } },
      { id: "w", title: "Wed", values: { ok: 10, warn: 4, error: 2 } },
      { id: "th", title: "Thu", values: { ok: 17, warn: 1, error: 1 } },
      { id: "f", title: "Fri", values: { ok: 14, warn: 2, error: 0 } },
    ],
    segments: [
      { key: "ok", color: "#4ade80" },
      { key: "warn", color: "#facc15" },
      { key: "error", color: "#f87171" },
    ],
    heightClassName: "h-24",
  },
});

export default meta;

export const Default = meta.story({
  render: (args) => (
    <div className="w-[min(360px,calc(100vw-2rem))] border border-border bg-surface px-3 py-3">
      <CompactActivityChart {...args} />
    </div>
  ),
});

export const Compact = meta.story({
  args: {
    heightClassName: "h-16",
    minBarPercent: 4,
  },
});
