// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { logsDescriptor } from "..";

describe("logsDescriptor", () => {
  it("renders the compact empty state when no log stream is present", async () => {
    render(createElement(logsDescriptor.component, { projectSlug: null, config: {} }));

    expect(
      await screen.findByText("No logs yet. Logs appear as API routes are called.")
    ).toBeTruthy();
  });

  it("renders the expanded empty state when no log stream is present", async () => {
    const ExpandedLogsComponent = logsDescriptor.expandedComponent;
    if (!ExpandedLogsComponent) {
      throw new Error("Logs widget must provide an expanded component");
    }

    render(
      createElement(ExpandedLogsComponent, {
        projectSlug: null,
        config: {},
      })
    );

    expect(await screen.findByText("No logs match the current filters.")).toBeTruthy();
  });
});
