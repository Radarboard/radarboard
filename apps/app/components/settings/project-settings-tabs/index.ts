"use client";

import { cn } from "@radarboard/utils/cn";
import { createElement, type ReactNode, useEffect, useState } from "react";
import type { ProjectSettingsTab } from "../settings-storage";
import {
  DEFAULT_PROJECT_SETTINGS_TAB,
  readStoredProjectSettingsTab,
  writeStoredProjectSettingsTab,
} from "../settings-storage";

interface ProjectSettingsTabsProps {
  dashboardPageCount: number;
  platformCount: number;
  overviewContent: ReactNode;
  dashboardContent: ReactNode;
  platformsContent: ReactNode;
}

interface ProjectSettingsTabMeta {
  id: ProjectSettingsTab;
  label: string;
}

const PROJECT_SETTINGS_TAB_META: ProjectSettingsTabMeta[] = [
  { id: "overview", label: "Overview" },
  { id: "dashboard", label: "Dashboard" },
  { id: "platforms", label: "Platforms" },
];

function renderTabButton({
  activeTab,
  dashboardPageCount,
  onChange,
  platformCount,
  tab,
}: {
  activeTab: ProjectSettingsTab;
  dashboardPageCount: number;
  onChange: (tab: ProjectSettingsTab) => void;
  platformCount: number;
  tab: ProjectSettingsTabMeta;
}) {
  const isActive = activeTab === tab.id;
  let badgeCount: number | null = null;

  if (tab.id === "dashboard") badgeCount = dashboardPageCount;
  if (tab.id === "platforms") badgeCount = platformCount;

  return createElement(
    "button",
    {
      key: tab.id,
      type: "button",
      onClick: () => onChange(tab.id),
      "aria-pressed": isActive,
      className: cn(
        "px-3 py-1.5 text-w-sm font-mono transition-colors border-r border-border last:border-r-0",
        isActive
          ? "bg-accent/10 text-accent"
          : "bg-surface text-dim hover:bg-muted/50 hover:text-foreground-secondary"
      ),
    },
    createElement("span", null, tab.label),
    badgeCount !== null
      ? createElement(
          "span",
          {
            className: cn(
              "ml-1.5 px-1.5 py-0.5 text-w-sm font-mono",
              isActive ? "bg-accent/20 text-accent" : "bg-secondary text-dim"
            ),
          },
          badgeCount
        )
      : null
  );
}

export function ProjectSettingsTabs({
  dashboardPageCount,
  platformCount,
  overviewContent,
  dashboardContent,
  platformsContent,
}: ProjectSettingsTabsProps) {
  const [activeTab, setActiveTab] = useState<ProjectSettingsTab>(() => {
    if (typeof window === "undefined") return DEFAULT_PROJECT_SETTINGS_TAB;
    return readStoredProjectSettingsTab(window.localStorage);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    writeStoredProjectSettingsTab(window.localStorage, activeTab);
  }, [activeTab]);

  let activeContent = overviewContent;
  if (activeTab === "dashboard") {
    activeContent = dashboardContent;
  } else if (activeTab === "platforms") {
    activeContent = platformsContent;
  }

  return createElement(
    "div",
    { className: "flex flex-1 min-h-0 flex-col overflow-hidden" },
    createElement(
      "div",
      { className: "flex flex-wrap border border-border bg-background" },
      PROJECT_SETTINGS_TAB_META.map((tab) =>
        renderTabButton({
          activeTab,
          dashboardPageCount,
          onChange: setActiveTab,
          platformCount,
          tab,
        })
      )
    ),
    createElement(
      "div",
      { className: "flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin" },
      activeContent
    )
  );
}
