"use client";

import { useDashboard } from "@radarboard/hooks/use-dashboard";
import { VIEW_STATE_QUERY_KEYS } from "@radarboard/types/view-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@radarboard/ui/app-dialog";
import { ErrorBoundary } from "@radarboard/ui/error-boundary";
import dynamic from "next/dynamic";
import { parseAsString, useQueryState } from "nuqs";
import { FeatureGate } from "@/components/system/feature-gate";
import { UpgradeBanner } from "@/components/system/upgrade-banner";
import { SettingsAdvancedNav } from "../advanced-nav";
import { SETTINGS_LIST_WIDTH } from "../settings-list-panel";
import type { AdvancedSettingsSection, SettingsSection } from "../settings-sections";
import { SettingsSidebar } from "../settings-sidebar";
import { isAdvancedSettingsSection } from "../settings-storage";

function SettingsSectionSkeleton() {
  const skeletonKeys = [
    "settings-skeleton-1",
    "settings-skeleton-2",
    "settings-skeleton-3",
    "settings-skeleton-4",
    "settings-skeleton-5",
    "settings-skeleton-6",
  ];

  return (
    <div className="h-full space-y-5 p-5">
      <div className="space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="h-3 w-48 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-9 w-full animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {skeletonKeys.map((key) => (
          <div key={key} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}

const SettingsAi = dynamic(
  () => import("@radarboard/assistant-ui/settings-ai").then((m) => ({ default: m.SettingsAi })),
  { ssr: false, loading: () => <SettingsSectionSkeleton /> }
);
const SettingsAbout = dynamic(
  () => import("../settings-about").then((m) => ({ default: m.SettingsAbout })),
  { ssr: false, loading: () => <SettingsSectionSkeleton /> }
);
const SettingsAppearance = dynamic(
  () => import("../settings-appearance").then((m) => ({ default: m.SettingsAppearance })),
  { ssr: false, loading: () => <SettingsSectionSkeleton /> }
);
const SettingsDatabase = dynamic(
  () => import("../settings-database").then((m) => ({ default: m.SettingsDatabase })),
  { ssr: false, loading: () => <SettingsSectionSkeleton /> }
);
const SettingsDebug = dynamic(
  () => import("../settings-debug").then((m) => ({ default: m.SettingsDebug })),
  { ssr: false, loading: () => <SettingsSectionSkeleton /> }
);
const SettingsIntegrations = dynamic(
  () => import("../settings-integrations").then((m) => ({ default: m.SettingsIntegrations })),
  { ssr: false, loading: () => <SettingsSectionSkeleton /> }
);
const SettingsInfrastructure = dynamic(
  () => import("../settings-infrastructure").then((m) => ({ default: m.SettingsInfrastructure })),
  { ssr: false, loading: () => <SettingsSectionSkeleton /> }
);
const SettingsLayouts = dynamic(
  () => import("../settings-layouts").then((m) => ({ default: m.SettingsLayouts })),
  { ssr: false, loading: () => <SettingsSectionSkeleton /> }
);
const SettingsMcpServers = dynamic(
  () => import("../settings-mcp-servers").then((m) => ({ default: m.SettingsMcpServers })),
  { ssr: false, loading: () => <SettingsSectionSkeleton /> }
);
const SettingsNotifications = dynamic(
  () => import("../settings-notifications").then((m) => ({ default: m.SettingsNotifications })),
  { ssr: false, loading: () => <SettingsSectionSkeleton /> }
);
const SettingsShortcuts = dynamic(
  () => import("../settings-shortcuts/index").then((m) => ({ default: m.SettingsShortcuts })),
  { ssr: false, loading: () => <SettingsSectionSkeleton /> }
);
const SettingsPlugins = dynamic(
  () => import("../settings-plugins").then((m) => ({ default: m.SettingsPlugins })),
  { ssr: false, loading: () => <SettingsSectionSkeleton /> }
);
const SettingsProjects = dynamic(
  () => import("../settings-projects").then((m) => ({ default: m.SettingsProjects })),
  { ssr: false, loading: () => <SettingsSectionSkeleton /> }
);
const SettingsRouting = dynamic(
  () => import("../settings-routing").then((m) => ({ default: m.SettingsRouting })),
  { ssr: false, loading: () => <SettingsSectionSkeleton /> }
);
const SettingsWidgets = dynamic(
  () => import("../settings-widgets").then((m) => ({ default: m.SettingsWidgets })),
  { ssr: false, loading: () => <SettingsSectionSkeleton /> }
);
const SettingsFeatures = dynamic(
  () => import("../settings-features").then((m) => ({ default: m.SettingsFeatures })),
  { ssr: false, loading: () => <SettingsSectionSkeleton /> }
);
const SettingsWorkflows = dynamic(
  () => import("../settings-workflows").then((m) => ({ default: m.SettingsWorkflows })),
  { ssr: false, loading: () => <SettingsSectionSkeleton /> }
);

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeSection: SettingsSection;
  activeAdvancedSection: AdvancedSettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  onAdvancedSectionChange: (section: AdvancedSettingsSection) => void;
  onRerunSetup?: () => void;
  onPreviewSetup?: () => void;
}

export function SettingsModal({
  open,
  onOpenChange,
  activeSection,
  activeAdvancedSection,
  onSectionChange,
  onAdvancedSectionChange,
  onRerunSetup,
  onPreviewSetup,
}: SettingsModalProps) {
  const { projects, projectOrder, updateProjectOrder } = useDashboard();
  const disabledAiSections: ("skills" | "presets" | "prompts" | "memory")[] = [];
  const [, setActiveServiceId] = useQueryState(VIEW_STATE_QUERY_KEYS.service, parseAsString);
  const [, setIntegrationTabParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.integrationTab,
    parseAsString
  );
  const [, setIntegrationIntentParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.integrationIntent,
    parseAsString
  );
  const [, setIntegrationCategoryParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.integrationCategory,
    parseAsString
  );
  const handleSettingsNavigation = (section: SettingsSection | AdvancedSettingsSection) => {
    if (isAdvancedSettingsSection(section)) {
      onAdvancedSectionChange(section);
      return;
    }
    onSectionChange(section);
  };
  const handleOpenIntegrationSettings = (serviceId: string) => {
    onSectionChange("integrations");
    setActiveServiceId(serviceId);
    setIntegrationTabParam("access");
    setIntegrationIntentParam(null);
    setIntegrationCategoryParam(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription className="sr-only">
            Application settings and configuration
          </DialogDescription>
        </DialogHeader>

        <div className="relative flex min-h-0 flex-1">
          <SettingsSidebar
            activeSection={activeSection}
            onSectionChange={onSectionChange}
            onRerunSetup={onRerunSetup}
            onPreviewSetup={onPreviewSetup}
          />
          {activeSection === "advanced" ? (
            <SettingsAdvancedNav
              activeSection={activeAdvancedSection}
              onSectionChange={onAdvancedSectionChange}
            />
          ) : null}

          <div className="min-h-0 flex-1 overflow-hidden">
            <ErrorBoundary title={activeSection} resetKeys={[activeSection]}>
              {activeSection === "about" && <SettingsAbout />}
              {activeSection === "projects" && (
                <SettingsProjects
                  projects={projects}
                  projectOrder={projectOrder}
                  onOrderChange={updateProjectOrder}
                  onOpenIntegrationSettings={handleOpenIntegrationSettings}
                />
              )}
              {activeSection === "widgets" && (
                <SettingsWidgets onNavigateToIntegrations={() => onSectionChange("integrations")} />
              )}
              {activeSection === "layouts" && <SettingsLayouts />}
              {activeSection === "plugins" && (
                <SettingsPlugins onOpenSettings={handleSettingsNavigation} />
              )}
              {activeSection === "routing" && <SettingsRouting />}
              {activeSection === "workflows" && (
                <FeatureGate
                  feature="workflows"
                  planFallback={(plan) => (
                    <UpgradeBanner requiredPlan={plan} featureLabel="Workflows" />
                  )}
                >
                  <SettingsWorkflows />
                </FeatureGate>
              )}
              {activeSection === "notifications" && <SettingsNotifications />}
              {activeSection === "shortcuts" && (
                <SettingsShortcuts onOpenSettings={handleSettingsNavigation} />
              )}
              {activeSection === "integrations" && (
                <SettingsIntegrations onOpenSettings={handleSettingsNavigation} />
              )}
              {activeSection === "mcp-servers" && <SettingsMcpServers />}
              {activeSection === "ai" && (
                <FeatureGate feature="assistant">
                  <SettingsAi
                    listWidthClassName={SETTINGS_LIST_WIDTH}
                    disabledSections={disabledAiSections}
                  />
                </FeatureGate>
              )}
              {activeSection === "appearance" && <SettingsAppearance />}
              {activeSection === "advanced" && activeAdvancedSection === "infrastructure" && (
                <SettingsInfrastructure />
              )}
              {activeSection === "advanced" && activeAdvancedSection === "features" && (
                <SettingsFeatures />
              )}
              {activeSection === "advanced" && activeAdvancedSection === "database" && (
                <SettingsDatabase />
              )}
              {activeSection === "advanced" && activeAdvancedSection === "debug" && (
                <SettingsDebug />
              )}
            </ErrorBoundary>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
