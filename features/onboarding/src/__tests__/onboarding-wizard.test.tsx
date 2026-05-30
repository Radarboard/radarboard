// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
