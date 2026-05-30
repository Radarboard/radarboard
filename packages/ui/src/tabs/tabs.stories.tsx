/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import preview from "@radarboard/storybook-preview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@radarboard/ui/tabs";

const meta = preview.meta({
  title: "UI/Tabs",
  component: Tabs,
  parameters: {
    layout: "centered",
  },
});

export default meta;

export const Playground = meta.story({
  render: () => (
    <div className="w-[min(var(--spacing-panel),calc(100vw-2rem))]">
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="p-4 text-foreground-secondary text-sm">
          Overview panel content
        </TabsContent>
        <TabsContent value="activity" className="p-4 text-foreground-secondary text-sm">
          Activity panel content
        </TabsContent>
        <TabsContent value="settings" className="p-4 text-foreground-secondary text-sm">
          Settings panel content
        </TabsContent>
      </Tabs>
    </div>
  ),
});

export const Underline = meta.story({
  render: () => (
    <div className="w-[min(var(--spacing-panel),calc(100vw-2rem))] border-border border-b">
      <Tabs defaultValue="overview">
        <TabsList variant="underline">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="p-4 text-foreground-secondary text-sm">
          Overview panel content
        </TabsContent>
        <TabsContent value="activity" className="p-4 text-foreground-secondary text-sm">
          Activity panel content
        </TabsContent>
        <TabsContent value="settings" className="p-4 text-foreground-secondary text-sm">
          Settings panel content
        </TabsContent>
      </Tabs>
    </div>
  ),
});
