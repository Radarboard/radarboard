/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import { fn } from "storybook/test";
import preview from "@radarboard/storybook-preview";
import { Textarea } from "@radarboard/ui/textarea";

const meta = preview.meta({
  title: "UI/Textarea",
  component: Textarea,
  parameters: {
    layout: "centered",
  },
  args: {
    placeholder: "Describe the integration setup...",
    rows: 5,
    onChange: fn(),
  },
});

export default meta;

export const Playground = meta.story({
  render: (args) => <Textarea className="w-[360px]" {...args} />,
});

export const States = meta.story({
  render: () => (
    <div className="w-[360px] space-y-3">
      <Textarea placeholder="Empty state" />
      <Textarea defaultValue="The widget should update every hour and prefer cached data." />
      <Textarea placeholder="Disabled state" disabled />
    </div>
  ),
});
