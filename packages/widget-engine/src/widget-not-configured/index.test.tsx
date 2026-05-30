// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WidgetNotConfigured } from "./index";

afterEach(cleanup);

describe("WidgetNotConfigured", () => {
  it("renders service name and connect button when onConnect is provided", () => {
    const onConnect = vi.fn();
    render(
      <WidgetNotConfigured serviceName="RevenueCat" serviceId="revenuecat" onConnect={onConnect} />
    );
    expect(screen.getByText("RevenueCat not connected")).toBeDefined();
    expect(screen.getByRole("button", { name: /connect revenuecat/i })).toBeDefined();
  });

  it("calls onConnect with serviceId when button is clicked", async () => {
    const onConnect = vi.fn();
    render(<WidgetNotConfigured serviceName="GitHub" serviceId="github" onConnect={onConnect} />);
    await userEvent.click(screen.getByRole("button", { name: /connect github/i }));
    expect(onConnect).toHaveBeenCalledWith("github");
  });

  it("hides button when onConnect is not provided", () => {
    render(<WidgetNotConfigured serviceName="Sentry" serviceId="sentry" />);
    expect(screen.getByText("Sentry not connected")).toBeDefined();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows 'Configure in Settings' when serviceId is omitted", async () => {
    const onConnect = vi.fn();
    render(<WidgetNotConfigured serviceName="Analytics" onConnect={onConnect} />);
    expect(screen.getByText("Analytics not connected")).toBeDefined();
    const button = screen.getByRole("button", { name: /configure in settings/i });
    expect(button).toBeDefined();
    await userEvent.click(button);
    expect(onConnect).toHaveBeenCalledWith("");
  });

  it("renders multiple service names for multi-provider widgets", () => {
    const onConnect = vi.fn();
    render(
      <WidgetNotConfigured
        serviceName="Analytics"
        serviceId="openpanel"
        onConnect={onConnect}
        providers={[
          { id: "openpanel", name: "OpenPanel" },
          { id: "umami", name: "Umami" },
        ]}
      />
    );
    expect(screen.getByText("Analytics not connected")).toBeDefined();
    expect(screen.getByRole("button", { name: /connect openpanel/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /connect umami/i })).toBeDefined();
  });

  it("supports a custom setup message and action label", async () => {
    const onConnect = vi.fn();
    render(
      <WidgetNotConfigured
        serviceName="Analytics"
        serviceId="intent:openpanel-project"
        message="OpenPanel is connected, but no project is linked yet."
        actionLabel="Open Project Settings"
        onConnect={onConnect}
      />
    );
    expect(screen.getByText("OpenPanel is connected, but no project is linked yet.")).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Open Project Settings" }));
    expect(onConnect).toHaveBeenCalledWith("intent:openpanel-project");
  });
});
