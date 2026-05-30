// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const MockIcon = (props: Record<string, unknown>) => <span data-testid="mock-icon" {...props} />;

vi.mock("@radarboard/plugin-sdk/registry", () => ({
  getAllPlugins: () => [
    { id: "tasks", name: "Tasks", category: "productivity", description: "Task management", icon: MockIcon },
    { id: "notes", name: "Notes", category: "productivity", description: "Note taking", icon: MockIcon },
    { id: "rss-reader", name: "RSS Reader", category: "monitoring", description: "Feed reader", icon: MockIcon },
    { id: "backup", name: "Backup", category: "data", description: "Data backup", icon: MockIcon },
    { id: "embeddings", name: "Embeddings", category: "data", description: "Vector embeddings", icon: MockIcon },
  ],
}));
import { StepComplete } from "../components/onboarding-wizard/step-complete";
import { StepDatabase } from "../components/onboarding-wizard/step-database";
import { StepPlugins } from "../components/onboarding-wizard/step-plugins";
import { StepProfile } from "../components/onboarding-wizard/step-profile";
import { StepWelcome } from "../components/onboarding-wizard/step-welcome";
import { INITIAL_ONBOARDING_STATE } from "../components/onboarding-wizard/types";

afterEach(() => cleanup());

const noop = () => {};

describe("StepWelcome", () => {
  it("renders welcome heading", () => {
    render(
      <StepWelcome state={INITIAL_ONBOARDING_STATE} onChange={noop} onNext={noop} />
    );
    expect(screen.getByText("Welcome to Radarboard")).toBeTruthy();
  });

  it("shows demo and fresh start options", () => {
    render(
      <StepWelcome state={INITIAL_ONBOARDING_STATE} onChange={noop} onNext={noop} />
    );
    expect(screen.getByText("Start with demo data")).toBeTruthy();
    expect(screen.getByText("Start fresh")).toBeTruthy();
  });

  it("calls onChange and onSkipToComplete when demo is selected", async () => {
    const onChange = vi.fn();
    const onNext = vi.fn();
    const onSkipToComplete = vi.fn();
    render(
      <StepWelcome state={INITIAL_ONBOARDING_STATE} onChange={onChange} onNext={onNext} onSkipToComplete={onSkipToComplete} />
    );
    await userEvent.click(screen.getByText("Start with demo data"));
    expect(onChange).toHaveBeenCalledWith({ demoMode: true, keepExisting: false });
    expect(onSkipToComplete).toHaveBeenCalled();
  });

  it("calls onChange and onNext when fresh start is selected", async () => {
    const onChange = vi.fn();
    const onNext = vi.fn();
    const onSkipToComplete = vi.fn();
    render(
      <StepWelcome state={INITIAL_ONBOARDING_STATE} onChange={onChange} onNext={onNext} onSkipToComplete={onSkipToComplete} />
    );
    await userEvent.click(screen.getByText("Start fresh"));
    expect(onChange).toHaveBeenCalledWith({ demoMode: false, keepExisting: false });
    expect(onNext).toHaveBeenCalled();
  });
});

describe("StepProfile", () => {
  it("renders profile groups", () => {
    render(
      <StepProfile state={INITIAL_ONBOARDING_STATE} onChange={noop} onNext={noop} onBack={noop} />
    );
    expect(screen.getAllByText("Development").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Product & Business").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Growth & Marketing").length).toBeGreaterThan(0);
  });

  it("shows profile options", () => {
    render(
      <StepProfile state={INITIAL_ONBOARDING_STATE} onChange={noop} onNext={noop} onBack={noop} />
    );
    expect(screen.getByText("Full-Stack Developer")).toBeTruthy();
    expect(screen.getByText("Indie Hacker")).toBeTruthy();
    expect(screen.getByText("SEO Specialist")).toBeTruthy();
  });

  it("calls onChange when a profile is clicked", async () => {
    const onChange = vi.fn();
    render(
      <StepProfile state={INITIAL_ONBOARDING_STATE} onChange={onChange} onNext={noop} onBack={noop} />
    );
    await userEvent.click(screen.getByText("Full-Stack Developer"));
    expect(onChange).toHaveBeenCalledWith({ profile: "fullstack" });
  });
});

describe("StepDatabase", () => {
  it("renders database provider options", () => {
    render(
      <StepDatabase state={INITIAL_ONBOARDING_STATE} onChange={noop} onNext={noop} onBack={noop} />
    );
    expect(screen.getByText("SQLite")).toBeTruthy();
  });
});

describe("StepComplete", () => {
  it("renders completion message", () => {
    render(
      <StepComplete state={INITIAL_ONBOARDING_STATE} onFinish={noop} />
    );
    expect(screen.getByText("You're all set")).toBeTruthy();
    expect(screen.getByText("Go to Dashboard")).toBeTruthy();
  });

  it("shows profile label when profile is selected", () => {
    const state = { ...INITIAL_ONBOARDING_STATE, profile: "fullstack" as const };
    render(<StepComplete state={state} onFinish={noop} />);
    expect(screen.getByText("Full-Stack Developer")).toBeTruthy();
  });

  it("shows demo mode indicator", () => {
    const state = { ...INITIAL_ONBOARDING_STATE, demoMode: true };
    render(<StepComplete state={state} onFinish={noop} />);
    expect(screen.getByText("Demo mode")).toBeTruthy();
  });

  it("shows integration count", () => {
    const state = { ...INITIAL_ONBOARDING_STATE, connectedIntegrations: ["github", "vercel"] };
    render(<StepComplete state={state} onFinish={noop} />);
    expect(screen.getByText("2 integrations")).toBeTruthy();
  });

  it("shows plugin count", () => {
    render(
      <StepComplete state={INITIAL_ONBOARDING_STATE} onFinish={noop} />
    );
    const pluginText = screen.getByText(/plugin/);
    expect(pluginText).toBeTruthy();
  });

  it("shows blueprint indicator when selected", () => {
    const state = { ...INITIAL_ONBOARDING_STATE, blueprintId: "team-velocity" };
    render(<StepComplete state={state} onFinish={noop} />);
    expect(screen.getByText("Dashboard blueprint selected")).toBeTruthy();
  });

  it("calls onFinish when button is clicked", async () => {
    const onFinish = vi.fn();
    render(<StepComplete state={INITIAL_ONBOARDING_STATE} onFinish={onFinish} />);
    await userEvent.click(screen.getByText("Go to Dashboard"));
    expect(onFinish).toHaveBeenCalled();
  });

  it("disables button and shows progress when finishing", () => {
    render(
      <StepComplete
        state={INITIAL_ONBOARDING_STATE}
        onFinish={noop}
        isFinishing
        finishProgress="Saving preferences..."
      />
    );
    expect(screen.getByText("Saving preferences...")).toBeTruthy();
    const button = screen.getByRole("button");
    expect(button.hasAttribute("disabled")).toBe(true);
  });
});

describe("StepPlugins", () => {
  it("renders plugin categories", () => {
    render(
      <StepPlugins state={INITIAL_ONBOARDING_STATE} onChange={noop} onNext={noop} onBack={noop} />
    );
    expect(screen.getByText("Productivity")).toBeTruthy();
  });

  it("shows optional plugins (not essential ones)", () => {
    render(
      <StepPlugins state={INITIAL_ONBOARDING_STATE} onChange={noop} onNext={noop} onBack={noop} />
    );
    // Tasks and Notes are optional, should be visible
    expect(screen.getByText("Tasks")).toBeTruthy();
    expect(screen.getByText("Notes")).toBeTruthy();
  });

  it("hides essential plugins (backup, embeddings)", () => {
    render(
      <StepPlugins state={INITIAL_ONBOARDING_STATE} onChange={noop} onNext={noop} onBack={noop} />
    );
    expect(screen.queryByText("Backup")).toBeNull();
    expect(screen.queryByText("Embeddings")).toBeNull();
  });

  it("calls onBack when back is clicked", async () => {
    const onBack = vi.fn();
    render(
      <StepPlugins state={INITIAL_ONBOARDING_STATE} onChange={noop} onNext={noop} onBack={onBack} />
    );
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalled();
  });
});
