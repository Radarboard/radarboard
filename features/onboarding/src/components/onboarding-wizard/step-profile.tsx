"use client";

import type { UserProfile } from "@radarboard/types/database";
import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import { CheckCircle } from "lucide-react";
import { OnboardingGrid } from "./onboarding-grid";
import { PROFILE_GROUPS } from "./profile-config";
import type { OnboardingState } from "./types";

const PROFILE_GRID_CLASS =
  "grid grid-cols-1 gap-3 @[500px]:grid-cols-2 @[750px]:grid-cols-4 @[1000px]:grid-cols-5";

interface StepProfileProps {
  state: OnboardingState;
  onChange: (patch: Partial<OnboardingState>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepProfile({ state, onChange, onNext, onBack }: StepProfileProps) {
  const selectProfile = (id: UserProfile) => {
    onChange({ profile: state.profile === id ? null : id });
  };

  const selectedProfile = state.profile;

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-4 pt-4 sm:px-6 sm:pt-6">
      <div className="mb-1 font-mono text-dim text-w-sm uppercase tracking-widest">About You</div>
      <p className="mb-5 font-mono text-dim text-w-sm">
        Choose your primary role. This helps us suggest the right integrations, plugins, and layout
        for your dashboard.
      </p>

      <div className="@container min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        {PROFILE_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="mb-2 font-mono text-dim/60 text-w-sm uppercase tracking-widest">
              {group.label}
            </div>
            <fieldset>
              <OnboardingGrid className={PROFILE_GRID_CLASS}>
                <legend className="sr-only">{group.label}</legend>
                {group.profiles.map((profile) => {
                  const isSelected = selectedProfile === profile.id;
                  const inputId = `profile-${profile.id}`;
                  return (
                    <label
                      key={profile.id}
                      htmlFor={inputId}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-item border px-3 py-2.5 text-left transition-colors",
                        isSelected
                          ? "border-accent/30 bg-accent/10"
                          : "border-border bg-surface hover:bg-muted"
                      )}
                    >
                      <input
                        id={inputId}
                        type="radio"
                        name="user-profile"
                        checked={isSelected}
                        onChange={() => selectProfile(profile.id)}
                        className="sr-only"
                      />
                      <span className="mt-0.5 text-base leading-none">{profile.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-foreground text-w-sm uppercase tracking-widest">
                            {profile.label}
                          </span>
                          {isSelected ? (
                            <CheckCircle className="ml-auto h-3.5 w-3.5 shrink-0 text-accent" />
                          ) : null}
                        </div>
                        <div className="mt-0.5 font-mono text-dim text-w-sm leading-snug">
                          {profile.description}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </OnboardingGrid>
            </fieldset>
          </div>
        ))}
      </div>

      <div className="flex shrink-0 items-center justify-between border-border/40 border-t py-4">
        <Button variant="ghost" onClick={onBack} className="font-mono uppercase tracking-widest">
          Back
        </Button>
        <div className="flex items-center gap-2">
          {!selectedProfile ? (
            <span className="font-mono text-dim text-w-sm" role="status">
              Choose your role
            </span>
          ) : null}
          <Button
            onClick={onNext}
            disabled={!selectedProfile}
            className="font-mono uppercase tracking-widest"
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
