import { cn } from "@radarboard/utils/cn";
import {
  Corner as ScrollAreaCorner,
  Root as ScrollAreaRoot,
  Scrollbar as ScrollAreaScrollbar,
  Thumb as ScrollAreaThumb,
  Viewport as ScrollAreaViewport,
} from "@radix-ui/react-scroll-area";
import type { ComponentPropsWithoutRef, RefObject } from "react";

export const ScrollArea = ({
  className,
  children,
  ref,
  ...props
}: ComponentPropsWithoutRef<typeof ScrollAreaRoot> & {
  ref?: RefObject<HTMLDivElement | null>;
}) => (
  <ScrollAreaRoot ref={ref} className={cn("relative overflow-hidden", className)} {...props}>
    <ScrollAreaViewport className="h-full w-full rounded-[inherit]">{children}</ScrollAreaViewport>
    <ScrollAreaScrollbar
      orientation="vertical"
      className="flex h-full w-1.5 touch-none select-none border-l border-l-transparent p-px transition-colors"
    >
      <ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
    </ScrollAreaScrollbar>
    <ScrollAreaCorner />
  </ScrollAreaRoot>
);
ScrollArea.displayName = "ScrollArea";
