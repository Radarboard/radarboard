import { cn } from "@radarboard/utils/cn";
import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

const badgeVariants = cva(
  "inline-flex items-center rounded-item font-mono uppercase tracking-wider transition-interactive whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border border-transparent bg-muted text-muted-foreground",
        project: "text-foreground",
        success: "border border-success/20 bg-success-bg text-success",
        destructive: "border border-destructive/20 bg-destructive-bg text-destructive",
        warning: "border border-warning/20 bg-warning-bg text-warning",
        accent: "bg-accent/10 text-accent border border-accent/20",
        secondary: "border border-border bg-secondary text-foreground-secondary",
        outline: "bg-transparent border-border text-dim",
      },
      size: {
        default: "px-1.5 py-0.5 text-w-sm",
        xs: "px-1 py-0.5 text-w-sm tracking-badge-dense",
        lg: "px-2 py-1 text-w-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  color?: string;
}

export function Badge({ className, variant, size, color, style, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size }), className)}
      style={
        variant === "project" && color ? { backgroundColor: `${color}33`, color, ...style } : style
      }
      {...props}
    />
  );
}
