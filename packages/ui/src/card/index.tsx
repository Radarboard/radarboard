import { cn } from "@radarboard/utils/cn";
import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, RefObject } from "react";

const cardVariants = cva("overflow-hidden transition-colors", {
  variants: {
    variant: {
      default: "bg-card text-card-foreground",
      surface: "bg-surface text-foreground",
      secondary: "bg-secondary text-foreground-secondary",
      outline: "border border-border bg-transparent",
    },
    border: {
      default: "border border-border",
      none: "border-none",
      dashed: "border border-dashed border-border",
      accent: "border border-accent/20",
    },
    rounded: {
      default: "rounded-item",
      none: "rounded-none",
      md: "rounded-item",
      lg: "rounded-card",
      xl: "rounded-panel",
    },
  },
  defaultVariants: {
    variant: "default",
    border: "none",
    rounded: "none",
  },
});

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = ({
  className,
  variant,
  border,
  rounded,
  ref,
  ...props
}: CardProps & { ref?: RefObject<HTMLDivElement | null> }) => (
  <div ref={ref} className={cn(cardVariants({ variant, border, rounded, className }))} {...props} />
);
Card.displayName = "Card";

export const CardHeader = ({
  className,
  ref,
  ...props
}: HTMLAttributes<HTMLDivElement> & { ref?: RefObject<HTMLDivElement | null> }) => (
  <div ref={ref} className={cn("flex items-center gap-2 px-3 py-2", className)} {...props} />
);
CardHeader.displayName = "CardHeader";

export const CardTitle = ({
  className,
  children,
  ref,
  ...props
}: HTMLAttributes<HTMLHeadingElement> & { ref?: RefObject<HTMLHeadingElement | null> }) => (
  <h3
    ref={ref}
    className={cn("font-mono text-muted-foreground text-w-sm uppercase tracking-wider", className)}
    {...props}
  >
    {children}
  </h3>
);
CardTitle.displayName = "CardTitle";

export const CardContent = ({
  className,
  ref,
  ...props
}: HTMLAttributes<HTMLDivElement> & { ref?: RefObject<HTMLDivElement | null> }) => (
  <div ref={ref} className={cn("px-3 pb-3", className)} {...props} />
);
CardContent.displayName = "CardContent";
