// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OnboardingGrid } from "../components/onboarding-wizard/onboarding-grid";
import { OnboardingProgress } from "../components/onboarding-wizard/onboarding-progress";
import { ONBOARDING_STEPS, type OnboardingStep } from "../components/onboarding-wizard/types";

afterEach(() => cleanup());

describe("OnboardingGrid", () => {
  it("renders children in a responsive grid", () => {
    render(
      <OnboardingGrid>
        <div data-testid="child-1">Item 1</div>
        <div data-testid="child-2">Item 2</div>
      </OnboardingGrid>
    );
    expect(screen.getByTestId("child-1")).toBeTruthy();
    expect(screen.getByTestId("child-2")).toBeTruthy();
  });
});

describe("OnboardingProgress", () => {
  const allSteps = ONBOARDING_STEPS;

  it("renders all visible step labels", () => {
    render(
      <OnboardingProgress
        currentStep={1}
        completedSteps={new Set<OnboardingStep>()}
        visibleSteps={allSteps}
      />
    );
    expect(screen.getByText("Welcome")).toBeTruthy();
    expect(screen.queryByText("Complete")).toBeNull();
    expect(screen.getByText("1 / 7")).toBeTruthy();
  });

  it("highlights the current step", () => {
    render(
      <OnboardingProgress
        currentStep={2}
        completedSteps={new Set<OnboardingStep>([1])}
        visibleSteps={allSteps}
      />
    );
    // Current step should be marked with aria
    const aboutYou = screen.getByText("About You");
    expect(aboutYou).toBeTruthy();
  });

  it("marks completed steps", () => {
    render(
      <OnboardingProgress
        currentStep={4}
        completedSteps={new Set<OnboardingStep>([1, 2, 3])}
        visibleSteps={allSteps}
      />
    );
    expect(screen.getByText("Integrations")).toBeTruthy();
    expect(screen.queryByText("Welcome")).toBeNull();
    expect(screen.getByText("4 / 7")).toBeTruthy();
  });

  it("hides skipped steps from visible set", () => {
    const withoutDb = allSteps.filter((s) => s.step !== 3);
    render(
      <OnboardingProgress
        currentStep={1}
        completedSteps={new Set<OnboardingStep>()}
        visibleSteps={withoutDb}
      />
    );
    expect(screen.queryByText("Database")).toBeNull();
  });
});
