/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import preview from "@radarboard/storybook-preview";
import { ScrollArea } from "@radarboard/ui/scroll-area";

const meta = preview.meta({
  title: "UI/ScrollArea",
  component: ScrollArea,
  parameters: {
    layout: "centered",
  },
});

export default meta;

export const Default = meta.story({
  render: () => (
    <ScrollArea className="h-[220px] w-[320px] border border-border bg-surface p-3">
      <div className="space-y-2 pr-4">
        {Array.from({ length: 14 }, (_, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: story mock
            key={`item-${index}`}
            className="border border-border bg-surface-raised px-3 py-2 text-sm"
          >
            Activity item {index + 1}
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
});
