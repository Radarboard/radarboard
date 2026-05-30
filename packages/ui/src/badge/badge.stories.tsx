/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import preview from "@radarboard/storybook-preview";
import { Badge } from "@radarboard/ui/badge";

const meta = preview.meta({
  title: "UI/Badge",
  component: Badge,
  parameters: {
    layout: "centered",
  },
  args: {
    children: "Connected",
    variant: "default",
  },
  argTypes: {
    children: { control: "text" },
    variant: {
      control: "inline-radio",
      options: ["default", "project", "success", "destructive", "warning"],
    },
    color: { control: "color" },
  },
});

export default meta;

export const Playground = meta.story({});

export const Variants = meta.story({
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>Default</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="destructive">Error</Badge>
      <Badge variant="project" color="#5b8af5">
        Project
      </Badge>
    </div>
  ),
});
