/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import preview from "@radarboard/storybook-preview";
import { WidgetNotConfigured } from "../widget-not-configured";

const defaultProviders = [
  { id: "github", name: "GitHub" },
  { id: "gitlab", name: "GitLab" },
];

const meta = preview.meta({
  title: "Widgets/Composed/Feedback/Unavailable State",
  component: WidgetNotConfigured,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Showcase composition for a widget-level unavailable state that requires setup before the surface can render. Use when the widget is structurally valid but blocked on configuration, integration connection, or provider selection. Avoid this pattern for simple no-data results where the system is healthy and there is nothing actionable to configure.",
      },
    },
  },
  args: {
    serviceName: "Sentry",
    serviceId: "sentry",
    providers: [],
    showConnectAction: true,
    width: 420,
    height: 200,
    mode: "single-provider",
  },
  argTypes: {
    serviceName: { control: "text" },
    serviceId: { control: "text" },
    providers: { control: "object" },
    showConnectAction: { control: "boolean" },
    width: { control: { type: "range", min: 260, max: 560, step: 10 } },
    height: { control: { type: "range", min: 140, max: 300, step: 10 } },
    mode: {
      control: "inline-radio",
      options: ["single-provider", "multi-provider", "settings-only"],
    },
    onConnect: { control: false },
    className: { control: false },
  },
});

export default meta;

export const Default = meta.story({
  parameters: {
    docs: {
      description: {
        story:
          "Combines icon, status message, and a task-oriented CTA as one widget-level feedback surface. Building blocks involved: missing-integration feedback, button CTA, and centered empty shell treatment.",
      },
    },
  },
  render: ({ width, height, showConnectAction, mode, serviceName, serviceId, providers }) => {
    const resolvedServiceId = mode === "settings-only" ? undefined : serviceId || "sentry";
    const resolvedProviders = mode === "multi-provider" ? providers || defaultProviders : undefined;

    return (
      <div
        className="border border-border bg-surface"
        style={{ width: `min(${width}px, calc(100vw - 2rem))`, height: `${height}px` }}
      >
        <WidgetNotConfigured
          serviceName={serviceName}
          serviceId={resolvedServiceId}
          providers={resolvedProviders}
          onConnect={showConnectAction ? () => undefined : undefined}
        />
      </div>
    );
  },
});
