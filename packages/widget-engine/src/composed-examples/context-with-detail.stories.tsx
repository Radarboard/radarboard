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

const contextWithDetailExample = COMPOSITION_EXAMPLES.find(
  (example) => example.recipeKind === "rail_content"
);

if (!contextWithDetailExample) {
  throw new Error("Missing canonical composition example for rail_content");
}

const contextWithDetailConfig = synchronizeTemplateConfig(contextWithDetailExample.config);

const meta = preview.meta({
  title: "Widgets/Composed/Rail + Detail/Context With Detail",
  component: TemplateWidget,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Showcase composition for a metadata-rich rail beside one primary content body. Use when users need lightweight context pinned while scanning or comparing the main content area. Avoid this pattern when the supporting context is too small to justify a dedicated rail.",
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
          "Combines an overview/context rail with a scanning detail body. Building blocks involved: Overview Panel and a primary row-list content surface.",
      },
    },
  },
  render: ({ mode }) => (
    <div className="h-[360px] overflow-hidden border border-border bg-surface p-3">
      <div className="h-full overflow-hidden border border-border bg-surface-raised">
        {mode === "expanded" ? (
          <TemplateWidgetExpanded
            widgetId="composed-example:context-with-detail"
            projectSlug={null}
            config={contextWithDetailConfig}
          />
        ) : (
          <TemplateWidget
            widgetId="composed-example:context-with-detail"
            projectSlug={null}
            config={contextWithDetailConfig}
          />
        )}
      </div>
    </div>
  ),
});
