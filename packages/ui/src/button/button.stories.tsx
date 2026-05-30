/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import { fn } from "storybook/test";
import preview from "@radarboard/storybook-preview";
import { Button } from "@radarboard/ui/button";

const meta = preview.meta({
  title: "UI/Button",
  component: Button,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Icon-only sizes (`icon`, `icon-sm`, `icon-xs`) must set **aria-label**. `icon-sm` / `icon-xs` map to icon slot dimensions (`icon-lg` / `icon-base`), not text size.",
      },
    },
  },
  args: {
    children: "Save changes",
    variant: "default",
    size: "default",
    disabled: false,
    asChild: false,
    onClick: fn(),
  },
  argTypes: {
    children: {
      control: "text",
    },
    variant: {
      control: "inline-radio",
      options: ["default", "outline", "ghost", "active"],
    },
    size: {
      control: "inline-radio",
      options: ["default", "sm", "icon"],
    },
    asChild: {
      control: "boolean",
    },
  },
});

export default meta;

export const Playground = meta.story({
  render: (args) =>
    args.asChild ? (
      <Button {...args}>
        <a href="https://example.com">Open link</a>
      </Button>
    ) : (
      <Button {...args} />
    ),
});

export const Variants = meta.story({
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="default">Default</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="active">Active</Button>
    </div>
  ),
});

export const Sizes = meta.story({
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="icon" aria-label="Settings">
        +
      </Button>
    </div>
  ),
});

export const Disabled = meta.story({
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled>Disabled</Button>
      <Button variant="outline" disabled>
        Disabled outline
      </Button>
      <Button variant="ghost" disabled>
        Disabled ghost
      </Button>
    </div>
  ),
});

export const AsChildLink = meta.story({
  render: () => (
    <Button asChild>
      <a href="https://example.com">Open docs</a>
    </Button>
  ),
});
