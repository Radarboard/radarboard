/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import preview from "@radarboard/storybook-preview";
import { Badge } from "@radarboard/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@radarboard/ui/card";
import { SkeletonShimmer } from "@radarboard/ui/skeleton-shimmer";

const meta = preview.meta({
  title: "UI/SkeletonShimmer",
  component: SkeletonShimmer,
  parameters: {
    layout: "centered",
  },
  args: {
    loading: true,
  },
});

export default meta;

export const Playground = meta.story({
  render: (args) => (
    <div className="w-[320px]">
      <SkeletonShimmer {...args}>
        <Card className="border border-border bg-surface">
          <CardHeader className="justify-between border-border border-b">
            <CardTitle>Knowledge health</CardTitle>
            <Badge variant="warning">Needs review</Badge>
          </CardHeader>
          <CardContent className="space-y-2 pt-3 text-foreground-secondary text-sm">
            <div>14 stale documents detected</div>
            <div>3 missing release notes links</div>
          </CardContent>
        </Card>
      </SkeletonShimmer>
    </div>
  ),
});
