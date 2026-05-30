// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { INITIAL_ONBOARDING_STATE, ONBOARDING_STEPS } from "../components/onboarding-wizard/types";
import type { OnboardingState, OnboardingStep } from "../components/onboarding-wizard/types";
import {
  clearSessionState,
  getNextStep,
  getPrevStep,
  getVisibleSteps,
  initializeState,
  isStepSkippable,
  loadCompletedStepsFromSession,
  loadStateFromSession,
  saveStateToSession,
} from "../components/onboarding-wizard/wizard-logic";

// ---------------------------------------------------------------------------
// Session persistence
// ---------------------------------------------------------------------------

describe("session persistence", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  describe("saveStateToSession / loadStateFromSession", () => {
    it("round-trips state through sessionStorage", () => {
      const state: OnboardingState = {
        ...INITIAL_ONBOARDING_STATE,
        profile: "fullstack",
        connectedIntegrations: ["github", "vercel"],
        demoMode: true,
      };
      const completed = new Set<OnboardingStep>([1, 2]);

      saveStateToSession(state, completed);
      const loaded = loadStateFromSession();

      expect(loaded).toEqual(state);
    });

    it("returns null when no state is saved", () => {
      expect(loadStateFromSession()).toBeNull();
    });

    it("returns null on corrupt JSON", () => {
      sessionStorage.setItem("radarboard-onboarding-state", "{corrupt");
      expect(loadStateFromSession()).toBeNull();
    });
  });

  describe("loadCompletedStepsFromSession", () => {
    it("round-trips completed steps", () => {
      const steps = new Set<OnboardingStep>([1, 2, 3]);
      saveStateToSession(INITIAL_ONBOARDING_STATE, steps);

      const loaded = loadCompletedStepsFromSession();
      expect(loaded).toEqual(steps);
    });

    it("returns empty set when nothing saved", () => {
      expect(loadCompletedStepsFromSession()).toEqual(new Set());
    });

    it("returns empty set on corrupt JSON", () => {
      sessionStorage.setItem("radarboard-onboarding-completed-steps", "bad");
      expect(loadCompletedStepsFromSession()).toEqual(new Set());
    });
  });

  describe("clearSessionState", () => {
    it("removes both keys from sessionStorage", () => {
      saveStateToSession(INITIAL_ONBOARDING_STATE, new Set([1 as OnboardingStep]));
      expect(sessionStorage.length).toBeGreaterThan(0);

      clearSessionState();
      expect(sessionStorage.getItem("radarboard-onboarding-state")).toBeNull();
      expect(sessionStorage.getItem("radarboard-onboarding-completed-steps")).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Step navigation
// ---------------------------------------------------------------------------

describe("step navigation", () => {
  const allSteps = ONBOARDING_STEPS;
  const previewSteps = getVisibleSteps(true); // skips DB step

  describe("getVisibleSteps", () => {
    it("returns all 7 steps for first-run mode", () => {
      const steps = getVisibleSteps(false);
      expect(steps).toHaveLength(7);
      expect(steps.map((s) => s.step)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it("skips DB step (3) for returning/preview mode", () => {
      const steps = getVisibleSteps(true);
      expect(steps).toHaveLength(6);
      expect(steps.map((s) => s.step)).toEqual([1, 2, 4, 5, 6, 7]);
      expect(steps.find((s) => s.label === "Database")).toBeUndefined();
    });
  });

  describe("getNextStep", () => {
    it("advances from step 1 to step 2", () => {
      expect(getNextStep(1, allSteps)).toBe(2);
    });

    it("advances through all steps sequentially", () => {
      expect(getNextStep(1, allSteps)).toBe(2);
      expect(getNextStep(2, allSteps)).toBe(3);
      expect(getNextStep(3, allSteps)).toBe(4);
      expect(getNextStep(4, allSteps)).toBe(5);
      expect(getNextStep(5, allSteps)).toBe(6);
      expect(getNextStep(6, allSteps)).toBe(7);
    });

    it("returns null at the last step", () => {
      expect(getNextStep(7, allSteps)).toBeNull();
    });

    it("skips DB step in preview mode (2 → 4)", () => {
      expect(getNextStep(2, previewSteps)).toBe(4);
    });

    it("returns null for unknown step", () => {
      expect(getNextStep(99 as OnboardingStep, allSteps)).toBeNull();
    });
  });

  describe("getPrevStep", () => {
    it("goes back from step 2 to step 1", () => {
      expect(getPrevStep(2, allSteps)).toBe(1);
    });

    it("goes back through all steps", () => {
      expect(getPrevStep(7, allSteps)).toBe(6);
      expect(getPrevStep(6, allSteps)).toBe(5);
      expect(getPrevStep(5, allSteps)).toBe(4);
      expect(getPrevStep(4, allSteps)).toBe(3);
      expect(getPrevStep(3, allSteps)).toBe(2);
      expect(getPrevStep(2, allSteps)).toBe(1);
    });

    it("returns null at the first step", () => {
      expect(getPrevStep(1, allSteps)).toBeNull();
    });

    it("skips DB step going back in preview mode (4 → 2)", () => {
      expect(getPrevStep(4, previewSteps)).toBe(2);
    });

    it("returns null for unknown step", () => {
      expect(getPrevStep(99 as OnboardingStep, allSteps)).toBeNull();
    });
  });

  describe("isStepSkippable", () => {
    it("welcome (1) is not skippable", () => {
      expect(isStepSkippable(1)).toBe(false);
    });

    it("about you (2) is not skippable", () => {
      expect(isStepSkippable(2)).toBe(false);
    });

    it("database (3) is skippable", () => {
      expect(isStepSkippable(3)).toBe(true);
    });

    it("integrations (4) is not skippable", () => {
      expect(isStepSkippable(4)).toBe(false);
    });

    it("plugins (5) is skippable", () => {
      expect(isStepSkippable(5)).toBe(true);
    });

    it("layout (6) is skippable", () => {
      expect(isStepSkippable(6)).toBe(true);
    });

    it("complete (7) is not skippable", () => {
      expect(isStepSkippable(7)).toBe(false);
    });
  });

  describe("full navigation flows", () => {
    it("first-run: walks all 7 steps forward and back", () => {
      const steps = getVisibleSteps(false);
      let current: OnboardingStep = 1;
      const visited: OnboardingStep[] = [current];

      // Walk forward
      while (true) {
        const next = getNextStep(current, steps);
        if (next === null) break;
        current = next;
        visited.push(current);
      }
      expect(visited).toEqual([1, 2, 3, 4, 5, 6, 7]);

      // Walk back
      const backtrack: OnboardingStep[] = [current];
      while (true) {
        const prev = getPrevStep(current, steps);
        if (prev === null) break;
        current = prev;
        backtrack.push(current);
      }
      expect(backtrack).toEqual([7, 6, 5, 4, 3, 2, 1]);
    });

    it("preview: walks 6 steps skipping DB", () => {
      const steps = getVisibleSteps(true);
      let current: OnboardingStep = 1;
      const visited: OnboardingStep[] = [current];

      while (true) {
        const next = getNextStep(current, steps);
        if (next === null) break;
        current = next;
        visited.push(current);
      }
      expect(visited).toEqual([1, 2, 4, 5, 6, 7]);
      expect(visited).not.toContain(3);
    });

    it("skip flow: skippable steps can be bypassed, non-skippable cannot", () => {
      const steps = getVisibleSteps(false);
      const skippableSteps = steps.filter((s) => isStepSkippable(s.step));
      const nonSkippableSteps = steps.filter((s) => !isStepSkippable(s.step));

      expect(skippableSteps.map((s) => s.label)).toEqual(["Database", "Plugins", "Layout"]);
      expect(nonSkippableSteps.map((s) => s.label)).toEqual([
        "Welcome",
        "About You",
        "Integrations",
        "Complete",
      ]);
    });
  });
});

// ---------------------------------------------------------------------------
// State initialization
// ---------------------------------------------------------------------------

describe("initializeState", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it("returns INITIAL_ONBOARDING_STATE for first-run with no session", () => {
    const state = initializeState("first-run", null);
    expect(state).toEqual(INITIAL_ONBOARDING_STATE);
  });

  it("restores from session when available", () => {
    const saved: OnboardingState = {
      ...INITIAL_ONBOARDING_STATE,
      profile: "indie",
      demoMode: true,
      connectedIntegrations: ["github"],
    };
    saveStateToSession(saved, new Set());

    const state = initializeState("first-run", null);
    expect(state.profile).toBe("indie");
    expect(state.demoMode).toBe(true);
    expect(state.connectedIntegrations).toEqual(["github"]);
  });

  it("backfills empty enabledPlugins from defaults", () => {
    const saved: OnboardingState = {
      ...INITIAL_ONBOARDING_STATE,
      enabledPlugins: [],
    };
    saveStateToSession(saved, new Set());

    const state = initializeState("first-run", null);
    expect(state.enabledPlugins.length).toBeGreaterThan(0);
    expect(state.enabledPlugins).toEqual(INITIAL_ONBOARDING_STATE.enabledPlugins);
  });

  it("returning mode uses existing profile", () => {
    const state = initializeState("returning", "seo");
    expect(state.profile).toBe("seo");
  });

  it("preview mode uses existing profile", () => {
    const state = initializeState("preview", "devops");
    expect(state.profile).toBe("devops");
  });

  it("returning mode with null profile starts with null", () => {
    const state = initializeState("returning", null);
    expect(state.profile).toBeNull();
  });

  it("session takes priority over mode-based initialization", () => {
    const saved: OnboardingState = {
      ...INITIAL_ONBOARDING_STATE,
      profile: "mobile",
    };
    saveStateToSession(saved, new Set());

    // Even in returning mode with a different profile, session wins
    const state = initializeState("returning", "backend");
    expect(state.profile).toBe("mobile");
  });
});
