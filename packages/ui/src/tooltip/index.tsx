"use client";

import { cn } from "@radarboard/utils/cn";
import {
  Content as TooltipPrimitiveContent,
  Portal as TooltipPrimitivePortal,
  Provider as TooltipPrimitiveProvider,
  Root as TooltipPrimitiveRoot,
  Trigger as TooltipPrimitiveTrigger,
} from "@radix-ui/react-tooltip";
import { cva, type VariantProps } from "class-variance-authority";
import type React from "react";

/** Prefer a single provider at the app shell; default delay aligns with UX guidance (~300ms). */
const TooltipProvider = TooltipPrimitiveProvider;
const Tooltip = TooltipPrimitiveRoot;
const TooltipTrigger = TooltipPrimitiveTrigger;

const tooltipContentVariants = cva(
  "z-tooltip overflow-hidden rounded-item border border-border bg-surface px-3 py-1.5 text-w-sm font-mono uppercase tracking-widest text-dim shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
  {
    variants: {
      variant: {
        default: "",
        accent: "border-accent/20 bg-accent/10 text-accent",
        dark: "border-border bg-foreground text-background",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const TooltipContent = ({
  className,
  variant,
  sideOffset = 4,
  ref,
  ...props
}: (React.ComponentPropsWithoutRef<typeof TooltipPrimitiveContent> &
  VariantProps<typeof tooltipContentVariants>) & {
  ref?: React.RefObject<React.ElementRef<typeof TooltipPrimitiveContent> | null>;
}) => (
  <TooltipPrimitivePortal>
    <TooltipPrimitiveContent
      ref={ref}
      sideOffset={sideOffset}
      className={cn(tooltipContentVariants({ variant, className }))}
      {...props}
    />
  </TooltipPrimitivePortal>
);
TooltipContent.displayName = TooltipPrimitiveContent.displayName;

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
