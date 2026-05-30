"use client";

/**
 * Vercel Projects — Expanded fullscreen view
 */

import { useDashboard } from "@radarboard/hooks/use-dashboard";
import type { VercelDeploymentItem } from "@radarboard/types/vercel";
import { cn } from "@radarboard/utils/cn";
import { formatTimeAgo } from "@radarboard/utils/format-time-ago";
import { resolveProjectName } from "@radarboard/utils/project-helpers";
import { CompactProjectBadge } from "@radarboard/widget-engine/compact-project-badge";
import type { WidgetTemplateConfig } from "@radarboard/widget-engine/templates";
import type { WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { useVercelDeployments } from "../../hooks/use-projects";

// --- Helpers ---

function stateColor(state: string | null): string {
  if (state === "READY") return "#3fb950";
  if (state === "ERROR") return "#e63946";
  return "#f5c542";
}

function frameworkLabel(fw: string | null): string {
  if (!fw) return "Other";
  const map: Record<string, string> = {
    nextjs: "Next.js",
    astro: "Astro",
    remix: "Remix",
    vite: "Vite",
    nuxtjs: "Nuxt",
    svelte: "SvelteKit",
    gatsby: "Gatsby",
  };
  return map[fw] ?? fw;
}

export function VercelProjectsExpanded({ projectSlug }: WidgetRenderProps<WidgetTemplateConfig>) {
  const { projects: dashProjects, timeRange } = useDashboard();
  const { projects: vercelProjects, deployments } = useVercelDeployments(projectSlug, timeRange);

  const allProjects = vercelProjects;
  const projectName = resolveProjectName(dashProjects, projectSlug);
  const filtered = projectName ? allProjects.filter((p) => p.name === projectName) : allProjects;

  function projectDeploys(projName: string): VercelDeploymentItem[] {
    return deployments.filter((d) => d.projectName === projName).slice(0, 3);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="scrollbar-thin flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map((proj) => {
            const isBuilding = proj.latestProductionState === "BUILDING";
            const deployedAgo = proj.latestProductionReady
              ? formatTimeAgo(new Date(proj.latestProductionReady).toISOString())
              : "never";
            const recentDeploys = projectDeploys(proj.name);

            return (
              <div key={proj.id} className="rounded-item border border-border bg-surface px-3 py-3">
                {/* Header */}
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
                      isBuilding && "animate-pulse"
                    )}
                    style={{ backgroundColor: stateColor(proj.latestProductionState) }}
                  />
                  <span className="font-medium font-mono text-foreground text-w-base">
                    {proj.name}
                  </span>
                  <div className="ml-auto">
                    <CompactProjectBadge
                      color={proj.projectColor}
                      label={frameworkLabel(proj.framework)}
                    />
                  </div>
                </div>

                {/* Details */}
                <div className="mb-2 flex items-center gap-3">
                  {Boolean(proj.primaryDomain) && (
                    <a
                      href={`https://${proj.primaryDomain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-dim text-w-sm transition-colors hover:text-accent"
                    >
                      {proj.primaryDomain}
                    </a>
                  )}
                  <span className="font-mono text-dim text-w-sm">deployed {deployedAgo}</span>
                </div>

                {/* Recent deploys */}
                {recentDeploys.length > 0 && (
                  <div className="mt-1 border-border border-t pt-2">
                    <div className="mb-1 font-mono text-dim text-w-sm uppercase tracking-wider">
                      Recent
                    </div>
                    {recentDeploys.map((d) => (
                      <div key={d.id} className="flex items-center gap-1.5 py-1">
                        <span
                          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor: (() => {
                              if (stateColor(d.state) === "#3fb950") return "#3fb950";
                              if (d.state === "ERROR") return "#e63946";
                              return "#f5c542";
                            })(),
                          }}
                        />
                        <span className="flex-1 truncate font-mono text-dim text-w-sm">
                          {d.commitMessage ?? "No commit message"}
                        </span>
                        <span className="shrink-0 font-mono text-dim text-w-sm">
                          {d.creatorUsername}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
