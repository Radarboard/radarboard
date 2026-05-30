/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import preview from "@radarboard/storybook-preview";
import {
  COMPOSITION_EXAMPLES,
  synchronizeTemplateConfig,
  TemplateWidget,
  TemplateWidgetExpanded,
} from "@radarboard/widget-engine/templates";
import "@radarboard/widget-engine/templates/example-data-sources";

const trafficOverviewExample = COMPOSITION_EXAMPLES.find(
  (example) => example.recipeKind === "summary_list"
);

if (!trafficOverviewExample) {
  throw new Error("Missing canonical composition example for summary_list");
}

const trafficOverviewConfig = synchronizeTemplateConfig(trafficOverviewExample.config);

const meta = preview.meta({
  title: "Widgets/Composed/KPI + List/Traffic Overview",
  component: TemplateWidget,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Showcase composition for a compact KPI band paired with one primary ranked list. Use when one top-line metric view should lead into a scan-heavy list, such as traffic, pages, queues, or issue leaders. Avoid this pattern when chart interpretation is as important as list scanning or when the context needs a dedicated rail.",
      },
    },
  },
  args: {
    mode: "compact",
  },
  argTypes: {
    mode: {
      control: "inline-radio",
      options: ["compact", "expanded"],
    },
  },
});

export default meta;

export const Default = meta.story({
  parameters: {
    docs: {
      description: {
        story:
          "Combines a live metric header, a small KPI summary, and one primary list body. Building blocks involved: Live Metric, Metric Grid, and Inline Row List/List surface.",
      },
    },
  },
  render: ({ mode }) => (
    <div className="h-[360px] overflow-hidden border border-border bg-surface p-3">
      <div className="h-full overflow-hidden border border-border bg-surface-raised">
        {mode === "expanded" ? (
          <TemplateWidgetExpanded
            widgetId="composed-example:traffic-overview"
            projectSlug={null}
            config={trafficOverviewConfig}
          />
        ) : (
          <TemplateWidget
            widgetId="composed-example:traffic-overview"
            projectSlug={null}
            config={trafficOverviewConfig}
          />
        )}
      </div>
    </div>
  ),
});
