"use client";

import { Button } from "@radarboard/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";
import { useStore } from "@tanstack/react-store";
import {
  Bell,
  Bot,
  ChevronsLeft,
  ChevronsRight,
  Info,
  LayoutDashboard,
  LayoutGrid,
  type LucideIcon,
  Paintbrush,
  PanelsTopLeft,
  Plug,
  Puzzle,
  RotateCcw,
  Route,
  ScanSearch,
  Server,
  SlidersHorizontal,
  Workflow,
} from "lucide-react";
import { useEffect, useState } from "react";
import { type FeaturePreferences, getDisabledSettingsSections } from "@/lib/features";
import { settingsStore } from "@/modules/settings/store/settings-store";
import type { SettingsSection } from "../settings-sections";

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  onRerunSetup?: () => void;
  onPreviewSetup?: () => void;
}

interface SectionItem {
  id: SettingsSection;
  label: string;
  icon: LucideIcon;
}

interface SectionGroup {
  label: string;
  items: SectionItem[];
}

const SECTION_GROUPS: SectionGroup[] = [
  {
    label: "General",
    items: [
      { id: "projects", label: "Projects", icon: LayoutGrid },
      { id: "appearance", label: "Appearance", icon: Paintbrush },
      { id: "notifications", label: "Notifications", icon: Bell },
      { id: "shortcuts", label: "Shortcuts", icon: ScanSearch },
    ],
  },
  {
    label: "Extensions",
    items: [
      { id: "integrations", label: "Integrations", icon: Plug },
      { id: "plugins", label: "Plugins", icon: Puzzle },
      { id: "widgets", label: "Widgets", icon: LayoutDashboard },
    ],
  },
  {
    label: "Dashboard",
    items: [
      { id: "layouts", label: "Layouts", icon: PanelsTopLeft },
      { id: "routing", label: "Routing", icon: Route },
    ],
  },
  {
    label: "AI & Automation",
    items: [
      { id: "ai", label: "Assistant", icon: Bot },
      { id: "mcp-servers", label: "MCP Servers", icon: Server },
      { id: "workflows", label: "Workflows", icon: Workflow },
    ],
  },
  {
    label: "Advanced",
    items: [{ id: "advanced", label: "Advanced", icon: SlidersHorizontal }],
  },
  {
    label: "",
    items: [{ id: "about", label: "About", icon: Info }],
  },
];

/** Breakpoint (in px) below which the sidebar auto-collapses. */
const COLLAPSE_BREAKPOINT = 1024;

export function SettingsSidebar({
  activeSection,
  onSectionChange,
  onRerunSetup,
  onPreviewSetup,
}: SettingsSidebarProps) {
  const featurePreferences = useStore(settingsStore, (s) => s.featurePreferences);
  const disabledSections = getDisabledSettingsSections(featurePreferences as FeaturePreferences);
  const advancedChildren = ["infrastructure", "features", "database", "debug"];
  const filteredGroups = SECTION_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.id !== "advanced") return !disabledSections.includes(item.id);
      return advancedChildren.some((sectionId) => !disabledSections.includes(sectionId));
    }),
  })).filter((group) => group.items.length > 0);

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${COLLAPSE_BREAKPOINT}px)`);
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setCollapsed(e.matches);
      if (!e.matches) setMobileOpen(false);
    };
    handleChange(mq);
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  // [ key toggles sidebar fold/unfold
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "[" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
          return;
        e.preventDefault();
        if (collapsed) {
          setMobileOpen((prev) => !prev);
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [collapsed]);

  const handleSelect = (section: SettingsSection) => {
    onSectionChange(section);
    if (collapsed) setMobileOpen(false);
  };

  // Collapsed: show vertical strip of icon buttons with tooltips + expand toggle
  if (collapsed && !mobileOpen) {
    return (
      <TooltipProvider delayDuration={200}>
        <nav className="flex flex-shrink-0 flex-col border-border border-r">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setMobileOpen(true)}
                className="h-auto rounded-none border-border border-b px-3 py-2 text-dim hover:bg-muted hover:text-foreground-secondary"
                aria-label="Expand sidebar"
              >
                <ChevronsRight className="icon-sm" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              Expand menu <kbd className="ml-1 text-dim">[</kbd>
            </TooltipContent>
          </Tooltip>
          {filteredGroups.map((group, groupIdx) => (
            <div key={group.label || "ungrouped"} className="flex flex-col">
              {groupIdx > 0 && <div className="mx-2 border-border border-t" />}
              {group.items.map((section) => {
                const Icon = section.icon;
                return (
                  <Tooltip key={section.id}>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handleSelect(section.id)}
                        className={cn(
                          "h-auto rounded-none px-3 py-2.5 transition-colors",
                          activeSection === section.id
                            ? "bg-accent/10 text-foreground"
                            : "text-dim hover:bg-muted hover:text-foreground-secondary"
                        )}
                        aria-label={section.label}
                      >
                        <Icon className="icon-sm" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">{section.label}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </nav>
      </TooltipProvider>
    );
  }

  // Expanded overlay (collapsed + open)
  if (collapsed && mobileOpen) {
    return (
      <nav className="absolute inset-y-0 left-0 z-10 w-[200px] flex-shrink-0 border-border border-r bg-surface py-2 shadow-lg">
        <div className="flex justify-end border-border border-b px-2 pb-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setMobileOpen(false)}
            className="h-auto rounded-item px-2 py-1 text-dim hover:text-foreground-secondary"
            aria-label="Collapse sidebar"
          >
            <ChevronsLeft className="icon-sm" />
          </Button>
        </div>
        {filteredGroups.map((group, groupIdx) => (
          <div key={group.label || "ungrouped"}>
            {group.label && (
              <div
                className={cn(
                  "px-4 pt-3 pb-1 font-mono text-dim/60 text-w-xs uppercase tracking-widest",
                  groupIdx > 0 && "mt-1 border-border border-t"
                )}
              >
                {group.label}
              </div>
            )}
            {!group.label && groupIdx > 0 && <div className="mx-2 mt-1 border-border border-t" />}
            {group.items.map((section) => {
              const Icon = section.icon;
              return (
                <Button
                  key={section.id}
                  type="button"
                  variant="ghost"
                  onClick={() => handleSelect(section.id)}
                  className={cn(
                    "uppercase-none h-auto w-full justify-start gap-2.5 rounded-none border-l-2 px-4 py-2.5 text-left font-mono font-normal text-w-base uppercase tracking-wider transition-colors",
                    activeSection === section.id
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-transparent text-dim hover:bg-muted hover:text-foreground-secondary"
                  )}
                >
                  <Icon className="icon-sm shrink-0" />
                  {section.label}
                </Button>
              );
            })}
          </div>
        ))}
      </nav>
    );
  }

  // Normal expanded sidebar
  return (
    <nav className="flex w-[180px] flex-shrink-0 flex-col border-border border-r py-2">
      <div className="flex-1">
        {filteredGroups.map((group, groupIdx) => (
          <div key={group.label || "ungrouped"}>
            {group.label && (
              <div
                className={cn(
                  "px-4 pt-3 pb-1 font-mono text-dim/60 text-w-xs uppercase tracking-widest",
                  groupIdx > 0 && "mt-1 border-border border-t"
                )}
              >
                {group.label}
              </div>
            )}
            {!group.label && groupIdx > 0 && <div className="mx-2 mt-1 border-border border-t" />}
            {group.items.map((section) => {
              const Icon = section.icon;
              return (
                <Button
                  key={section.id}
                  type="button"
                  variant="ghost"
                  onClick={() => onSectionChange(section.id)}
                  className={cn(
                    "uppercase-none h-auto w-full justify-start gap-2.5 rounded-none border-l-2 px-4 py-2.5 text-left font-mono font-normal text-w-base uppercase tracking-wider transition-colors",
                    activeSection === section.id
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-transparent text-dim hover:bg-muted hover:text-foreground-secondary"
                  )}
                >
                  <Icon className="icon-sm shrink-0" />
                  {section.label}
                </Button>
              );
            })}
          </div>
        ))}
      </div>
      {onRerunSetup || onPreviewSetup ? (
        <div className="space-y-1 border-border border-t px-2 pt-2">
          {onRerunSetup ? (
            <Button
              type="button"
              variant="ghost"
              onClick={onRerunSetup}
              className="uppercase-none h-auto w-full justify-start gap-2.5 rounded-item px-2 py-2 text-left font-mono font-normal text-dim text-w-sm uppercase tracking-wider transition-colors hover:bg-muted hover:text-foreground-secondary"
            >
              <RotateCcw className="icon-sm shrink-0" />
              Re-run Setup
            </Button>
          ) : null}
          {onPreviewSetup ? (
            <Button
              type="button"
              variant="ghost"
              uppercase={false}
              onClick={onPreviewSetup}
              className="h-auto w-full justify-start px-2 py-1 text-left font-mono text-dim/60 text-w-sm hover:text-dim"
            >
              Preview full onboarding
            </Button>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}
