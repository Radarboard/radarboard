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

const trendWithLeadersExample = COMPOSITION_EXAMPLES.find(
  (example) => example.recipeKind === "summary_chart_list"
);

if (!trendWithLeadersExample) {
  throw new Error("Missing canonical composition example for summary_chart_list");
}

const trendWithLeadersConfig = synchronizeTemplateConfig(trendWithLeadersExample.config);

const meta = preview.meta({
  title: "Widgets/Composed/Chart + Ranking/Trend With Leaders",
  component: TemplateWidget,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Showcase composition for a trend view paired with a ranked companion list. Use when users need both trend shape and leader context in one glance, such as traffic drivers, top errors, or top-performing pages. Avoid this pattern when the chart is secondary or when the list alone answers the task.",
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
          "Combines a summary band, one chart surface, and one ranked list surface. Building blocks involved: Live Metric, chart section, and list/ranking body.",
      },
    },
  },
  render: ({ mode }) => (
    <div className="h-[360px] overflow-hidden border border-border bg-surface p-3">
      <div className="h-full overflow-hidden border border-border bg-surface-raised">
        {mode === "expanded" ? (
          <TemplateWidgetExpanded
            widgetId="composed-example:trend-with-leaders"
            projectSlug={null}
            config={trendWithLeadersConfig}
          />
        ) : (
          <TemplateWidget
            widgetId="composed-example:trend-with-leaders"
            projectSlug={null}
            config={trendWithLeadersConfig}
          />
        )}
      </div>
    </div>
  ),
});
