/* biome-ignore-all lint/style/noDefaultExport: Storybook preview modules require default exports. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook preview depends on Storybook/runtime-only modules declared in the Storybook app. */

import { applyThemeVariables, DEFAULT_THEME_FAMILY_ID, resolveTheme } from "@radarboard/themes";
import addonA11y from "@storybook/addon-a11y";
import addonDocs from "@storybook/addon-docs";
import { definePreview } from "@storybook/nextjs-vite";
import { useEffect } from "react";
import { StorybookAppProvider } from "../src/mocks/storybook-app-provider";
import "../src/preview.css";

function PreviewShell({
  children,
  isDocs,
  mockScenario,
  themeFamilyId,
  themeMode,
}: {
  children: React.ReactNode;
  isDocs: boolean;
  mockScenario?: "dashboard-demo";
  themeFamilyId: string;
  themeMode: "light" | "dark";
}) {
  useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(themeMode);
    applyThemeVariables(
      document.documentElement,
      resolveTheme(themeFamilyId, themeMode, themeMode)
    );
    document.body.classList.add("storybook-geist", "antialiased");

    return () => {
      document.documentElement.classList.remove("light", "dark");
      document.body.classList.remove("storybook-geist", "antialiased");
    };
  }, [themeFamilyId, themeMode]);

  return (
    <StorybookAppProvider mockScenario={mockScenario}>
      <div className={isDocs ? "w-full p-4" : "min-h-screen bg-background text-foreground"}>
        {children}
      </div>
    </StorybookAppProvider>
  );
}

const preview = definePreview({
  addons: [addonA11y(), addonDocs()],
  tags: ["autodocs"],
  globalTypes: {
    themeFamilyId: {
      description: "Theme family",
      toolbar: {
        title: "Theme",
        items: [
          { value: DEFAULT_THEME_FAMILY_ID, title: "Radarboard" },
          { value: "graphite", title: "Graphite" },
          { value: "blueprint", title: "Blueprint" },
          { value: "amber", title: "Amber" },
          { value: "editorial", title: "Editorial" },
          { value: "signal", title: "Signal" },
        ],
      },
    },
    themeMode: {
      description: "Theme mode",
      toolbar: {
        title: "Mode",
        items: [
          { value: "dark", title: "Dark" },
          { value: "light", title: "Light" },
        ],
      },
    },
  },
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    options: {
      storySort: {
        method: "alphabetical",
      },
    },
  },
  decorators: [
    (Story, context) => (
      <PreviewShell
        isDocs={context.viewMode === "docs"}
        mockScenario={context.parameters.radarboardMockScenario as "dashboard-demo" | undefined}
        themeFamilyId={
          (context.globals.themeFamilyId as string | undefined) ?? DEFAULT_THEME_FAMILY_ID
        }
        themeMode={(context.globals.themeMode as "light" | "dark" | undefined) ?? "dark"}
      >
        <Story />
      </PreviewShell>
    ),
  ],
});

export default preview;
