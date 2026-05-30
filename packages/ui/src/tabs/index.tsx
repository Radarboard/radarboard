"use client";

import { cn } from "@radarboard/utils/cn";
import {
  Content as TabsPrimitiveContent,
  List as TabsPrimitiveList,
  Root as TabsPrimitiveRoot,
  Trigger as TabsPrimitiveTrigger,
} from "@radix-ui/react-tabs";
import { cva, type VariantProps } from "class-variance-authority";
import {
  type ComponentPropsWithoutRef,
  createContext,
  type ElementRef,
  type RefObject,
  useContext,
} from "react";

const Tabs = TabsPrimitiveRoot;

const tabsListVariants = cva(
  "inline-flex items-center transition-colors rounded-none overflow-x-auto scrollbar-none",
  {
    variants: {
      variant: {
        default: "gap-2 bg-transparent p-0",
        underline: "w-full justify-start border-b border-border bg-transparent p-0 gap-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const tabsTriggerVariants = cva(
  "inline-flex appearance-none items-center justify-center whitespace-nowrap bg-transparent px-2.5 py-1 text-w-sm font-mono uppercase tracking-wider transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 rounded-none",
  {
    variants: {
      variant: {
        default:
          "h-auto border border-border bg-surface text-dim hover:text-foreground-secondary data-[state=active]:border-accent/30 data-[state=active]:bg-accent/10 data-[state=active]:text-accent",
        underline:
          "h-auto border-b-2 border-transparent bg-transparent px-4 py-2.5 text-w-base font-normal normal-case tracking-normal text-dim hover:text-foreground-secondary data-[state=active]:border-accent data-[state=active]:text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const TabsVariantContext = createContext<{ variant: "default" | "underline" }>({
  variant: "default",
});

const TabsList = ({
  className,
  variant = "default",
  ref,
  ...props
}: (ComponentPropsWithoutRef<typeof TabsPrimitiveList> & VariantProps<typeof tabsListVariants>) & {
  ref?: RefObject<ElementRef<typeof TabsPrimitiveList> | null>;
}) => (
  <TabsVariantContext.Provider value={{ variant: variant || "default" }}>
    <TabsPrimitiveList
      ref={ref}
      className={cn(tabsListVariants({ variant, className }))}
      {...props}
    />
  </TabsVariantContext.Provider>
);
TabsList.displayName = TabsPrimitiveList.displayName;

const TabsTrigger = ({
  className,
  ref,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitiveTrigger> & {
  ref?: RefObject<ElementRef<typeof TabsPrimitiveTrigger> | null>;
}) => {
  const { variant } = useContext(TabsVariantContext);
  return (
    <TabsPrimitiveTrigger
      ref={ref}
      className={cn(tabsTriggerVariants({ variant, className }))}
      {...props}
    />
  );
};
TabsTrigger.displayName = TabsPrimitiveTrigger.displayName;

const TabsContent = ({
  className,
  ref,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitiveContent> & {
  ref?: RefObject<ElementRef<typeof TabsPrimitiveContent> | null>;
}) => (
  <TabsPrimitiveContent
    ref={ref}
    className={cn(
      "mt-2 rounded-none ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
);
TabsContent.displayName = TabsPrimitiveContent.displayName;

export { Tabs, TabsContent, TabsList, TabsTrigger };
