/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import { fn } from "storybook/test";
import preview from "@radarboard/storybook-preview";
import { Switch } from "./switch";

const meta = preview.meta({
  title: "UI/Switch",
  component: Switch,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Binary toggle for compact on/off states. Use when the setting should take effect immediately. Prefer checkbox groups when multiple selections are possible.",
      },
    },
  },
  args: {
    checked: false,
    disabled: false,
    variant: "default",
    size: "default",
    onCheckedChange: fn(),
  },
  argTypes: {
    checked: {
      control: "boolean",
    },
    disabled: {
      control: "boolean",
    },
    variant: {
      control: "inline-radio",
      options: ["default", "success"],
    },
    size: {
      control: "inline-radio",
      options: ["default", "sm"],
    },
    defaultChecked: {
      control: false,
    },
    asChild: {
      control: false,
    },
    className: {
      control: false,
    },
    name: {
      control: false,
    },
    value: {
      control: false,
    },
    required: {
      control: false,
    },
    form: {
      control: false,
    },
  },
});

export default meta;

export const Playground = meta.story({
  render: (args) => <Switch {...args} />,
});

export const Variants = meta.story({
  render: () => (
    <>
      <Switch checked={false} variant="default" onCheckedChange={() => undefined} />
      <Switch checked variant="default" onCheckedChange={() => undefined} />
      <Switch checked variant="success" onCheckedChange={() => undefined} />
    </>
  ),
});

export const Sizes = meta.story({
  render: () => (
    <>
      <Switch checked={false} size="sm" onCheckedChange={() => undefined} />
      <Switch checked={false} size="default" onCheckedChange={() => undefined} />
    </>
  ),
});

export const Disabled = meta.story({
  render: () => (
    <>
      <Switch checked={false} disabled onCheckedChange={() => undefined} />
      <Switch checked disabled variant="success" onCheckedChange={() => undefined} />
    </>
  ),
});
