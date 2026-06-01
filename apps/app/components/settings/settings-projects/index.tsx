"use client";

import { useDashboard } from "@radarboard/hooks/use-dashboard";
import { useDemoMode } from "@radarboard/hooks/use-demo-mode";
import { ALL_PROJECTS_SLUG } from "@radarboard/types/dashboard";
import type { ProjectLayoutConfig } from "@radarboard/types/database";
import type { Project } from "@radarboard/types/project";
import { VIEW_STATE_QUERY_KEYS } from "@radarboard/types/view-state";
import { Button } from "@radarboard/ui/button";
import { DemoGuard } from "@radarboard/ui/demo-guard";
import { WIDGET_REGISTRY } from "@radarboard/widget-engine/widgets/registry";
import { canPlaceWidgetInScope } from "@radarboard/widget-sdk/dashboard-scope";
import { LayoutGrid, Plus } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useMemo, useState } from "react";
import type { ProjectIntegrationsMap } from "@/hooks/projects/use-project-integrations";
import { useProjectIntegrations } from "@/hooks/projects/use-project-integrations";
import { AllProjectPanel, DeleteProjectDialog, ProjectDetailPanel } from "./project-detail-panel";
import { ProjectListPanel } from "./project-list-panel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SettingsProjectsProps {
  projects: Project[];
  projectOrder: string[];
  onOrderChange: (newOrder: string[]) => void;
  onOpenIntegrationSettings?: (serviceId: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getOrderedProjects(projects: Project[], projectOrder: string[]): Project[] {
  if (projectOrder.length === 0) return projects;
  const projectMap = new Map(projects.map((p) => [p.slug, p]));
  const ordered: Project[] = [];
  for (const slug of projectOrder) {
    const project = projectMap.get(slug);
    if (project) {
      ordered.push(project);
      projectMap.delete(slug);
    }
  }
  for (const project of projectMap.values()) {
    ordered.push(project);
  }
  return ordered;
}

function deriveUserProjects(integrations: ProjectIntegrationsMap): Project[] {
  const ids = (integrations["@@projects"]?._?.ids as string[]) ?? [];
  const slugs = new Set(ids);

  for (const key of Object.keys(integrations)) {
    if (key.startsWith("@@proj_")) {
      slugs.add(key.slice("@@proj_".length));
    }
  }

  return Array.from(slugs).map((slug) => ({
    id: slug,
    slug,
    name: (integrations[`@@proj_${slug}`]?._?.name as string) ?? slug,
    color: (integrations[`@@proj_${slug}`]?._?.color as string) ?? "var(--color-dim)",
    description: (integrations[`@@proj_${slug}`]?._?.description as string) ?? "",
    platforms: [],
  }));
}

function isProjectSetupIntent(value: string | null): boolean {
  return typeof value === "string" && value.endsWith("-project");
}

function getProjectSetupServiceLabel(intent: string): string {
  if (intent === "sentry-project") return "Sentry";
  if (intent === "sponsorship-project") return "Sponsorship";
  return "this integration";
}

function filterWidgetAssignmentsForProject(
  assignments: Record<string, string | null> | undefined
): Record<string, string | null> | undefined {
  if (!assignments) return undefined;

  return Object.fromEntries(
    Object.entries(assignments).map(([cellId, widgetId]) => {
      const descriptor = widgetId ? WIDGET_REGISTRY.get(widgetId) : null;
      return [
        cellId,
        descriptor && !canPlaceWidgetInScope(descriptor, "project") ? null : widgetId,
      ];
    })
  );
}

function cloneAllProjectsLayoutForProject(
  projectLayouts: Record<string, ProjectLayoutConfig>
): ProjectLayoutConfig | undefined {
  const source = projectLayouts[ALL_PROJECTS_SLUG];
  if (!source?.pages?.length) return undefined;

  return {
    ...source,
    pages: source.pages.map((page) => ({
      ...page,
      widgetLayouts: page.widgetLayouts
        ? Object.fromEntries(
            Object.entries(page.widgetLayouts).map(([layoutId, assignments]) => [
              layoutId,
              filterWidgetAssignmentsForProject(assignments) ?? {},
            ])
          )
        : undefined,
    })),
  };
}

function ProjectSetupChooserPanel({
  hasProjects,
  intent,
  onCreateProject,
}: {
  hasProjects: boolean;
  intent: string;
  onCreateProject: () => void;
}) {
  const isSponsorshipSetup = intent === "sponsorship-project";
  const isSentrySetup = intent === "sentry-project";
  const serviceLabel = getProjectSetupServiceLabel(intent);
  const title = isSponsorshipSetup
    ? "Choose a project to finish Sponsorship setup"
    : `Create or select a project to link ${serviceLabel}`;

  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <LayoutGrid className="mb-3 h-8 w-8 text-secondary" />
      <h2 className="font-mono text-foreground text-w-base uppercase tracking-wider">{title}</h2>
      <p className="mt-2 max-w-md font-mono text-dim text-w-sm leading-relaxed">
        {isSponsorshipSetup
          ? "Sponsorship data is configured per project. Select a project on the left, then add Open Collective or GitHub to one of its platforms."
          : isSentrySetup
            ? "All Projects uses Sentry's organization-wide data. Create or select a Radarboard project only when you want a project-specific Sentry slug."
            : "All Projects is an aggregate view and has no platform settings. Create or select a project, then finish setup from its Platforms tab."}
      </p>
      <Button
        type="button"
        onClick={onCreateProject}
        size="sm"
        uppercase={false}
        className="mt-4 gap-2 font-mono"
      >
        <Plus className="icon-xs" />
        Create project
      </Button>
      <div className="mt-4 flex w-full max-w-md flex-col gap-2 text-left">
        {[
          hasProjects ? "Select a project" : "Create a project",
          "Open or add a platform",
          isSponsorshipSetup
            ? "Add Open Collective slug or GitHub repo"
            : isSentrySetup
              ? "Choose the Sentry project slug"
              : "Add the required platform integration",
        ].map((step, index) => (
          <div
            key={step}
            className="flex items-center gap-3 rounded-item border border-border bg-surface px-3 py-2"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-item border border-border font-mono text-dim text-w-xs">
              {index + 1}
            </span>
            <span className="font-mono text-foreground-secondary text-w-sm">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SettingsProjects
// ---------------------------------------------------------------------------

export function SettingsProjects({
  projects,
  projectOrder,
  onOrderChange,
  onOpenIntegrationSettings,
}: SettingsProjectsProps) {
  const { isDemoMode } = useDemoMode();
  const { projectLayouts, updateProjectLayout } = useDashboard();
  const { integrations, getIntegration, updateIntegrations, updateIntegration } =
    useProjectIntegrations();
  const [selectedSlug, setSelectedSlug] = useQueryState(
    VIEW_STATE_QUERY_KEYS.project,
    parseAsString
  );
  const [integrationIntentParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.integrationIntent,
    parseAsString
  );
  const [projectDialogParam, setProjectDialogParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.projectDialog,
    parseAsString
  );

  const userProjects = deriveUserProjects(integrations);
  const userProjectSlugSet = new Set(userProjects.map((p) => p.slug));
  const projectSlugSet = new Set(projects.map((p) => p.slug));
  const allProjects = [...projects, ...userProjects.filter((p) => !projectSlugSet.has(p.slug))];
  const orderedProjects = getOrderedProjects(allProjects, projectOrder);
  const projectSetupIntent = isProjectSetupIntent(integrationIntentParam)
    ? integrationIntentParam
    : null;

  const selectedProject = selectedSlug
    ? (orderedProjects.find((p) => p.slug === selectedSlug) ?? null)
    : null;

  function handleCreateProject(name: string, color: string) {
    const slug = generateSlug(name);
    updateIntegrations((currentIntegrations) => {
      const currentIds = (currentIntegrations["@@projects"]?._?.ids as string[]) ?? [];
      const ids = currentIds.includes(slug) ? currentIds : [...currentIds, slug];

      return {
        ...currentIntegrations,
        "@@projects": {
          ...(currentIntegrations["@@projects"] ?? {}),
          _: {
            ...(currentIntegrations["@@projects"]?._ ?? {}),
            ids,
          },
        },
        [`@@proj_${slug}`]: {
          ...(currentIntegrations[`@@proj_${slug}`] ?? {}),
          _: {
            ...(currentIntegrations[`@@proj_${slug}`]?._ ?? {}),
            name,
            color,
          },
        },
      };
    });
    const clonedProjectLayout = cloneAllProjectsLayoutForProject(projectLayouts);
    if (clonedProjectLayout) {
      updateProjectLayout(slug, clonedProjectLayout);
    }
    onOrderChange([...projectOrder, slug]);
    setProjectDialogParam(null);
    setSelectedSlug(slug);
  }

  function handleDeleteProject(slug: string) {
    updateIntegrations((currentIntegrations) => {
      const currentIds = (currentIntegrations["@@projects"]?._?.ids as string[]) ?? [];
      const next: ProjectIntegrationsMap = {
        ...currentIntegrations,
        "@@projects": {
          ...(currentIntegrations["@@projects"] ?? {}),
          _: {
            ...(currentIntegrations["@@projects"]?._ ?? {}),
            ids: currentIds.filter((id) => id !== slug),
          },
        },
      };

      delete next[`@@proj_${slug}`];
      delete next[slug];
      return next;
    });
    onOrderChange(projectOrder.filter((s) => s !== slug));
    if (selectedSlug === slug) setSelectedSlug(ALL_PROJECTS_SLUG);
  }

  const pendingDeleteProjectSlug = projectDialogParam?.startsWith("delete:")
    ? projectDialogParam.slice("delete:".length)
    : null;
  const [projectSearch, setProjectSearch] = useState("");

  const pendingDeleteProject = useMemo(
    () => orderedProjects.find((project) => project.slug === pendingDeleteProjectSlug) ?? null,
    [orderedProjects, pendingDeleteProjectSlug]
  );

  const pendingDeleteProjectName = pendingDeleteProject
    ? ((getIntegration(pendingDeleteProject.slug, "_project", "name") as string | null) ??
      pendingDeleteProject.name)
    : null;

  const filteredProjects = useMemo(() => {
    if (!projectSearch.trim()) return orderedProjects;
    const q = projectSearch.toLowerCase();
    return orderedProjects.filter(
      (p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)
    );
  }, [orderedProjects, projectSearch]);

  useEffect(() => {
    if (projectSetupIntent !== null) {
      const hasValidProjectSelection =
        selectedSlug === null ||
        selectedSlug === ALL_PROJECTS_SLUG ||
        orderedProjects.some((project) => project.slug === selectedSlug);

      if (!hasValidProjectSelection) {
        setSelectedSlug(null);
      }
      return;
    }

    const hasValidSelection =
      selectedSlug === ALL_PROJECTS_SLUG ||
      (selectedSlug !== null && orderedProjects.some((project) => project.slug === selectedSlug));
    if (!hasValidSelection) {
      setSelectedSlug(ALL_PROJECTS_SLUG);
    }
  }, [orderedProjects, projectSetupIntent, selectedSlug, setSelectedSlug]);

  useEffect(() => {
    if (pendingDeleteProjectSlug === null) return;
    const hasPendingDeleteProject = orderedProjects.some(
      (project) => project.slug === pendingDeleteProjectSlug
    );
    if (!hasPendingDeleteProject) {
      setProjectDialogParam(null);
    }
  }, [orderedProjects, pendingDeleteProjectSlug, setProjectDialogParam]);

  return (
    <DemoGuard isDemoMode={isDemoMode}>
      <div className="relative flex h-full min-h-0 overflow-hidden">
        <ProjectListPanel
          filteredProjects={filteredProjects}
          orderedProjects={orderedProjects}
          selectedSlug={selectedSlug}
          userProjectSlugSet={userProjectSlugSet}
          showNewProjectForm={projectDialogParam === "new"}
          projectSearch={projectSearch}
          onSearchChange={setProjectSearch}
          onShowNewProjectForm={() => setProjectDialogParam("new")}
          onCreateProject={handleCreateProject}
          onCancelNewProject={() => setProjectDialogParam(null)}
          onSelectSlug={setSelectedSlug}
          onOrderChange={onOrderChange}
          onDeleteProject={(slug) => setProjectDialogParam(`delete:${slug}`)}
        />

        <div className="min-w-0 flex-1 overflow-hidden">
          {selectedSlug === null && projectSetupIntent !== null && (
            <ProjectSetupChooserPanel
              hasProjects={orderedProjects.length > 0}
              intent={projectSetupIntent}
              onCreateProject={() => setProjectDialogParam("new")}
            />
          )}
          {selectedSlug === ALL_PROJECTS_SLUG && <AllProjectPanel />}
          {selectedSlug !== ALL_PROJECTS_SLUG && selectedProject && (
            <ProjectDetailPanel
              project={selectedProject}
              allProjects={orderedProjects}
              integrations={integrations}
              isUserCreated={userProjectSlugSet.has(selectedProject.slug)}
              onDeleteProject={() => setProjectDialogParam(`delete:${selectedProject.slug}`)}
              onOpenIntegrationSettings={onOpenIntegrationSettings}
              projectSetupIntent={projectSetupIntent}
              getIntegration={getIntegration}
              updateIntegration={updateIntegration}
            />
          )}
          {selectedSlug !== ALL_PROJECTS_SLUG &&
            selectedSlug !== null &&
            !selectedProject &&
            projectSetupIntent === null && (
              <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                <LayoutGrid className="mb-3 h-8 w-8 text-secondary" />
                <p className="font-mono text-dim text-w-sm">
                  Select a project to view and edit its configuration.
                </p>
              </div>
            )}

          <DeleteProjectDialog
            pendingDeleteProject={pendingDeleteProject}
            pendingDeleteProjectName={pendingDeleteProjectName}
            onClose={() => setProjectDialogParam(null)}
            onDelete={() => {
              if (!pendingDeleteProjectSlug) return;
              handleDeleteProject(pendingDeleteProjectSlug);
              setProjectDialogParam(null);
            }}
          />
        </div>
      </div>
    </DemoGuard>
  );
}
