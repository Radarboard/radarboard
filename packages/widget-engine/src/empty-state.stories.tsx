/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import preview from "@radarboard/storybook-preview";
import { EmptyState } from "@radarboard/ui/empty-state";

const meta = preview.meta({
  title: "Widgets/Building Blocks/Feedback/Empty State",
  component: EmptyState,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Generic no-data or no-result fallback. Use when a block is healthy but has nothing to show. Do not use it for missing integrations or setup problems that need a dedicated configuration CTA; use `Missing Integration State` for those.",
      },
    },
  },
  args: {
    message: "No recent activity",
    subMessage: "",
    variant: "compact",
    height: 180,
    width: 420,
  },
  argTypes: {
    message: { control: "text" },
    subMessage: { control: "text" },
    variant: { control: "inline-radio", options: ["default", "compact"] },
    height: { control: { type: "range", min: 120, max: 320, step: 10 } },
    width: { control: { type: "range", min: 240, max: 560, step: 10 } },
    icon: { control: false },
    title: { control: false },
    action: { control: false },
    className: { control: false },
  },
});

export default meta;

export const Default = meta.story({
  render: ({ height, width, subMessage, ...args }) => (
    <div
      className="border border-border bg-surface"
      style={{ height: `${height}px`, width: `min(${width}px, calc(100vw - 2rem))` }}
    >
      <EmptyState {...args} subMessage={subMessage || undefined} />
    </div>
  ),
});

export const NoDataWithContext = meta.story({
  args: {
    message: "Revenue data unavailable",
    subMessage: "Try another date range or wait for fresh sync data.",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Use when the widget is valid but needs a little more context about why there is currently nothing to show. Avoid using this state for integration setup or account connection issues.",
      },
    },
  },
});
