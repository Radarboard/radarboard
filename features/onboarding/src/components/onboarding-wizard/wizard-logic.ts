/**
 * Pure logic functions for the onboarding wizard.
 * Extracted for testability — no React dependencies.
 */

import type { OnboardingState, OnboardingStep } from "./types";
import { INITIAL_ONBOARDING_STATE, ONBOARDING_STEPS } from "./types";

// ---------------------------------------------------------------------------
// Session persistence
// ---------------------------------------------------------------------------

const SESSION_KEY = "radarboard-onboarding-state";
const SESSION_COMPLETED_KEY = "radarboard-onboarding-completed-steps";

export function saveStateToSession(
  state: OnboardingState,
  completedSteps: Set<OnboardingStep>
): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
    sessionStorage.setItem(SESSION_COMPLETED_KEY, JSON.stringify(Array.from(completedSteps)));
  } catch {
    // sessionStorage not available
  }
}

export function loadStateFromSession(): OnboardingState | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OnboardingState;
  } catch {
    return null;
  }
}

export function loadCompletedStepsFromSession(): Set<OnboardingStep> {
  try {
    const raw = sessionStorage.getItem(SESSION_COMPLETED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as OnboardingStep[]);
  } catch {
    return new Set();
  }
}

export function clearSessionState(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_COMPLETED_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Step navigation
// ---------------------------------------------------------------------------

/** Get the visible steps based on mode (returning/preview skip the DB step). */
export function getVisibleSteps(skipDbStep: boolean, demoMode: boolean = false, keepExisting: boolean = false) {
  if (demoMode || keepExisting) return ONBOARDING_STEPS.filter((s) => s.step === 1 || s.step === 7);
  return skipDbStep ? ONBOARDING_STEPS.filter((s) => s.step !== 3) : ONBOARDING_STEPS;
}

/** Get the next step in the visible sequence, or null if at the end. */
export function getNextStep(
  currentStep: OnboardingStep,
  visibleSteps: typeof ONBOARDING_STEPS
): OnboardingStep | null {
  const visibleIds = visibleSteps.map((s) => s.step);
  const currentIdx = visibleIds.indexOf(currentStep);
  if (currentIdx < 0 || currentIdx >= visibleIds.length - 1) return null;
  return visibleIds[currentIdx + 1] ?? null;
}

/** Get the previous step in the visible sequence, or null if at the start. */
export function getPrevStep(
  currentStep: OnboardingStep,
  visibleSteps: typeof ONBOARDING_STEPS
): OnboardingStep | null {
  const visibleIds = visibleSteps.map((s) => s.step);
  const currentIdx = visibleIds.indexOf(currentStep);
  if (currentIdx <= 0) return null;
  return visibleIds[currentIdx - 1] ?? null;
}

/** Check if a step is skippable. */
export function isStepSkippable(step: OnboardingStep): boolean {
  const def = ONBOARDING_STEPS.find((s) => s.step === step);
  return def?.skippable ?? false;
}

// ---------------------------------------------------------------------------
// State initialization
// ---------------------------------------------------------------------------

export function initializeState(
  mode: "first-run" | "returning" | "preview",
  existingProfile: string | null | undefined
): OnboardingState {
  const saved = loadStateFromSession();
  if (saved) {
    // Backfill defaults for fields added after the session was created
    if (saved.enabledPlugins.length === 0 && INITIAL_ONBOARDING_STATE.enabledPlugins.length > 0) {
      saved.enabledPlugins = INITIAL_ONBOARDING_STATE.enabledPlugins;
    }
    return saved;
  }

  if (mode === "returning" || mode === "preview") {
    return {
      ...INITIAL_ONBOARDING_STATE,
      profile: (existingProfile as OnboardingState["profile"]) ?? null,
    };
  }
  return INITIAL_ONBOARDING_STATE;
}
