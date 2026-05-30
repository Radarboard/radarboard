import { cn } from "@radarboard/utils/cn";
import {
  Item as ToggleGroupPrimitiveItem,
  Root as ToggleGroupPrimitiveRoot,
} from "@radix-ui/react-toggle-group";
import type { ComponentPropsWithoutRef, RefObject } from "react";

export const ToggleGroup = ({
  className,
  ref,
  ...props
}: ComponentPropsWithoutRef<typeof ToggleGroupPrimitiveRoot> & {
  ref?: RefObject<HTMLDivElement | null>;
}) => (
  <ToggleGroupPrimitiveRoot
    ref={ref}
    className={cn("inline-flex items-center rounded-none border border-border", className)}
    {...props}
  />
);
ToggleGroup.displayName = "ToggleGroup";

export const ToggleGroupItem = ({
  className,
  ref,
  ...props
}: ComponentPropsWithoutRef<typeof ToggleGroupPrimitiveItem> & {
  ref?: RefObject<HTMLButtonElement | null>;
}) => (
  <ToggleGroupPrimitiveItem
    ref={ref}
    className={cn(
      "h-7 border-border border-r px-2.5 font-mono text-dim text-w-sm uppercase tracking-wider transition-interactive last:border-r-0 hover:text-foreground-secondary data-[state=on]:bg-secondary data-[state=on]:text-foreground",
      className
    )}
    {...props}
  />
);
ToggleGroupItem.displayName = "ToggleGroupItem";
