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

const contentOnlyExample = COMPOSITION_EXAMPLES.find(
  (example) => example.recipeKind === "content_only"
);

if (!contentOnlyExample) {
  throw new Error("Missing canonical composition example for content_only");
}

const contentOnlyConfig = synchronizeTemplateConfig(contentOnlyExample.config);

const meta = preview.meta({
  title: "Widgets/Recipe Examples/Content Only",
  parameters: {
    layout: "fullscreen",
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
  render: ({ mode }) => (
    <div className="h-[360px] overflow-hidden border border-border bg-surface p-3">
      <div className="h-full overflow-hidden border border-border bg-surface-raised">
        {mode === "expanded" ? (
          <TemplateWidgetExpanded
            widgetId="story:content-only"
            projectSlug={null}
            config={contentOnlyConfig}
          />
        ) : (
          <TemplateWidget
            widgetId="story:content-only"
            projectSlug={null}
            config={contentOnlyConfig}
          />
        )}
      </div>
    </div>
  ),
});
