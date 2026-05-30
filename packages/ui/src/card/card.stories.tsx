/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import preview from "@radarboard/storybook-preview";
import { Badge } from "@radarboard/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@radarboard/ui/card";

const meta = preview.meta({
  title: "UI/Card",
  component: Card,
  parameters: {
    layout: "centered",
  },
});

export default meta;

export const Default = meta.story({
  render: () => (
    <Card className="w-[320px] border border-border bg-surface">
      <CardHeader className="justify-between border-border border-b">
        <CardTitle>Build pipeline</CardTitle>
        <Badge variant="success">Healthy</Badge>
      </CardHeader>
      <CardContent className="pt-3 text-foreground-secondary text-sm">
        Deployment checks passed and the latest production build is stable.
      </CardContent>
    </Card>
  ),
});
