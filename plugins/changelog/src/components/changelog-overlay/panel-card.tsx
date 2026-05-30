import { Label } from "@radarboard/ui/label";
import { NativeSelect } from "@radarboard/ui/select";
import { cn } from "@radarboard/utils/cn";
import { cva, type VariantProps } from "class-variance-authority";
import type React from "react";
import type { ChangelogImportTarget } from "../../types";

const panelCardVariants = cva("space-y-3 border px-3 py-2.5", {
  variants: {
    variant: {
      default: "border-border bg-surface",
      accent: "border-accent/40 bg-accent/10",
      success: "border-success/40 bg-success-bg",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

interface PanelCardProps extends VariantProps<typeof panelCardVariants> {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function PanelCard({ title, variant, children, className }: PanelCardProps) {
  return (
    <div className={cn(panelCardVariants({ variant }), className)}>
      <div className="font-mono text-dim text-w-sm uppercase tracking-[0.18em]">{title}</div>
      {children}
    </div>
  );
}

export function TargetSelect({
  targets,
  selectedTargetKey,
  onChange,
}: {
  targets: ChangelogImportTarget[];
  selectedTargetKey: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="tracking-[0.18em]">Target</Label>
      <NativeSelect
        value={selectedTargetKey}
        onChange={(event) => onChange(event.target.value)}
        variant="surface"
        size="lg"
        className="w-full text-sm"
      >
        {targets.map((target) => (
          <option
            key={`${target.projectSlug}:${target.platformId}`}
            value={`${target.projectSlug}:${target.platformId}`}
          >
            {target.projectName} · {target.platformName}
            {target.githubRepo ? "" : " (manual only)"}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
