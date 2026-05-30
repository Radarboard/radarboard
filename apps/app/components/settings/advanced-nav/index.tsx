"use client";

import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import { useStore } from "@tanstack/react-store";
import { Bug, Database, type LucideIcon, Server, ToggleLeft } from "lucide-react";
import { type FeaturePreferences, getDisabledSettingsSections } from "@/lib/features";
import { settingsStore } from "@/modules/settings/store/settings-store";
import { CollapsibleListPanel } from "../settings-list-panel";
import type { AdvancedSettingsSection } from "../settings-sections";

interface AdvancedSectionItem {
  id: AdvancedSettingsSection;
  label: string;
  description: string;
  icon: LucideIcon;
}

const ADVANCED_SECTION_ITEMS: AdvancedSectionItem[] = [
  {
    id: "infrastructure",
    label: "Infrastructure",
    description: "Shared inbound services and relay configuration.",
    icon: Server,
  },
  {
    id: "features",
    label: "Features",
    description: "Product capabilities, flags, and plan-gated toggles.",
    icon: ToggleLeft,
  },
  {
    id: "database",
    label: "Database",
    description: "Connection status, imports, and exports.",
    icon: Database,
  },
  {
    id: "debug",
    label: "Debug",
    description: "Retention, promotion rules, and debug hygiene.",
    icon: Bug,
  },
];

interface SettingsAdvancedNavProps {
  activeSection: AdvancedSettingsSection;
  onSectionChange: (section: AdvancedSettingsSection) => void;
}

export function SettingsAdvancedNav({ activeSection, onSectionChange }: SettingsAdvancedNavProps) {
  const featurePreferences = useStore(settingsStore, (s) => s.featurePreferences);
  const disabledSections = getDisabledSettingsSections(featurePreferences as FeaturePreferences);
  const visibleItems = ADVANCED_SECTION_ITEMS.filter((item) => !disabledSections.includes(item.id));

  if (visibleItems.length === 0) return null;

  return (
    <CollapsibleListPanel>
      <div className="shrink-0 border-border border-b p-3">
        <div className="font-mono text-dim text-xs uppercase tracking-widest">Advanced</div>
        <div className="mt-1 text-dim/70 text-xs">
          Infrastructure, features, database, and debug controls.
        </div>
      </div>

      <nav
        aria-label="Advanced settings sections"
        className="scrollbar-thin flex-1 overflow-y-auto overflow-x-hidden p-2"
      >
        <div className="space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                type="button"
                variant="ghost"
                onClick={() => onSectionChange(item.id)}
                className={cn(
                  "uppercase-none h-auto w-full items-start justify-start gap-3 rounded-none border-l-2 px-3 py-2 text-left transition-colors",
                  activeSection === item.id
                    ? "border-accent bg-accent/10 text-foreground"
                    : "border-transparent text-dim hover:bg-muted hover:text-foreground-secondary"
                )}
              >
                <Icon className="icon-sm mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="font-mono text-w-sm uppercase tracking-widest">{item.label}</div>
                  <div className="mt-1 text-current/70 text-w-sm leading-relaxed">
                    {item.description}
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </nav>
    </CollapsibleListPanel>
  );
}
