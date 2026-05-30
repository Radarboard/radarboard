/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import preview from "@radarboard/storybook-preview";
import { Input } from "@radarboard/ui/input";
import { Label } from "@radarboard/ui/label";

const meta = preview.meta({
  title: "UI/Label",
  component: Label,
  parameters: {
    layout: "centered",
  },
  args: {
    children: "Project name",
  },
});

export default meta;

export const Default = meta.story({});

export const WithField = meta.story({
  render: () => (
    <div className="w-sidebar">
      <Label htmlFor="project-name">Project name</Label>
      <Input id="project-name" defaultValue="Radarboard" />
    </div>
  ),
});
