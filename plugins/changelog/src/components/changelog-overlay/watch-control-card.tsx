import { CompactProjectBadge } from "@radarboard/widget-engine/compact-project-badge";
import { Volume2, VolumeX } from "lucide-react";
import type { PackageWatch } from "../../types";
import { STATUS_LABELS, STATUS_VARIANTS } from "../constants";
import { ActionChip } from "./action-chip";
import { Pill } from "./pill";

export function WatchControlCard({
  watch,
  projectColor,
  projectLabel,
  onToggleMute,
  onToggleDisabled,
  onTogglePrereleases,
  onRemove,
}: {
  watch: PackageWatch;
  projectColor: string;
  projectLabel: string;
  onToggleMute: () => void;
  onToggleDisabled: () => void;
  onTogglePrereleases: () => void;
  onRemove: () => void;
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

      <div className="mt-3 flex flex-wrap gap-2">
        <ActionChip onClick={onToggleMute}>
          {watch.status === "muted" ? (
            <>
              <Volume2 className="icon-sm" />
              Unmute
            </>
          ) : (
            <>
              <VolumeX className="icon-sm" />
              Mute
            </>
          )}
        </ActionChip>
        <ActionChip onClick={onToggleDisabled}>
          {watch.status === "disabled" ? "Enable" : "Disable"}
        </ActionChip>
        <ActionChip onClick={onTogglePrereleases}>
          {watch.includePrereleases ? "Turn prereleases off" : "Turn prereleases on"}
        </ActionChip>
        <ActionChip variant="destructive" onClick={onRemove}>
          Remove
        </ActionChip>
      </div>
    </div>
  );
}
