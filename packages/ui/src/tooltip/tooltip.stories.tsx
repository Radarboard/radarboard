/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import preview from "@radarboard/storybook-preview";
import { Button } from "@radarboard/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@radarboard/ui/tooltip";

const meta = preview.meta({
  title: "UI/Tooltip",
  component: Tooltip,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Prefer one **TooltipProvider** at the app shell. Radarboard uses `delayDuration={300}` (corpus suggests ~300–500ms to limit accidental hovers). Stories use `0` for instant feedback while developing.",
      },
    },
  },
});

export default meta;

export const Default = meta.story({
  render: () => (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline">Hover target</Button>
        </TooltipTrigger>
        <TooltipContent>Refreshes the current project view.</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
});
