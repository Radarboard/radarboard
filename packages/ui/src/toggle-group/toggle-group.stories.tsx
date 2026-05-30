/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import preview from "@radarboard/storybook-preview";
import { ToggleGroup, ToggleGroupItem } from "@radarboard/ui/toggle-group";

const meta = preview.meta({
  title: "UI/ToggleGroup",
  component: ToggleGroup,
  parameters: {
    layout: "centered",
  },
});

export default meta;

export const Single = meta.story({
  render: () => (
    <ToggleGroup type="single" defaultValue="7d">
      <ToggleGroupItem value="24h">24h</ToggleGroupItem>
      <ToggleGroupItem value="7d">7d</ToggleGroupItem>
      <ToggleGroupItem value="30d">30d</ToggleGroupItem>
    </ToggleGroup>
  ),
});
