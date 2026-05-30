"use client";

/**
 * Vercel Domains — Expanded fullscreen view
 */

import { useDashboard } from "@radarboard/hooks/use-dashboard";
import type { VercelDomainItem } from "@radarboard/types/vercel";
import { filterByProject, resolveProjectName } from "@radarboard/utils/project-helpers";
import { CompactProjectBadge } from "@radarboard/widget-engine/compact-project-badge";
import { SummaryMetricCell } from "@radarboard/widget-engine/summary-metric-cell";
import type { WidgetTemplateConfig } from "@radarboard/widget-engine/templates";
import { WidgetTable } from "@radarboard/widget-engine/widget-table";
import type { WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { createColumnHelper } from "@tanstack/react-table";
import { Check, X } from "lucide-react";
import { useVercelDomains } from "../../hooks/use-domains";

// --- Column definitions ---

const col = createColumnHelper<VercelDomainItem>();

const DOMAIN_COLUMNS = [
  col.accessor("name", {
    header: "Domain",
    cell: (info) => (
      <span className="font-mono text-foreground text-w-base">{info.getValue()}</span>
    ),
  }),
  col.accessor("projectName", {
    header: "Project",
    size: 150,
    cell: (info) => {
      const d = info.row.original;
      return <CompactProjectBadge color={d.projectColor} label={info.getValue()} />;
    },
  }),
  col.accessor("verified", {
    header: "Verified",
    size: 90,
    meta: { align: "center" as const },
    cell: (info) =>
      info.getValue() ? (
        <Check className="icon-xs mx-auto text-[#3fb950]" />
      ) : (
        <X className="icon-xs mx-auto text-[#e63946]" />
      ),
  }),
  col.accessor("configured", {
    header: "Configured",
    size: 100,
    meta: { align: "center" as const },
    cell: (info) =>
      info.getValue() ? (
        <Check className="icon-xs mx-auto text-[#3fb950]" />
      ) : (
        <X className="icon-xs mx-auto text-[#e63946]" />
      ),
  }),
];

export function VercelDomainsExpanded({ projectSlug }: WidgetRenderProps<WidgetTemplateConfig>) {
  const { projects } = useDashboard();
  const { domains } = useVercelDomains(projectSlug);

  const projectName = resolveProjectName(projects, projectSlug);
  const filtered = filterByProject(domains, projectName);

  const total = filtered.length;
  const verified = filtered.filter((d) => d.verified).length;
  const unverified = total - verified;

  return (
    <div className="flex h-full flex-col">
      {/* KPI strip */}
      <div className="grid shrink-0 grid-cols-3 gap-0 border-border border-b">
        <SummaryMetricCell label="Total Domains" value={String(total)} />
        <SummaryMetricCell label="Verified" value={String(verified)} />
        <SummaryMetricCell label="Unverified" value={String(unverified)} />
      </div>

      {/* Domain table */}
      <WidgetTable
        stateKey="vercel-domains:domains"
        columns={DOMAIN_COLUMNS}
        data={filtered}
        defaultSorting={[{ id: "verified", desc: false }]}
        filterPlaceholder="Filter domains..."
        emptyMessage="No domains"
      />
    </div>
  );
}
