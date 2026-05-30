/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import preview from "@radarboard/storybook-preview";
import { WidgetNotConfigured } from "./index";

const defaultProviders = [
  { id: "github", name: "GitHub" },
  { id: "gitlab", name: "GitLab" },
];

const meta = preview.meta({
  title: "Widgets/Building Blocks/Feedback/Missing Integration State",
  component: WidgetNotConfigured,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Missing-integration state with a configuration CTA. Use when the widget cannot render until a required service or provider is configured. Prefer this over `Empty State` whenever user action is required to make the block functional.",
      },
    },
  },
  args: {
    serviceName: "GitHub",
    serviceId: "github",
    providers: [],
    showConnectAction: true,
    width: 420,
    height: 180,
    mode: "single-provider",
  },
  argTypes: {
    serviceName: { control: "text" },
    serviceId: { control: "text" },
    providers: { control: "object" },
    showConnectAction: { control: "boolean" },
    width: { control: { type: "range", min: 260, max: 560, step: 10 } },
    height: { control: { type: "range", min: 140, max: 280, step: 10 } },
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
  render: ({ width, height, showConnectAction, mode, serviceName, serviceId, providers }) => {
    const resolvedServiceId = mode === "settings-only" ? undefined : serviceId || "github";
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

export const ConnectSingleProvider = meta.story({
  parameters: {
    docs: {
      description: {
        story:
          "Single-provider CTA state. Use when one known service must be connected before the widget can load.",
      },
    },
  },
});

export const ConnectMultipleProviders = meta.story({
  args: {
    serviceName: "Analytics",
    mode: "multi-provider",
    providers: defaultProviders,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Multi-provider CTA state. Use when the widget can be satisfied by one of several providers and the user must choose which to connect.",
      },
    },
  },
});

export const ConfigureInSettings = meta.story({
  args: {
    serviceName: "Analytics",
    mode: "settings-only",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Settings-only CTA state. Use when there is no single provider connect action and the user must configure the integration from Settings.",
      },
    },
  },
});
