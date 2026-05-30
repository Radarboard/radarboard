"use client";

import { OnboardingGrid } from "@radarboard/feature-onboarding/components/onboarding-grid";
import {
  getProfileDefinition,
  getSuggestedIntegrations,
} from "@radarboard/feature-onboarding/profile-config";
import type { OnboardingState } from "@radarboard/feature-onboarding/types";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { cn } from "@radarboard/utils/cn";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

const ONBOARDING_GRID_CLASS =
  "grid grid-cols-1 gap-3 @[500px]:grid-cols-2 @[750px]:grid-cols-4 @[1000px]:grid-cols-5";

import { SelectableServiceCard } from "@/components/settings/settings-integrations/components/access/service-card";
import type { ServiceEntry } from "@/components/settings/settings-integrations/types";
import {
  collectServices,
  getIntegrationCategories,
} from "@/components/settings/settings-integrations/utils";

interface StepIntegrationsProps {
  state: OnboardingState;
  onChange: (patch: Partial<OnboardingState>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepIntegrations({ state, onChange, onNext, onBack }: StepIntegrationsProps) {
  const services = useMemo(() => collectServices(), []);
  const serviceMap = useMemo(() => new Map(services.map((s) => [s.credKey, s])), [services]);
  const categories = useMemo(() => getIntegrationCategories(services), [services]);
  const [searchQuery, setSearchQuery] = useState("");
  const _selectedProfileDef = useMemo(
    () => (state.profile ? getProfileDefinition(state.profile) : undefined),
    [state.profile]
  );
  const suggestedIntegrationIds = useMemo(
    () => (state.profile ? getSuggestedIntegrations([state.profile]) : []),
    [state.profile]
  );
  const suggestedServices = useMemo(
    () =>
      suggestedIntegrationIds
        .map((id) => serviceMap.get(id))
        .filter((service): service is ServiceEntry => service !== undefined),
    [serviceMap, suggestedIntegrationIds]
  );

  const filteredServiceIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return new Set(
      services
        .filter(
          (s) =>
            (s.auth.name ?? s.credKey).toLowerCase().includes(q) ||
            s.credKey.toLowerCase().includes(q) ||
            (s.category ?? "").toLowerCase().includes(q)
        )
        .map((s) => s.credKey)
    );
  }, [services, searchQuery]);

  const toggleIntegration = (id: string) => {
    const current = state.connectedIntegrations;
    const next = current.includes(id) ? current.filter((i) => i !== id) : [...current, id];
    onChange({ connectedIntegrations: next });
  };

  const selectedCount = state.connectedIntegrations.length;

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-4 pt-4 sm:px-6 sm:pt-6">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-dim text-w-sm uppercase tracking-widest">
          Connect Integrations
        </span>
        {selectedCount > 0 ? (
          <span className="font-mono text-accent text-w-sm">{selectedCount} selected</span>
        ) : null}
      </div>
      <p className="mb-3 font-mono text-dim text-w-sm">
        Select the services you use. You can connect and configure them in detail from Settings
        later.
      </p>

      {suggestedServices.length > 0 ? (
        <div className="mb-4 rounded-item border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-accent text-w-sm uppercase tracking-widest">
              Suggested for your setup
            </span>
            <Button
              type="button"
              variant="ghost-link"
              spacing="none"
              uppercase={false}
              onClick={() => {
                const ids = suggestedServices.map((s) => s.credKey);
                const current = new Set(state.connectedIntegrations);
                for (const id of ids) current.add(id);
                onChange({ connectedIntegrations: Array.from(current) });
              }}
              className="font-mono text-accent text-w-sm underline underline-offset-2 hover:text-foreground"
            >
              Select all suggested
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestedServices.map((service) => {
              const isSelected = state.connectedIntegrations.includes(service.credKey);
              return (
                <Button
                  key={service.credKey}
                  type="button"
                  variant="ghost"
                  size="sm"
                  uppercase={false}
                  onClick={() => toggleIntegration(service.credKey)}
                  className={cn(
                    "rounded-item border px-2.5 py-1 font-mono text-w-sm uppercase tracking-wide transition-colors",
                    isSelected
                      ? "border-accent/30 bg-accent/20 text-accent"
                      : "border-border bg-surface-raised text-foreground hover:border-accent/20"
                  )}
                >
                  {service.auth.name ?? service.credKey}
                </Button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="relative mb-4">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-dim" />
        <Input
          type="search"
          placeholder="Search integrations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="@container min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        {suggestedServices.length > 0 ? (
          <fieldset>
            <legend className="mb-2 font-mono text-accent text-w-sm uppercase tracking-widest">
              Suggested First
            </legend>
            <OnboardingGrid className={ONBOARDING_GRID_CLASS}>
              {suggestedServices
                .filter((service) => !filteredServiceIds || filteredServiceIds.has(service.credKey))
                .map((service) => (
                  <SelectableServiceCard
                    key={service.credKey}
                    service={service}
                    selected={state.connectedIntegrations.includes(service.credKey)}
                    onToggle={() => toggleIntegration(service.credKey)}
                  />
                ))}
            </OnboardingGrid>
          </fieldset>
        ) : null}

        {categories.map((category) => {
          const categoryServices = category.serviceIds
            .map((id) => serviceMap.get(id))
            .filter((s): s is ServiceEntry => s !== undefined)
            .filter((s) => !suggestedIntegrationIds.includes(s.credKey))
            .filter((s) => !filteredServiceIds || filteredServiceIds.has(s.credKey));
          if (categoryServices.length === 0) return null;
          return (
            <fieldset key={category.id}>
              <legend className="mb-2 font-mono text-dim/60 text-w-sm uppercase tracking-widest">
                {category.label}
              </legend>
              <OnboardingGrid className={ONBOARDING_GRID_CLASS}>
                {categoryServices.map((service) => (
                  <SelectableServiceCard
                    key={service.credKey}
                    service={service}
                    selected={state.connectedIntegrations.includes(service.credKey)}
                    onToggle={() => toggleIntegration(service.credKey)}
                  />
                ))}
              </OnboardingGrid>
            </fieldset>
          );
        })}
      </div>

      <div className="flex shrink-0 items-center justify-between border-border/40 border-t py-4">
        <Button variant="ghost" onClick={onBack} className="font-mono uppercase tracking-widest">
          Back
        </Button>
        <div className="flex items-center gap-2">
          {selectedCount === 0 ? (
            <span className="font-mono text-dim text-w-sm" role="status">
              Select at least one integration
            </span>
          ) : null}
          <Button
            onClick={onNext}
            disabled={selectedCount === 0}
            className="font-mono uppercase tracking-widest"
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
