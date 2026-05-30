/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import type { TopPage } from "@radarboard/types/analytics";
import preview from "@radarboard/storybook-preview";
import { Dialog, DialogContent } from "@radarboard/ui/app-dialog";
import { TopPageDetail } from "@radarboard/widget-analytics/components/top-page-detail";

const page: TopPage = {
  path: "/docs/storybook",
  title: "Storybook Docs",
  sessions: 860,
  bounceRate: 28.5,
  avgDuration: 214,
  openPanelUrl: "https://example.com",
};

const meta = preview.meta({
  title: "Widgets/TopPageDetail",
  component: TopPageDetail,
  parameters: {
    layout: "centered",
  },
  args: {
    page,
  },
});

export default meta;

export const Default = meta.story({
  render: (args) => (
    <Dialog open>
      <DialogContent size="sm" className="relative top-auto left-auto translate-x-0 translate-y-0">
        <TopPageDetail {...args} />
      </DialogContent>
    </Dialog>
  ),
});
