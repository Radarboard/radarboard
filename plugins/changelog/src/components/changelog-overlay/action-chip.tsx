import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import { cva, type VariantProps } from "class-variance-authority";
import type React from "react";

const actionChipVariants = cva(
  "inline-flex h-7 items-center gap-1 border px-2.5 font-mono text-w-sm uppercase tracking-wider transition-colors",
  {
    variants: {
      variant: {
        default: "border-border bg-surface-raised text-muted-foreground hover:bg-secondary",
        destructive: "border-destructive/30 text-destructive hover:bg-destructive/10",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface ActionChipProps extends VariantProps<typeof actionChipVariants> {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}

export function ActionChip({ children, onClick, variant, className }: ActionChipProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      variant="ghost"
      uppercase={false}
      rounded="none"
      className={cn(actionChipVariants({ variant }), className)}
    >
      {children}
    </Button>
  );
}
