// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tabs, TabsList, TabsTrigger } from "./";

describe("Tabs", () => {
  it("resets trigger button chrome so browser defaults do not bleed through", () => {
    render(
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
      </Tabs>
    );

    const overviewTab = screen.getByRole("tab", { name: "Overview" });

    expect(overviewTab.className).toContain("appearance-none");
    expect(overviewTab.className).toContain("rounded-none");
    expect(overviewTab.className).toContain("bg-surface");
  });
});
