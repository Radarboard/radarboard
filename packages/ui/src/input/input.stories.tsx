/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import { fn } from "storybook/test";
import preview from "@radarboard/storybook-preview";
import { Input } from "@radarboard/ui/input";

const meta = preview.meta({
  title: "UI/Input",
  component: Input,
  parameters: {
    layout: "centered",
  },
  args: {
    placeholder: "Project name",
    onChange: fn(),
  },
  argTypes: {
    placeholder: { control: "text" },
    disabled: { control: "boolean" },
    type: {
      control: "select",
      options: ["text", "email", "password", "url", "search"],
    },
  },
});

export default meta;

export const Playground = meta.story({
  args: {
    type: "text",
  },
});

export const States = meta.story({
  render: () => (
    <div className="w-[320px] space-y-3">
      <Input placeholder="Default input" />
      <Input defaultValue="radarboard" />
      <Input placeholder="Disabled input" disabled />
      <Input type="search" placeholder="Search widgets" />
    </div>
  ),
});
