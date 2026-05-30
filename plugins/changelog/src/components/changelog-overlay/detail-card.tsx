import { CompactProjectBadge } from "@radarboard/widget-engine/compact-project-badge";
import type { PackageWatch } from "../../types";
import { STATUS_LABELS, STATUS_VARIANTS } from "../constants";
import { Pill } from "./pill";

export function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-surface-raised p-3">
      <div className="mb-3 font-mono text-dim text-w-sm uppercase tracking-[0.22em]">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="font-mono text-dim text-w-sm uppercase tracking-[0.18em]">{label}</div>
      <div className="break-words text-foreground-secondary text-sm">{value}</div>
    </div>
  );
}

export function WatchUsageCard({
  watch,
  projectColor,
  projectLabel,
}: {
  watch: PackageWatch;
  projectColor: string;
  projectLabel: string;
}) {
  return (
    <div className="border border-border bg-secondary p-3">
      <div className="flex items-start gap-3">
        <span
          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: projectColor }}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-foreground-secondary text-sm">
            {watch.projectName} · {watch.platformName}
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            <CompactProjectBadge color={projectColor} label={projectLabel} />
            <Pill variant={STATUS_VARIANTS[watch.status]}>{STATUS_LABELS[watch.status]}</Pill>
            <Pill variant="dim">{watch.source === "import" ? "Imported" : "Manual"}</Pill>
            {watch.includePrereleases ? <Pill variant="purple">Prereleases on</Pill> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
