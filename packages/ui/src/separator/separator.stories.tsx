/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import preview from "@radarboard/storybook-preview";
import { Separator } from "@radarboard/ui/separator";

const meta = preview.meta({
  title: "UI/Separator",
  component: Separator,
  parameters: {
    layout: "centered",
  },
});

export default meta;

export const Horizontal = meta.story({
  render: () => (
    <div className="w-[320px] space-y-3 text-foreground-secondary text-sm">
      <div>Overview</div>
      <Separator />
      <div>Deployments</div>
    </div>
  ),
});

export const Vertical = meta.story({
  render: () => (
    <div className="flex h-10 items-center gap-3 text-foreground-secondary text-sm">
      <span>Today</span>
      <Separator orientation="vertical" />
      <span>7d</span>
      <Separator orientation="vertical" />
      <span>30d</span>
    </div>
  ),
});
