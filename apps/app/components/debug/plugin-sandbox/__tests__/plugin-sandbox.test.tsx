// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { PluginSandbox } from "../index";

vi.mock("@/lib/plugins-init", () => ({}));

vi.mock("@radarboard/plugin-sdk/registry", () => ({
  getAllPlugins: () => [
    {
      id: "test-plugin",
      name: "Test Plugin",
      description: "A test plugin.",
      version: "1.0.0",
      category: "productivity",
      presentation: "side-panel",
      component: () => createElement("div", null, "Plugin body"),
    },
  ],
}));

vi.mock("@radarboard/plugin-sdk/testing", () => ({
  createMockPluginAPI: () => ({}),
}));

describe("PluginSandbox", () => {
  it("renders registered plugins from the runtime registry", () => {
    render(createElement(PluginSandbox));

    expect(screen.getByText("All plugins (1)")).toBeTruthy();
    expect(screen.getAllByText("Test Plugin")).toHaveLength(2);
  });
});
