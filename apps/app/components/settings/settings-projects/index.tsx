"use client";

import { useDemoMode } from "@radarboard/hooks/use-demo-mode";
import { ALL_PROJECTS_SLUG } from "@radarboard/types/dashboard";
import type { Project } from "@radarboard/types/project";
import { VIEW_STATE_QUERY_KEYS } from "@radarboard/types/view-state";
import { DemoGuard } from "@radarboard/ui/demo-guard";
import { LayoutGrid } from "lucide-react";
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
  return ids.map((slug) => ({
    id: slug,
    slug,
    name: (integrations[`@@proj_${slug}`]?._?.name as string) ?? slug,
    color: (integrations[`@@proj_${slug}`]?._?.color as string) ?? "var(--color-dim)",
    description: (integrations[`@@proj_${slug}`]?._?.description as string) ?? "",
    platforms: [],
  }));
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
  const { integrations, getIntegration, updateIntegration } = useProjectIntegrations();
  const [selectedSlug, setSelectedSlug] = useQueryState(
    VIEW_STATE_QUERY_KEYS.project,
    parseAsString
  );
  const [projectDialogParam, setProjectDialogParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.projectDialog,
    parseAsString
  );

  const userProjects = deriveUserProjects(integrations);
  const userProjectSlugSet = new Set(userProjects.map((p) => p.slug));
  const allProjects = [...projects, ...userProjects];
  const orderedProjects = getOrderedProjects(allProjects, projectOrder);

  const selectedProject = selectedSlug
    ? (orderedProjects.find((p) => p.slug === selectedSlug) ?? null)
    : null;

  function handleCreateProject(name: string, color: string) {
    const slug = generateSlug(name);
    const currentIds = (integrations["@@projects"]?._?.ids as string[]) ?? [];
    updateIntegration("@@projects", "_", "ids", [...currentIds, slug]);
    updateIntegration(`@@proj_${slug}`, "_", "name", name);
    updateIntegration(`@@proj_${slug}`, "_", "color", color);
    onOrderChange([...projectOrder, slug]);
    setProjectDialogParam(null);
    setSelectedSlug(slug);
  }

  function handleDeleteProject(slug: string) {
    const currentIds = (integrations["@@projects"]?._?.ids as string[]) ?? [];
    updateIntegration(
      "@@projects",
      "_",
      "ids",
      currentIds.filter((id) => id !== slug)
    );
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
    const hasValidSelection =
      selectedSlug === ALL_PROJECTS_SLUG ||
      (selectedSlug !== null && orderedProjects.some((project) => project.slug === selectedSlug));
    if (!hasValidSelection) {
      setSelectedSlug(ALL_PROJECTS_SLUG);
    }
  }, [orderedProjects, selectedSlug, setSelectedSlug]);

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
          {selectedSlug === ALL_PROJECTS_SLUG && <AllProjectPanel />}
          {selectedSlug !== ALL_PROJECTS_SLUG && selectedProject && (
            <ProjectDetailPanel
              project={selectedProject}
              allProjects={orderedProjects}
              integrations={integrations}
              isUserCreated={userProjectSlugSet.has(selectedProject.slug)}
              onDeleteProject={() => setProjectDialogParam(`delete:${selectedProject.slug}`)}
              onOpenIntegrationSettings={onOpenIntegrationSettings}
              getIntegration={getIntegration}
              updateIntegration={updateIntegration}
            />
          )}
          {selectedSlug !== ALL_PROJECTS_SLUG && !selectedProject && (
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
