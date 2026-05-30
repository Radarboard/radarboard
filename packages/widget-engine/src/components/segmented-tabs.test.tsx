// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { CircleDot, GitPullRequest } from "lucide-react";
import { createElement, useState } from "react";
import { describe, expect, it } from "vitest";
import { WidgetSegmentedTabs } from "./widget-segmented-tabs";

function SegmentedTabsHarness({ variant }: { variant: "compact" | "expanded" }) {
  const [value, setValue] = useState("prs");

  return createElement(WidgetSegmentedTabs, {
    value,
    onValueChange: setValue,
    variant,
    items: [
      {
        id: "prs",
        label: variant === "compact" ? "PRs" : "Pull Requests",
        icon: createElement(GitPullRequest, {
          className: variant === "compact" ? "icon-xs" : "icon-xs",
        }),
        count: 12,
        accentColor: "#5b8af5",
      },
      {
        id: "issues",
        label: "Issues",
        icon: createElement(CircleDot, {
          className: variant === "compact" ? "icon-xs" : "icon-xs",
        }),
        count: 7,
        accentColor: "#3fb950",
      },
    ],
  });
}

describe("WidgetSegmentedTabs", () => {
  it("switches tabs and preserves accent styling", () => {
    render(createElement(SegmentedTabsHarness, { variant: "compact" }));

    const prsTab = screen.getByRole("tab", { name: /PRs/i });
    expect(prsTab.getAttribute("data-state")).toBe("active");
    expect(prsTab.getAttribute("style")).toContain("91, 138, 245");

    fireEvent.click(screen.getByRole("tab", { name: /Issues/i }));

    const issuesTab = screen.getByRole("tab", { name: /Issues/i });
    expect(issuesTab.getAttribute("data-state")).toBe("active");
    expect(issuesTab.getAttribute("style")).toContain("63, 185, 80");
  });

  it("renders the expanded density variant", () => {
    render(createElement(SegmentedTabsHarness, { variant: "expanded" }));

    expect(screen.getByRole("tab", { name: /Pull Requests/i }).className).toContain("text-w-base");
  });
});
