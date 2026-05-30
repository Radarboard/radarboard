/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DashboardStandalone } from "../standalone";
import { DashboardSkeleton } from "../../dashboard-skeleton";
import { SetupWizard } from "../../setup-wizard";
import { DashboardProvider, type DashboardStoryFixture } from "@radarboard/hooks/use-dashboard";
import { LAYOUT_RECIPES } from "@radarboard/widget-engine/layout-recipe-gallery";

type DashboardScreenState = "loading" | "setup" | "dashboard";

const ACTIVE_PROJECT_OPTIONS = ["all", "radarboard", "launchpad", "backlog"] as const;

function DashboardMainScreen({
  state,
  layoutRecipeId,
  projectMode,
  activeProjectSlug,
  pageMode,
  showDock,
  showTopBar,
  showProjectTabs,
  showPageTabs,
  showKpiStrip,
  showTicker,
}: {
  state: DashboardScreenState;
  layoutRecipeId: string;
  projectMode: DashboardStoryFixture["projectMode"];
  activeProjectSlug: (typeof ACTIVE_PROJECT_OPTIONS)[number];
  pageMode: DashboardStoryFixture["pageMode"];
  showDock: boolean;
  showTopBar: boolean;
  showProjectTabs: boolean;
  showPageTabs: boolean;
  showKpiStrip: boolean;
  showTicker: boolean;
}) {
  if (state === "loading") {
    return <DashboardSkeleton />;
  }

  if (state === "setup") {
    return <SetupWizard open onComplete={() => undefined} presentation="inline" />;
  }

  return (
    <DashboardProvider
      projects={[]}
      fixture={{
        layoutRecipeId,
        projectMode,
        activeProjectSlug: activeProjectSlug === "all" ? null : activeProjectSlug,
        pageMode,
        tickerEnabled: showTicker,
      }}
    >
      <DashboardStandalone
        showDock={showDock}
        showTopBar={showTopBar}
        showProjectTabs={showProjectTabs}
        showPageTabs={showPageTabs}
        showKpiStrip={showKpiStrip}
        showTicker={showTicker}
      />
    </DashboardProvider>
  );
}

const meta = {
  title: "Screens/Dashboard/Main",
  component: DashboardMainScreen,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    state: "dashboard" as DashboardScreenState,
    layoutRecipeId: "basic-3x3",
    projectMode: "all-projects" as DashboardStoryFixture["projectMode"],
    activeProjectSlug: "all" as (typeof ACTIVE_PROJECT_OPTIONS)[number],
    pageMode: "multiple" as DashboardStoryFixture["pageMode"],
    showDock: true,
    showTopBar: true,
    showProjectTabs: true,
    showPageTabs: true,
    showKpiStrip: true,
    showTicker: true,
  },
  argTypes: {
    state: {
      control: "inline-radio",
      options: ["loading", "setup", "dashboard"],
    },
    layoutRecipeId: {
      control: "select",
      options: LAYOUT_RECIPES.map((recipe) => recipe.id),
    },
    projectMode: {
      control: "inline-radio",
      options: ["all-projects", "single", "multiple"],
    },
    activeProjectSlug: {
      control: "inline-radio",
      options: ACTIVE_PROJECT_OPTIONS,
    },
    pageMode: {
      control: "inline-radio",
      options: ["single", "multiple"],
    },
    showDock: {
      control: "boolean",
    },
    showTopBar: {
      control: "boolean",
    },
    showProjectTabs: {
      control: "boolean",
    },
    showPageTabs: {
      control: "boolean",
    },
    showKpiStrip: {
      control: "boolean",
    },
    showTicker: {
      control: "boolean",
    },
  },
} satisfies Meta<typeof DashboardMainScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    radarboardMockScenario: "dashboard-demo",
  },
};

export const Loading: Story = {
  args: {
    state: "loading",
  },
};

export const Setup: Story = {
  args: {
    state: "setup",
  },
};

export const AllProjects: Story = {
  args: {
    state: "dashboard",
    projectMode: "all-projects",
    activeProjectSlug: "all",
  },
};

export const RailWorkbench: Story = {
  args: {
    state: "dashboard",
    layoutRecipeId: "rail-workbench",
  },
};
