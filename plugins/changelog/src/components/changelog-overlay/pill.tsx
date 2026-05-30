import { cn } from "@radarboard/utils/cn";
import { cva, type VariantProps } from "class-variance-authority";
import type React from "react";

const pillVariants = cva("border px-1.5 py-0.5 font-mono text-w-sm leading-none", {
  variants: {
    variant: {
      default: "border-border bg-secondary text-foreground-secondary",
      success: "border-success/30 bg-success-bg text-success",
      info: "border-info/30 bg-info-bg text-info",
      warning: "border-warning/30 bg-warning-bg text-warning",
      error: "border-destructive/30 bg-destructive-bg text-destructive",
      purple: "border-accent/30 bg-accent/10 text-accent",
      indigo: "border-info/30 bg-info-bg text-info",
      cyan: "border-accent/30 bg-accent/10 text-accent",
      dim: "border-border bg-surface-raised text-dim",
      magenta: "border-accent/25 bg-accent/5 text-accent",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

interface PillProps extends VariantProps<typeof pillVariants> {
  children: React.ReactNode;
  className?: string;
}

export function Pill({ children, variant, className }: PillProps) {
  return <span className={cn(pillVariants({ variant }), className)}>{children}</span>;
}
