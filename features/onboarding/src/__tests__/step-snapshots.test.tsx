// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StepComplete } from "../components/onboarding-wizard/step-complete";
import { StepDatabase } from "../components/onboarding-wizard/step-database";
import { StepProfile } from "../components/onboarding-wizard/step-profile";
import { StepWelcome } from "../components/onboarding-wizard/step-welcome";
import { INITIAL_ONBOARDING_STATE } from "../components/onboarding-wizard/types";

vi.mock("@radarboard/plugin-sdk/registry", () => ({
  getAllPlugins: () => [],
}));

afterEach(() => cleanup());

const noop = () => {};

describe("onboarding step snapshots", () => {
  it("StepWelcome renders correctly", () => {
    const { container } = render(
      <StepWelcome state={INITIAL_ONBOARDING_STATE} onChange={noop} onNext={noop} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("StepProfile renders correctly", () => {
    const { container } = render(
      <StepProfile state={INITIAL_ONBOARDING_STATE} onChange={noop} onNext={noop} onBack={noop} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("StepDatabase renders correctly", () => {
    const { container } = render(
      <StepDatabase state={INITIAL_ONBOARDING_STATE} onChange={noop} onNext={noop} onBack={noop} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("StepComplete — default state", () => {
    const { container } = render(
      <StepComplete state={INITIAL_ONBOARDING_STATE} onFinish={noop} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("StepComplete — with profile and demo mode", () => {
    const state = {
      ...INITIAL_ONBOARDING_STATE,
      profile: "fullstack" as const,
      demoMode: true,
      connectedIntegrations: ["github", "vercel"],
      blueprintId: "indie-revenue-dashboard",
    };
    const { container } = render(<StepComplete state={state} onFinish={noop} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("StepComplete — finishing state", () => {
    const { container } = render(
      <StepComplete
        state={INITIAL_ONBOARDING_STATE}
        onFinish={noop}
        isFinishing
        finishProgress="Applying layout..."
      />
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
