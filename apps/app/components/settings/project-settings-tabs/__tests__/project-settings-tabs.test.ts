// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { PROJECT_SETTINGS_TAB_STORAGE_KEY } from "../../settings-storage";
import { ProjectSettingsTabs } from "../";

function renderTabs() {
  return render(
    createElement(ProjectSettingsTabs, {
      dashboardPageCount: 2,
      platformCount: 1,
      overviewContent: createElement("div", {}, "Overview content"),
      dashboardContent: createElement("div", {}, "Dashboard content"),
      platformsContent: createElement("div", {}, "Platforms content"),
    })
  );
}

describe("ProjectSettingsTabs", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to the Overview tab", () => {
    renderTabs();

    expect(screen.getByText("Overview content")).toBeTruthy();
    expect(screen.queryByText("Dashboard content")).toBeNull();
    expect(screen.getByRole("button", { name: "Overview" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
  });

  it("switches tabs and shows count badges", () => {
    renderTabs();

    expect(screen.getByRole("button", { name: /Dashboard/ }).textContent).toContain("2");
    expect(screen.getByRole("button", { name: /Platforms/ }).textContent).toContain("1");

    fireEvent.click(screen.getByRole("button", { name: /Dashboard/ }));
    expect(screen.getByText("Dashboard content")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Platforms/ }));
    expect(screen.getByText("Platforms content")).toBeTruthy();
  });

  it("restores and persists the active tab in localStorage", async () => {
    localStorage.setItem(PROJECT_SETTINGS_TAB_STORAGE_KEY, "platforms");

    renderTabs();

    expect(screen.getByText("Platforms content")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Dashboard/ }));

    await waitFor(() => {
      expect(localStorage.getItem(PROJECT_SETTINGS_TAB_STORAGE_KEY)).toBe("dashboard");
    });
  });
});
