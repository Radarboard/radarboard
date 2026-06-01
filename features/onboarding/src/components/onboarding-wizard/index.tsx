"use client";

import {
  DEFAULT_DASHBOARD_PAGE_SLUG,
  normalizeDashboardWidgetLayout,
  resolveDashboardLayoutDefinition,
} from "@radarboard/hooks/dashboard-layout";
import { useDashboard } from "@radarboard/hooks/use-dashboard";
import { API_ROUTES } from "@radarboard/types/api-routes";
import { ALL_PROJECTS_SLUG } from "@radarboard/types/dashboard";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@radarboard/ui/dialog";
import { ErrorBoundary } from "@radarboard/ui/error-boundary";
import { parseAsInteger, useQueryState } from "nuqs";
import type { ComponentType } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { OnboardingProgress } from "./onboarding-progress";
import { StepComplete } from "./step-complete";
import { StepDatabase } from "./step-database";
import { persistEnabledPlugins } from "./plugin-persistence";
import { StepPlugins } from "./step-plugins";
import { StepProfile } from "./step-profile";
import { StepWelcome } from "./step-welcome";
import { type OnboardingMode, type OnboardingState, type OnboardingStep } from "./types";
import {
  clearSessionState,
  getNextStep,
  getPrevStep,
  getVisibleSteps,
  initializeState,
  loadCompletedStepsFromSession,
  saveStateToSession,
} from "./wizard-logic";

/** Props for step components that the host app injects. */
export interface OnboardingStepProps {
  state: OnboardingState;
  onChange: (patch: Partial<OnboardingState>) => void;
  onNext: () => void;
  onBack: () => void;
}

interface OnboardingWizardProps {
  mode: OnboardingMode;
  open: boolean;
  onComplete: () => void;
  onPluginsConfigured?: (disabledPluginIds: string[]) => void;
  /** Step 4 — integration selection (provided by host app). */
  StepIntegrations: ComponentType<OnboardingStepProps>;
  /** Step 6 — layout/blueprint selection (provided by host app). */
  StepLayout: ComponentType<OnboardingStepProps>;
}

function OnboardingStepContent({
  StepIntegrations,
  StepLayout,
  finishError,
  finishOnboarding,
  finishProgress,
  handleChange,
  hasExistingData,
  isFinishing,
  nextStep,
  onSkipToComplete,
  prevStep,
  state,
  step,
}: {
  StepIntegrations: ComponentType<OnboardingStepProps>;
  StepLayout: ComponentType<OnboardingStepProps>;
  finishError: string | null;
  finishOnboarding: () => Promise<void>;
  finishProgress: string | null;
  handleChange: (patch: Partial<OnboardingState>) => void;
  hasExistingData: boolean;
  isFinishing: boolean;
  nextStep: () => void;
  onSkipToComplete: () => void;
  prevStep: () => void;
  state: OnboardingState;
  step: OnboardingStep;
}) {
  switch (step) {
    case 1:
      return <StepWelcome state={state} onChange={handleChange} onNext={nextStep} hasExistingData={hasExistingData} onSkipToComplete={onSkipToComplete} />;
    case 2:
      return <StepProfile state={state} onChange={handleChange} onNext={nextStep} onBack={prevStep} />;
    case 3:
      return <StepDatabase state={state} onChange={handleChange} onNext={nextStep} onBack={prevStep} />;
    case 4:
      return (
        <StepIntegrations state={state} onChange={handleChange} onNext={nextStep} onBack={prevStep} />
      );
    case 5:
      return <StepPlugins state={state} onChange={handleChange} onNext={nextStep} onBack={prevStep} />;
    case 6:
      return <StepLayout state={state} onChange={handleChange} onNext={nextStep} onBack={prevStep} />;
    case 7:
      return (
        <StepComplete
          state={state}
          onFinish={finishOnboarding}
          finishError={finishError}
          isFinishing={isFinishing}
          finishProgress={finishProgress}
        />
      );
    default:
      return null;
  }
}

function OnboardingPreviewBanner({ isPreview }: { isPreview: boolean }) {
  if (!isPreview) return null;

  return (
    <div className="flex items-center justify-center bg-warning/10 px-3 py-1.5 font-mono text-w-sm text-warning">
      Preview mode — changes won&apos;t be saved
    </div>
  );
}

function OnboardingStepErrorFallback({
  error,
  nextStep,
  reset,
}: {
  error: Error;
  nextStep: () => void;
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-8 text-center">
      <p className="font-mono text-dim text-w-sm">
        This step ran into a problem. You can retry or skip to the next step.
      </p>
      <pre className="max-w-md overflow-auto rounded-item border border-border bg-secondary p-3 font-mono text-destructive text-w-sm">
        {error.message}
      </pre>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-item border border-border px-4 py-2 font-mono text-w-sm uppercase tracking-widest transition-colors hover:bg-secondary"
        >
          Retry
        </button>
        <button
          type="button"
          onClick={nextStep}
          className="rounded-item bg-accent px-4 py-2 font-mono text-primary-foreground text-w-sm uppercase tracking-widest transition-colors hover:bg-accent/90"
        >
          Skip Step
        </button>
      </div>
    </div>
  );
}

export function OnboardingWizard({
  mode,
  open,
  onComplete,
  onPluginsConfigured,
  StepIntegrations,
  StepLayout,
}: OnboardingWizardProps) {
  const {
    preferences,
    layouts: currentLayouts,
    projectLayouts: currentProjectLayouts,
    widgetConfigs: currentConfigs,
    modalPrefs: currentModalPrefs,
    appearance: currentAppearance,
    replaceWidgetLayoutConfig,
  } = useDashboard();

  // Persist step in URL so refresh stays on the same view
  const [stepParam, setStepParam] = useQueryState("onboarding-step", parseAsInteger);
  const step = (stepParam ?? 1) as OnboardingStep;
  const setStep = useCallback((s: OnboardingStep) => setStepParam(s), [setStepParam]);

  const [completedSteps, setCompletedSteps] = useState<Set<OnboardingStep>>(
    loadCompletedStepsFromSession
  );
  const isPreview = mode === "preview";
  const skipDbStep = mode === "returning" || isPreview;

  // Detect whether the user already has meaningful data from a previous session.
  // This lets the Welcome step offer a "Keep existing settings" option.
  // Note: a default layout always exists (mergeWithDefaults adds one), so
  // checking layouts alone is too broad. We look for user-set content:
  // a profile, widget configs, or a blueprint map — all set during onboarding.
  const hasExistingData = useMemo(() => {
    const hasWidgetConfigs = Object.keys(currentConfigs).length > 0;
    const hasProfile = !!preferences.userProfile;
    const hasBlueprintMap = !!preferences.blueprintWidgetMap && Object.keys(preferences.blueprintWidgetMap).length > 0;
    return hasWidgetConfigs || hasProfile || hasBlueprintMap;
  }, [currentConfigs, preferences.userProfile, preferences.blueprintWidgetMap]);

  const [state, setState] = useState<OnboardingState>(() =>
    initializeState(mode, preferences.userProfile)
  );

  // Save state to sessionStorage on every change
  useEffect(() => {
    saveStateToSession(state, completedSteps);
  }, [state, completedSteps]);

  const visibleSteps = useMemo(
    () => getVisibleSteps(skipDbStep, state.demoMode, state.keepExisting),
    [skipDbStep, state.demoMode, state.keepExisting]
  );

  const handleChange = useCallback((patch: Partial<OnboardingState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const goToStep = useCallback(
    (target: OnboardingStep) => {
      setCompletedSteps((prev) => new Set([...prev, step]));
      setStep(target);
    },
    [step, setStep]
  );

  const nextStep = useCallback(() => {
    const next = getNextStep(step, visibleSteps);
    if (next !== null) {
      goToStep(next);
    }
  }, [step, visibleSteps, goToStep]);

  // Jump directly to the Complete step (step 7). Used by "Keep existing settings"
  // which bypasses intermediate steps — avoids the React state batching race
  // where visibleSteps hasn't updated yet when nextStep is called.
  const skipToComplete = useCallback(() => {
    setCompletedSteps((prev) => new Set([...prev, step]));
    setStep(7 as OnboardingStep);
  }, [step, setStep]);

  const prevStep = useCallback(() => {
    const prev = getPrevStep(step, visibleSteps);
    if (prev !== null) {
      setStep(prev);
    }
  }, [step, visibleSteps, setStep]);

  const [isFinishing, setIsFinishing] = useState(false);
  const [finishProgress, setFinishProgress] = useState<string | null>(null);
  const [finishError, setFinishError] = useState<string | null>(null);

  /* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: onboarding completion coordinates several persistence steps. */
  const finishOnboarding = useCallback(async () => {
    setIsFinishing(true);
    setFinishError(null);

    // Keep existing settings — only mark onboarding complete, touch nothing else.
    if (state.keepExisting && !isPreview) {
      setFinishProgress("Saving preferences...");
      replaceWidgetLayoutConfig({
        configs: currentConfigs,
        modalPrefs: currentModalPrefs,
        layouts: currentLayouts,
        projectLayouts: currentProjectLayouts,
        preferences: { ...preferences, onboardingCompleted: true },
        appearance: currentAppearance,
      });
      clearSessionState();
      setStepParam(null);
      setIsFinishing(false);
      onComplete();
      return;
    }

    if (state.demoMode && !isPreview) {
      setFinishProgress("Setting up demo data...");
      try {
        await fetch(API_ROUTES.demoSeed, { method: "POST" });
      } catch {
        // Non-critical — demo will use fallback data
      }

      // Apply the demo showcase layout. Community widgets are used when they
      // are registered locally; core fallbacks keep a bare core checkout stable.
      let demoLayouts = currentLayouts;
      let demoProjectLayouts = currentProjectLayouts;
      const demoPreferences: typeof preferences & Record<string, unknown> = {
        ...preferences,
        demoMode: true,
        onboardingCompleted: true,
      };

      setFinishProgress("Applying layout...");
      try {
        const [{ BASIC_3X3 }, { DEMO_CONFIG }, { WIDGET_REGISTRY }] = await Promise.all([
          import("@radarboard/widget-engine/layouts"),
          import("@radarboard/widget-engine/demo/registry"),
          import("@radarboard/widget-engine/widgets/registry"),
        ]);
        const widgetAssignments: Record<string, string | null> = {};
        const widgetMap: Record<string, string> = {};

        for (const [cellId, slot] of Object.entries(DEMO_CONFIG.showcaseLayout)) {
          const preferred = WIDGET_REGISTRY.has(slot.widgetId) ? slot.widgetId : slot.fallbackWidgetId;
          widgetAssignments[cellId] = preferred;
          widgetMap[cellId] = preferred;
        }

        demoLayouts = [BASIC_3X3];
        const normalizedAssignments = normalizeDashboardWidgetLayout(BASIC_3X3, widgetAssignments);
        demoProjectLayouts = {
          [ALL_PROJECTS_SLUG]: {
            pages: [
              {
                name: "Overview",
                slug: DEFAULT_DASHBOARD_PAGE_SLUG,
                layoutId: BASIC_3X3.id,
                widgetLayouts: { [BASIC_3X3.id]: normalizedAssignments },
              },
            ],
          },
        };
        demoPreferences.blueprintWidgetMap = widgetMap;
      } catch {
        // Non-critical — user can pick a layout from settings later
      }

      replaceWidgetLayoutConfig({
        configs: currentConfigs,
        modalPrefs: currentModalPrefs,
        layouts: demoLayouts,
        projectLayouts: demoProjectLayouts,
        preferences: demoPreferences,
        appearance: currentAppearance,
      });
      window.dispatchEvent(new CustomEvent("radarboard:demo-data-ready"));
      clearSessionState();
      setStepParam(null);
      setIsFinishing(false);
      onComplete();
      return;
    }

    if (!isPreview) {
      // Build the full config locally to avoid stale-closure issues when
      // calling multiple update functions sequentially (each would read from
      // the same stale widgetLayoutConfig and clobber the previous call).
      //
      // When restoring from backup, the imported snapshot already contains the
      // user's preferences, layouts, and plugin settings. We only need to mark
      // onboardingCompleted so the wizard doesn't reappear.
      const newPreferences = state.restoredFromBackup
        ? { ...preferences, onboardingCompleted: true }
        : {
            ...preferences,
            demoMode: mode === "first-run" ? state.demoMode : false,
            onboardingCompleted: true,
            userProfile: state.profile,
            intendedIntegrations:
              state.connectedIntegrations.length > 0 ? state.connectedIntegrations : undefined,
          };

      let newLayouts = currentLayouts;
      let newProjectLayouts = currentProjectLayouts;

      setFinishProgress("Configuring plugins...");
      try {
        const [{ getAllPlugins }, { getPluginToken }, { API_ROUTES: pluginApiRoutes }] =
          await Promise.all([
            import("@radarboard/plugin-sdk/registry"),
            import("@radarboard/plugin-sdk/host"),
            import("@radarboard/types/api-routes"),
          ]);
        const disabledPluginIds = await persistEnabledPlugins(state, {
          fetchImpl: fetch,
          getAllPlugins,
          getPluginToken,
          pluginDataRoute: pluginApiRoutes.pluginData,
        });
        onPluginsConfigured?.(disabledPluginIds);
      } catch {
        setFinishError("We couldn't activate your selected plugins. Please try again.");
        setFinishProgress(null);
        setIsFinishing(false);
        return;
      }

      // Apply selected blueprint layout (or best-fit default when skipped).
      // Skipped when the user restored a config backup — the imported snapshot
      // already contains their layouts and preferences.
      if (!state.restoredFromBackup) {
      setFinishProgress("Applying layout...");
      try {
        const { LAYOUT_BLUEPRINTS, scoreBlueprintFit } = await import(
          "@radarboard/widget-engine/blueprints/registry"
        );
        const { applyBlueprint } = await import("@radarboard/widget-engine/blueprints");
        const { WIDGET_REGISTRY } = await import("@radarboard/widget-engine/widgets/registry");
        const canPlaceWidget = (widgetId: string, scope: "all-projects" | "project") => {
          const descriptor = WIDGET_REGISTRY.get(widgetId);
          return descriptor?.supportedDashboardScopes?.includes(scope) ?? true;
        };

        let blueprint = state.blueprintId
          ? LAYOUT_BLUEPRINTS.find((b) => b.id === state.blueprintId)
          : undefined;

        // When no blueprint was selected (e.g. step skipped), pick the best fit
        if (!blueprint && LAYOUT_BLUEPRINTS.length > 0) {
          const scored = LAYOUT_BLUEPRINTS.map((b) => ({
            blueprint: b,
            score: scoreBlueprintFit(b, {
              personas: state.profile ? [state.profile] : [],
              connectedIntegrations: state.connectedIntegrations,
              dashboardScope: "all-projects",
              canPlaceWidget,
            }),
          })).sort((a, b) => b.score - a.score);
          blueprint = scored[0]?.blueprint;
        }

        if (blueprint) {
          const result = applyBlueprint(blueprint, state.connectedIntegrations, {
            dashboardScope: "all-projects",
            canPlaceWidget,
          });
          newLayouts = [result.layout];

          // Store widget assignments in the default project page
          const resolvedLayout = resolveDashboardLayoutDefinition(newLayouts, result.layout.id);
          const normalizedAssignments = normalizeDashboardWidgetLayout(
            resolvedLayout,
            result.widgetAssignments
          );
          newProjectLayouts = {
            ...currentProjectLayouts,
            [ALL_PROJECTS_SLUG]: {
              pages: [
                {
                  name: "Overview",
                  slug: DEFAULT_DASHBOARD_PAGE_SLUG,
                  layoutId: result.layout.id,
                  widgetLayouts: { [result.layout.id]: normalizedAssignments },
                },
              ],
            },
          };

          const widgetMap: Record<string, string> = {};
          for (const [cellId, widgetId] of Object.entries(result.widgetAssignments)) {
            if (widgetId) widgetMap[cellId] = widgetId;
          }
          newPreferences.blueprintWidgetMap = widgetMap;
        }
      } catch {
        // Non-critical — user can pick a layout from settings later
      }
      } // end !restoredFromBackup

      // Single atomic update — avoids stale-closure race conditions
      setFinishProgress("Saving preferences...");
      replaceWidgetLayoutConfig({
        configs: currentConfigs,
        modalPrefs: currentModalPrefs,
        layouts: newLayouts,
        projectLayouts: newProjectLayouts,
        preferences: newPreferences,
        appearance: currentAppearance,
      });
    }

    setFinishProgress("Almost done...");
    clearSessionState();
    setStepParam(null);
    setIsFinishing(false);
    onComplete();
  }, [
    isPreview,
    state,
    preferences,
    currentLayouts,
    currentProjectLayouts,
    currentConfigs,
    currentModalPrefs,
    currentAppearance,
    replaceWidgetLayoutConfig,
    setStepParam,
    onComplete,
    onPluginsConfigured,
    mode,
  ]);

  const isDismissible = mode !== "first-run";

  return (
    <Dialog open={open} onOpenChange={() => isDismissible && onComplete()}>
      <DialogContent
        size="md"
        overlayClassName="bg-background"
        hideCloseButton={!isDismissible}
        onPointerDownOutside={(e) => !isDismissible && e.preventDefault()}
        onEscapeKeyDown={(e) => !isDismissible && e.preventDefault()}
      >
        <DialogTitle className="sr-only">Radarboard onboarding</DialogTitle>
        <DialogDescription className="sr-only">
          Complete the onboarding wizard to configure your Radarboard workspace.
        </DialogDescription>
        <OnboardingPreviewBanner isPreview={isPreview} />
        <OnboardingProgress
          currentStep={step}
          completedSteps={completedSteps}
          visibleSteps={visibleSteps}
        />
        <ErrorBoundary
          title={`Onboarding — Step ${step}`}
          resetKeys={[step]}
          fallback={(error, reset) => (
            <OnboardingStepErrorFallback error={error} nextStep={nextStep} reset={reset} />
          )}
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <OnboardingStepContent
              StepIntegrations={StepIntegrations}
              StepLayout={StepLayout}
              finishError={finishError}
              finishOnboarding={finishOnboarding}
              finishProgress={finishProgress}
              handleChange={handleChange}
              hasExistingData={hasExistingData}
              isFinishing={isFinishing}
              nextStep={nextStep}
              onSkipToComplete={skipToComplete}
              prevStep={prevStep}
              state={state}
              step={step}
            />
          </div>
        </ErrorBoundary>
      </DialogContent>
    </Dialog>
  );
}
