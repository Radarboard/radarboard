"use client";

import type { IntegrationConfigFlow } from "@radarboard/integration-sdk/types";
import { Badge } from "@radarboard/ui/badge";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { Label } from "@radarboard/ui/label";
import { cn } from "@radarboard/utils/cn";
import { Check, ChevronRight, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";

interface ConfigFlowWizardProps {
  configFlow: IntegrationConfigFlow;
  onComplete: (values: Record<string, string>) => void;
  onCancel: () => void;
}

type StepStatus = "pending" | "active" | "completed" | "error";

export function ConfigFlowWizard({ configFlow, onComplete, onCancel }: ConfigFlowWizardProps) {
  const { steps } = configFlow;
  const [wizardState, setWizardState] = useState<{
    allValues: Record<string, string>;
    currentStepIndex: number;
    error: string | null;
    stepValues: Record<string, string>;
    validating: boolean;
  }>({
    allValues: {},
    currentStepIndex: 0,
    error: null,
    stepValues: {},
    validating: false,
  });
  const { allValues, currentStepIndex, error, stepValues, validating } = wizardState;

  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;

  const handleFieldChange = useCallback((key: string, value: string) => {
    setWizardState((current) => ({
      ...current,
      stepValues: { ...current.stepValues, [key]: value },
      error: null,
    }));
  }, []);

  const handleNext = useCallback(async () => {
    if (!currentStep) return;

    // Run validation if the step has a validator
    if (currentStep.validate) {
      setWizardState((current) => ({ ...current, validating: true, error: null }));
      try {
        const result = await currentStep.validate(stepValues);
        if (!result.valid) {
          setWizardState((current) => ({
            ...current,
            error: result.error ?? "Validation failed",
            validating: false,
          }));
          return;
        }
      } catch (err) {
        setWizardState((current) => ({
          ...current,
          error: err instanceof Error ? err.message : "Validation error",
          validating: false,
        }));
        return;
      }
      setWizardState((current) => ({ ...current, validating: false }));
    }

    // Merge step values into all values
    const merged = { ...allValues, ...stepValues };

    if (isLastStep) {
      onComplete(merged);
    } else {
      setWizardState((current) => ({
        ...current,
        allValues: merged,
        currentStepIndex: current.currentStepIndex + 1,
        error: null,
        stepValues: {},
      }));
    }
  }, [allValues, currentStep, isLastStep, onComplete, stepValues]);

  const handleBack = useCallback(() => {
    if (currentStepIndex > 0) {
      setWizardState((current) => ({
        ...current,
        currentStepIndex: current.currentStepIndex - 1,
        error: null,
      }));
    }
  }, [currentStepIndex]);

  if (!currentStep) return null;

  return (
    <div className="space-y-4">
      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {steps.map((step, i) => {
          let status: StepStatus = "pending";
          if (i < currentStepIndex) status = "completed";
          if (i === currentStepIndex) status = "active";

          return (
            <div key={step.id} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="icon-xs text-dim" />}
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-w-xs",
                  status === "completed" && "border-success/30 bg-success/10 text-success",
                  status === "active" && "border-accent/30 bg-accent/10 text-accent",
                  status === "pending" && "border-border text-dim"
                )}
              >
                {status === "completed" ? <Check className="icon-xs" /> : <span>{i + 1}</span>}
                {step.title}
              </div>
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="space-y-3 rounded-item border border-border bg-surface p-4">
        <div>
          <h3 className="font-medium font-mono text-foreground text-w-base">{currentStep.title}</h3>
          {currentStep.description ? (
            <p className="mt-1 text-muted-foreground text-w-sm">{currentStep.description}</p>
          ) : null}
        </div>

        {/* Fields */}
        {currentStep.fields?.map((field) => (
          <div key={field.key} className="space-y-1">
            <Label htmlFor={`flow-${field.key}`} className="font-mono text-dim text-w-sm">
              {field.label}
              {field.optional ? (
                <Badge variant="outline" className="ml-2 text-w-xs">
                  optional
                </Badge>
              ) : null}
            </Label>
            <Input
              id={`flow-${field.key}`}
              type={field.type === "password" ? "password" : "text"}
              placeholder={field.placeholder}
              value={stepValues[field.key] ?? ""}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
            />
            {field.helpText ? <p className="text-dim text-w-xs">{field.helpText}</p> : null}
          </div>
        ))}

        {/* Error */}
        {error ? (
          <div className="rounded-item border border-destructive/30 bg-destructive/5 p-2">
            <p className="font-mono text-destructive text-w-sm">{error}</p>
          </div>
        ) : null}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div>
          {currentStepIndex > 0 ? (
            <Button type="button" variant="ghost" onClick={handleBack}>
              Back
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
        <Button type="button" variant="default" onClick={handleNext} disabled={validating}>
          {validating ? (
            <>
              <Loader2 className="icon-xs mr-1.5 animate-spin" />
              Validating...
            </>
          ) : isLastStep ? (
            "Complete"
          ) : (
            "Next"
          )}
        </Button>
      </div>
    </div>
  );
}
