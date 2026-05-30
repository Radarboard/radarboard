"use client";

import { cn } from "@radarboard/utils/cn";
import { Root as SeparatorPrimitiveRoot } from "@radix-ui/react-separator";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ElementRef, RefObject } from "react";

const separatorVariants = cva("shrink-0 transition-interactive", {
  variants: {
    variant: {
      default: "bg-border",
      line: "bg-line",
      accent: "bg-accent/20",
    },
    orientation: {
      horizontal: "h-px w-full",
      vertical: "h-full w-px",
    },
  },
  defaultVariants: {
    variant: "default",
    orientation: "horizontal",
  },
});

const Separator = ({
  className,
  variant,
  orientation = "horizontal",
  decorative = true,
  ref,
  ...props
}: (ComponentPropsWithoutRef<typeof SeparatorPrimitiveRoot> &
  VariantProps<typeof separatorVariants>) & {
  ref?: RefObject<ElementRef<typeof SeparatorPrimitiveRoot> | null>;
}) => (
  <SeparatorPrimitiveRoot
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(separatorVariants({ variant, orientation, className }))}
    {...props}
  />
);
Separator.displayName = SeparatorPrimitiveRoot.displayName;

export { Separator };
