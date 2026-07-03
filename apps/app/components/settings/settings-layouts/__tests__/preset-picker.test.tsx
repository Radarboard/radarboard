// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { INITIAL_ONBOARDING_STATE } from "@radarboard/feature-onboarding/types";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StepLayout } from "@/components/onboarding/step-layout";
import { LayoutPresetPicker } from "../preset-picker";

vi.mock("next/image", () => ({
  default: ({
    alt = "",
    src,
    width,
    height,
    className,
  }: {
    alt?: string;
    src: string;
    width?: number;
    height?: number;
    className?: string;
  }) => createElement("img", { alt, src, width, height, className }),
}));

vi.mock("@radarboard/integration-sdk", () => ({
  getIntegration: vi.fn((id: string) => {
    const map: Record<string, { name: string }> = {
      github: { name: "GitHub" },
      vercel: { name: "Vercel" },
      npm: { name: "npm" },
    };
    return map[id] ?? { name: id };
  }),
}));

vi.mock("@/lib/service-favicons", () => ({
  getServiceFaviconUrl: vi.fn((id: string) => `https://example.com/${id}.png`),
}));

describe("layout picker visual snapshots", () => {
  beforeEach(() => {
    Object.defineProperty(window, "screen", {
      configurable: true,
      value: {
        width: 1920,
        height: 1080,
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("matches the settings blueprint picker modal", () => {
    const { container } = render(
      <LayoutPresetPicker
        open
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
        onSelectBlueprint={vi.fn()}
        personas={["marketing"]}
        connectedIntegrations={["github"]}
      />
    );

    expect(screen.getByRole("heading", { name: "Choose a Blueprint" })).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  }, 30_000);

  it("matches the onboarding layout step on the blueprints tab", () => {
    const { container } = render(
      <StepLayout
        state={{
          ...INITIAL_ONBOARDING_STATE,
          profile: "marketing",
          connectedIntegrations: ["github"],
          blueprintId: "growth-dashboard",
        }}
        onChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    // The layout step now defaults to the Templates tab; switch to Blueprints
    // to snapshot the blueprint grid.
    fireEvent.click(screen.getByRole("button", { name: "blueprints" }));

    expect(screen.getByText("Dashboard Layout")).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  }, 30_000);

  it("keeps the user on the layout step after selecting a blueprint until Continue is clicked", async () => {
    const onChange = vi.fn();
    const onNext = vi.fn();
    render(
      <StepLayout
        state={{
          ...INITIAL_ONBOARDING_STATE,
          profile: "marketing",
          connectedIntegrations: ["github"],
          blueprintId: null,
        }}
        onChange={onChange}
        onNext={onNext}
        onBack={vi.fn()}
      />
    );

    // Blueprints live behind the Blueprints tab now (Templates is the default).
    await userEvent.click(screen.getByRole("button", { name: "blueprints" }));
    await userEvent.click(screen.getByRole("button", { name: /growth dashboard/i }));

    expect(onChange).toHaveBeenCalledWith({ blueprintId: "growth-dashboard" });
    expect(onNext).not.toHaveBeenCalled();
    expect(screen.getByText("Dashboard Layout")).toBeInTheDocument();
  }, 30_000);

  it("keeps the user on the layout step after selecting a template until Continue is clicked", async () => {
    const onChange = vi.fn();
    const onNext = vi.fn();
    render(
      <StepLayout
        state={{
          ...INITIAL_ONBOARDING_STATE,
          profile: "marketing",
          connectedIntegrations: ["github"],
          blueprintId: "growth-dashboard",
        }}
        onChange={onChange}
        onNext={onNext}
        onBack={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "templates" }));
    await userEvent.click(screen.getByRole("button", { name: /Basic 3x3/i }));

    // Templates now store the native recipe id, not the column-adapted layout id.
    expect(onChange).toHaveBeenCalledWith({ blueprintId: "template:basic-3x3" });
    expect(onNext).not.toHaveBeenCalled();
    expect(screen.getByText("Dashboard Layout")).toBeInTheDocument();
  }, 30_000);

  it("matches the onboarding layout step on the templates tab", () => {
    const { container } = render(
      <StepLayout
        state={{
          ...INITIAL_ONBOARDING_STATE,
          profile: "marketing",
          connectedIntegrations: ["github"],
          blueprintId: "growth-dashboard",
        }}
        onChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "templates" }));

    const templateGrid = screen.getByRole("button", { name: /Basic 3x3/i }).closest("div");
    expect(templateGrid).toBeTruthy();
    expect(within(container).getByRole("button", { name: /Basic 3x3/i })).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  }, 30_000);
});
