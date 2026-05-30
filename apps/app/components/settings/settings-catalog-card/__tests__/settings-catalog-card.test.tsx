// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettingsCatalogCard } from "../index";

describe("SettingsCatalogCard", () => {
  it("keeps disabled cards readable without opacity classes", () => {
    const { container } = render(
      <SettingsCatalogCard
        enabled={false}
        title="Tasks"
        description="Track work with keyboard-first workflows."
      />
    );

    expect(screen.getByText("Tasks").className).toContain("text-foreground");
    expect(screen.getByText("Track work with keyboard-first workflows.").className).toContain(
      "text-foreground-secondary"
    );
    expect((container.firstChild as HTMLElement).className.includes("opacity-50")).toBe(false);
    expect((container.firstChild as HTMLElement).className.includes("opacity-60")).toBe(false);
    expect((container.firstChild as HTMLElement).className.includes("opacity-70")).toBe(false);
  });

  it("keeps the switch interactive without triggering the full-card action", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onToggle = vi.fn();

    render(
      <SettingsCatalogCard
        enabled
        title="Notes"
        description="Markdown-native notes."
        onOpen={onOpen}
        openAriaLabel="Configure Notes"
        checked
        onCheckedChange={onToggle}
        switchAriaLabel="Disable Notes"
      />
    );

    await user.click(screen.getByRole("switch", { name: "Disable Notes" }));

    expect(onToggle).toHaveBeenCalledWith(false);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("uses the full-card action when the card body is clicked", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();

    render(
      <SettingsCatalogCard
        enabled
        title="Bookmarks"
        description="Save and organize bookmarks."
        onOpen={onOpen}
        openAriaLabel="Configure Bookmarks"
      />
    );

    await user.click(screen.getByRole("button", { name: "Configure Bookmarks" }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("collapses optional rows when status and badges are absent", () => {
    render(
      <SettingsCatalogCard enabled title="RSS Reader" description="Track feeds and articles." />
    );

    expect(screen.queryByText("Connected")).toBeNull();
    expect(screen.queryByText("API")).toBeNull();
  });
});
