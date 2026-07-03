// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ALL_PROJECTS_SLUG } from "@radarboard/types/dashboard";
import { LAYOUT_RECIPES } from "@radarboard/widget-engine/layout-recipe-gallery";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingWizard } from "../components/onboarding-wizard";
import { INITIAL_ONBOARDING_STATE } from "../components/onboarding-wizard/types";

const replaceWidgetLayoutConfig = vi.fn();
const setStepParam = vi.fn();
const mockFetch = vi.fn();

vi.mock("@radarboard/hooks/use-dashboard", () => ({
  useDashboard: () => ({
    preferences: {},
    layouts: [],
    projectLayouts: {},
    widgetConfigs: {},
    modalPrefs: {},
    appearance: {},
    replaceWidgetLayoutConfig,
  }),
}));

vi.mock("nuqs", () => ({
  parseAsInteger: {},
  useQueryState: () => [7, setStepParam],
}));

vi.mock("@radarboard/plugin-sdk/registry", () => ({
  getAllPlugins: () => [
    { id: "backup" },
    { id: "embeddings" },
    { id: "notes" },
    { id: "tasks" },
  ],
}));

vi.mock("@radarboard/plugin-sdk/host", () => ({
  getPluginToken: vi.fn(async () => "system-token"),
}));

vi.stubGlobal("fetch", mockFetch);

const StepIntegrations = () => null;
const StepLayout = () => null;

function renderWizard(onComplete = vi.fn()) {
  return {
    onComplete,
    user: userEvent.setup(),
    ...render(
      <OnboardingWizard
        mode="returning"
        open
        onComplete={onComplete}
        StepIntegrations={StepIntegrations}
        StepLayout={StepLayout}
      />
    ),
  };
}

describe("OnboardingWizard plugin activation", () => {
  beforeEach(() => {
    sessionStorage.clear();
    replaceWidgetLayoutConfig.mockReset();
    setStepParam.mockReset();
    mockFetch.mockReset();
    sessionStorage.setItem(
      "radarboard-onboarding-state",
      JSON.stringify({
        ...INITIAL_ONBOARDING_STATE,
        restoredFromBackup: true,
        enabledPlugins: ["notes"],
      })
    );
    sessionStorage.setItem("radarboard-onboarding-completed-steps", JSON.stringify([1, 2, 4, 5, 6]));
  });

  it("persists disabled plugins before completing onboarding", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
    const { user, onComplete } = renderWizard();

    await user.click(screen.getByRole("button", { name: "Go to Dashboard" }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/plugins/data",
        expect.objectContaining({
          method: "PUT",
          headers: expect.objectContaining({ "X-Plugin-Token": "system-token" }),
          body: JSON.stringify({
            pluginId: "_system",
            key: "disabled-plugins",
            value: JSON.stringify(["tasks"]),
          }),
        })
      );
    });

    await waitFor(() => {
      expect(replaceWidgetLayoutConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          preferences: expect.objectContaining({ onboardingCompleted: true }),
        })
      );
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  it("blocks completion and shows a retryable error when plugin activation fails", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: "boom" }) });
    const { user, onComplete } = renderWizard();

    await user.click(screen.getByRole("button", { name: "Go to Dashboard" }));

    await waitFor(() => {
      expect(onComplete).not.toHaveBeenCalled();
    });

    expect(replaceWidgetLayoutConfig).not.toHaveBeenCalled();
    expect(
      screen.getByText("We couldn't activate your selected plugins. Please try again.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

describe("OnboardingWizard layout application", () => {
  beforeEach(() => {
    sessionStorage.clear();
    replaceWidgetLayoutConfig.mockReset();
    setStepParam.mockReset();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
    sessionStorage.setItem("radarboard-onboarding-completed-steps", JSON.stringify([1, 2, 4, 5, 6]));
  });

  it("applies a selected template as an empty grid (no blueprint widgets)", async () => {
    sessionStorage.setItem(
      "radarboard-onboarding-state",
      JSON.stringify({
        ...INITIAL_ONBOARDING_STATE,
        restoredFromBackup: false,
        blueprintId: "template:basic-3x3",
        enabledPlugins: ["notes"],
      })
    );
    const { user } = renderWizard();

    await user.click(screen.getByRole("button", { name: "Go to Dashboard" }));

    await waitFor(() => {
      expect(replaceWidgetLayoutConfig).toHaveBeenCalled();
    });

    // Start fresh wipes any previously seeded demo/cached data first.
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/demo/wipe"),
      expect.objectContaining({ method: "POST" })
    );

    const config = replaceWidgetLayoutConfig.mock.calls.at(-1)?.[0];
    const recipe = LAYOUT_RECIPES.find((r) => r.id === "basic-3x3");

    // One layout, matching the template's cell structure, with a fresh id.
    expect(config.layouts).toHaveLength(1);
    const appliedLayout = config.layouts[0];
    expect(appliedLayout.cells).toHaveLength(recipe?.layout.cells.length ?? 0);

    // Wired into the All Projects overview page with NO widgets assigned.
    const page = config.projectLayouts[ALL_PROJECTS_SLUG].pages[0];
    expect(page.layoutId).toBe(appliedLayout.id);
    expect(page.widgetLayouts[appliedLayout.id]).toEqual({});

    // Templates are empty grids — the widget map is cleared so stale widgets
    // from a prior demo/blueprint run don't repopulate the cells.
    expect(config.preferences.blueprintWidgetMap).toEqual({});
  });
});
