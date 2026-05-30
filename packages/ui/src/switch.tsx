"use client";

import { cn } from "@radarboard/utils/cn";
import { Root as SwitchPrimitiveRoot, Thumb as SwitchPrimitiveThumb } from "@radix-ui/react-switch";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ElementRef, RefObject } from "react";

const switchVariants = cva(
  "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-input transition-interactive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "data-[state=checked]:bg-accent data-[state=unchecked]:bg-secondary",
        success: "data-[state=checked]:bg-success data-[state=unchecked]:bg-secondary",
      },
      size: {
        default: "h-4 w-7",
        sm: "h-3 w-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const thumbVariants = cva(
  "pointer-events-none block rounded-full bg-primary-foreground shadow-lg ring-0 transition-transform",
  {
    variants: {
      size: {
        default: "icon-xs data-[state=checked]:translate-x-3 data-[state=unchecked]:translate-x-0",
        sm: "h-2 w-2 data-[state=checked]:translate-x-2 data-[state=unchecked]:translate-x-0",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

export interface SwitchProps
  extends ComponentPropsWithoutRef<typeof SwitchPrimitiveRoot>,
    VariantProps<typeof switchVariants> {}

const Switch = ({
  className,
  variant,
  size,
  ref,
  ...props
}: SwitchProps & {
  ref?: RefObject<ElementRef<typeof SwitchPrimitiveRoot> | null>;
}) => (
  <SwitchPrimitiveRoot
    className={cn(switchVariants({ variant, size, className }))}
    {...props}
    ref={ref}
  >
    <SwitchPrimitiveThumb className={cn(thumbVariants({ size }))} />
  </SwitchPrimitiveRoot>
);
Switch.displayName = SwitchPrimitiveRoot.displayName;

export { Switch };
