/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DebugDashboard } from "../dashboard";
import { IntegrationSandbox } from "../integration-sandbox";
import { PluginSandbox } from "../plugin-sandbox";
import { WidgetCompositionGallery } from "../widget-composition-gallery";
import { WidgetSandbox } from "../widget-sandbox";

type DebugScreenRoute =
  | "landing"
  | "widget-sandbox"
  | "plugin-sandbox"
  | "integration-sandbox"
  | "widget-composition";

function DebugScreen({ route }: { route: DebugScreenRoute }) {
  switch (route) {
    case "widget-sandbox":
      return <WidgetSandbox />;
    case "plugin-sandbox":
      return <PluginSandbox />;
    case "integration-sandbox":
      return <IntegrationSandbox />;
    case "widget-composition":
      return <WidgetCompositionGallery />;
    default:
      return <DebugDashboard />;
  }
}

const meta = {
  title: "Screens/Debug",
  component: DebugScreen,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    route: "landing" as DebugScreenRoute,
  },
  argTypes: {
    route: {
      control: "inline-radio",
      options: [
        "landing",
        "widget-sandbox",
        "plugin-sandbox",
        "integration-sandbox",
        "widget-composition",
      ],
    },
  },
} satisfies Meta<typeof DebugScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Landing: Story = {
  args: {
    route: "landing",
  },
};

export const WidgetSandboxScreen: Story = {
  name: "Widget Sandbox",
  args: {
    route: "widget-sandbox",
  },
};

export const PluginSandboxScreen: Story = {
  name: "Plugin Sandbox",
  args: {
    route: "plugin-sandbox",
  },
};

export const IntegrationSandboxScreen: Story = {
  name: "Integration Sandbox",
  args: {
    route: "integration-sandbox",
  },
};

export const WidgetCompositionScreen: Story = {
  name: "Widget Composition",
  args: {
    route: "widget-composition",
  },
};
