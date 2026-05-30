/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import { ChartColumn, LayoutPanelTop } from "lucide-react";
import { useState } from "react";
import preview from "@radarboard/storybook-preview";
import { WidgetSegmentedTabs } from "@radarboard/widget-engine/widget-segmented-tabs";

const tabItems = [
  { id: "summary", label: "Summary", icon: <LayoutPanelTop className="icon-xs" /> },
  { id: "chart", label: "Chart", icon: <ChartColumn className="icon-xs" />, count: 12 },
  { id: "alerts", label: "Alerts", count: 3, accentColor: "#e05555" },
];

const meta = preview.meta({
  title: "Widgets/Building Blocks/Navigation/Segmented Tabs",
  component: WidgetSegmentedTabs,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Compact mode switcher for mutually exclusive views inside the same widget. Use when the user is switching between equivalent content modes. Avoid it for navigation across unrelated destinations.",
      },
    },
  },
  args: {
    value: "summary",
    variant: "expanded",
    items: tabItems,
  },
  argTypes: {
    value: {
      control: "select",
      options: ["summary", "chart", "alerts"],
    },
    variant: {
      control: "inline-radio",
      options: ["compact", "expanded"],
    },
    items: {
      control: "object",
    },
    onValueChange: {
      control: false,
    },
    className: {
      control: false,
    },
  },
});

export default meta;

function DefaultRender(args: Parameters<typeof WidgetSegmentedTabs>[0]) {
  const [value, setValue] = useState(args.value);

  return (
    <div className="w-[min(var(--spacing-panel),calc(100vw-2rem))] border border-border bg-surface">
      <WidgetSegmentedTabs {...args} value={value} onValueChange={setValue} />
    </div>
  );
}

export const Default = meta.story({
  render: DefaultRender,
});

export const Compact = meta.story({
  args: {
    variant: "compact",
  },
});
