"use client";

import { cn } from "@radarboard/utils/cn";
import {
  Content as SelectPrimitiveContent,
  Group as SelectPrimitiveGroup,
  Icon as SelectPrimitiveIcon,
  Item as SelectPrimitiveItem,
  ItemIndicator as SelectPrimitiveItemIndicator,
  ItemText as SelectPrimitiveItemText,
  Label as SelectPrimitiveLabel,
  Portal as SelectPrimitivePortal,
  Root as SelectPrimitiveRoot,
  Separator as SelectPrimitiveSeparator,
  Trigger as SelectPrimitiveTrigger,
  Value as SelectPrimitiveValue,
  Viewport as SelectPrimitiveViewport,
} from "@radix-ui/react-select";
import { cva, type VariantProps } from "class-variance-authority";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  type ComponentPropsWithoutRef,
  createContext,
  isValidElement,
  type ReactNode,
  type RefObject,
  type SelectHTMLAttributes,
  useContext,
  useMemo,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// Context for search/filter feature
// ---------------------------------------------------------------------------

interface SelectSearchContextValue {
  query: string;
}

const SelectSearchContext = createContext<SelectSearchContextValue>({ query: "" });

// ---------------------------------------------------------------------------
// Select (root)
// ---------------------------------------------------------------------------

interface SelectProps {
  children: ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  name?: string;
  required?: boolean;
}

function Select({ children, ...props }: SelectProps) {
  return <SelectPrimitiveRoot {...props}>{children}</SelectPrimitiveRoot>;
}

// ---------------------------------------------------------------------------
// SelectTrigger
// ---------------------------------------------------------------------------

const triggerVariants = cva(
  "flex w-full cursor-pointer items-center justify-between font-mono outline-none transition-interactive disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:focus-visible:border-destructive",
  {
    variants: {
      variant: {
        default:
          "border border-border bg-secondary text-foreground-secondary data-[state=open]:border-accent",
        surface: "border border-border bg-surface text-foreground data-[state=open]:border-accent",
        ghost:
          "rounded-none border-none bg-transparent p-0 shadow-none data-[state=open]:border-b data-[state=open]:border-accent",
        outline:
          "border border-border bg-transparent hover:border-accent/40 data-[state=open]:border-accent",
      },
      size: {
        default: "h-7 px-3 py-1 text-w-sm gap-1",
        sm: "h-6 px-2 py-0.5 text-w-sm gap-1",
        lg: "h-9 px-3 py-2 text-w-base gap-2",
        xl: "h-10 px-4 py-2 text-w-base gap-2",
      },
      rounded: {
        default: "rounded-item",
        none: "rounded-none",
        md: "rounded-item",
        lg: "rounded-card",
        full: "rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      rounded: "default",
    },
  }
);

interface SelectTriggerProps
  extends ComponentPropsWithoutRef<typeof SelectPrimitiveTrigger>,
    VariantProps<typeof triggerVariants> {}

const SelectTrigger = ({
  className,
  variant,
  size,
  rounded,
  children,
  ref,
  ...props
}: SelectTriggerProps & { ref?: RefObject<HTMLButtonElement | null> }) => (
  <SelectPrimitiveTrigger
    ref={ref}
    className={cn(triggerVariants({ variant, size, rounded, className }))}
    {...props}
  >
    {children}
    <SelectPrimitiveIcon className="flex-shrink-0" asChild>
      <ChevronDown className="icon-xs text-dim" />
    </SelectPrimitiveIcon>
  </SelectPrimitiveTrigger>
);
SelectTrigger.displayName = "SelectTrigger";

interface NativeSelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size">,
    VariantProps<typeof triggerVariants> {}

const NativeSelect = ({
  className,
  variant,
  size,
  rounded,
  children,
  ref,
  ...props
}: NativeSelectProps & { ref?: RefObject<HTMLSelectElement | null> }) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(triggerVariants({ variant, size, rounded }), "appearance-none pr-8", className)}
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="icon-xs pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-dim" />
  </div>
);
NativeSelect.displayName = "NativeSelect";

// ---------------------------------------------------------------------------
// SelectValue
// ---------------------------------------------------------------------------

const SelectValue = ({
  className,
  ref,
  ...props
}: ComponentPropsWithoutRef<typeof SelectPrimitiveValue> & {
  ref?: RefObject<HTMLSpanElement | null>;
}) => <SelectPrimitiveValue ref={ref} className={cn("truncate", className)} {...props} />;
SelectValue.displayName = "SelectValue";

// ---------------------------------------------------------------------------
// SelectContent (Portal + Content)
// ---------------------------------------------------------------------------

interface SelectContentProps extends ComponentPropsWithoutRef<typeof SelectPrimitiveContent> {
  children: ReactNode;
}

const SelectContent = ({
  className,
  children,
  position = "popper",
  sideOffset = 4,
  ref,
  ...props
}: SelectContentProps & { ref?: RefObject<HTMLDivElement | null> }) => {
  const [query, setQuery] = useState("");
  const contextValue = useMemo(() => ({ query }), [query]);
  const hasSearch = hasSelectSearchChild(children);

  const content = (
    <SelectPrimitivePortal>
      <SelectPrimitiveContent
        ref={ref}
        position={position}
        sideOffset={sideOffset}
        className={cn(
          "z-tooltip rounded-item border border-border bg-surface shadow-popover",
          "overflow-hidden",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=open]:animate-in",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          position === "popper" &&
            "max-h-[var(--radix-select-content-available-height)] w-[var(--radix-select-trigger-width)]",
          className
        )}
        {...props}
      >
        {hasSearch && (
          <div className="sticky top-0 z-10 border-border border-b bg-surface p-1.5">
            <div className="relative">
              <Search className="icon-xs pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-dim" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                aria-label="Filter options"
                className="h-7 w-full rounded-item border border-border bg-secondary pr-2 pl-7 font-mono text-foreground-secondary text-w-sm outline-none placeholder:text-muted-foreground focus:border-accent"
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}
        <SelectPrimitiveViewport className="scrollbar-thin max-h-select-viewport overflow-y-auto p-1">
          {children}
        </SelectPrimitiveViewport>
      </SelectPrimitiveContent>
    </SelectPrimitivePortal>
  );

  if (hasSearch) {
    return (
      <SelectSearchContext.Provider value={contextValue}>{content}</SelectSearchContext.Provider>
    );
  }

  return content;
};
SelectContent.displayName = "SelectContent";

// ---------------------------------------------------------------------------
// SelectSearch (marker component — presence enables search in SelectContent)
// ---------------------------------------------------------------------------

const SELECT_SEARCH_TYPE = Symbol.for("radarboard.SelectSearch");

function SelectSearch() {
  return null;
}
SelectSearch._type = SELECT_SEARCH_TYPE;

function hasSelectSearchChild(children: ReactNode): boolean {
  if (!children) return false;
  const arr = Array.isArray(children) ? children : [children];
  return arr.some(
    (child) =>
      isValidElement(child) &&
      (child.type === SelectSearch ||
        (typeof child.type === "object" &&
          child.type !== null &&
          "_type" in (child.type as Record<string, unknown>) &&
          (child.type as Record<string, unknown>)._type === SELECT_SEARCH_TYPE))
  );
}

// ---------------------------------------------------------------------------
// SelectItem
// ---------------------------------------------------------------------------

interface SelectItemProps extends ComponentPropsWithoutRef<typeof SelectPrimitiveItem> {
  /** Text used for filtering when search is enabled. Defaults to children text content. */
  textValue?: string;
  /** Whether the selected-state indicator sits on the left or right edge. */
  indicatorPosition?: "left" | "right";
}

const SelectItem = ({
  className,
  children,
  textValue,
  indicatorPosition = "left",
  ref,
  ...props
}: SelectItemProps & { ref?: RefObject<HTMLDivElement | null> }) => {
  const { query } = useContext(SelectSearchContext);

  // Filter logic: hide items that don't match the search query
  if (query) {
    const text = textValue ?? (typeof children === "string" ? children : "");
    if (text && !text.toLowerCase().includes(query.toLowerCase())) {
      return null;
    }
  }

  return (
    <SelectPrimitiveItem
      ref={ref}
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-item px-2 py-1.5 font-mono text-foreground-secondary text-w-sm outline-none",
        indicatorPosition === "left" ? "pl-7" : "pr-7",
        "data-[highlighted]:bg-secondary data-[highlighted]:text-foreground",
        "data-[state=checked]:text-accent",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "absolute flex items-center justify-center",
          indicatorPosition === "left" ? "left-2" : "right-2"
        )}
      >
        <SelectPrimitiveItemIndicator>
          <Check className="icon-xs" />
        </SelectPrimitiveItemIndicator>
      </span>
      <SelectPrimitiveItemText>{children}</SelectPrimitiveItemText>
    </SelectPrimitiveItem>
  );
};
SelectItem.displayName = "SelectItem";

// ---------------------------------------------------------------------------
// SelectGroup
// ---------------------------------------------------------------------------

const SelectGroup = SelectPrimitiveGroup;

// ---------------------------------------------------------------------------
// SelectGroupLabel (Radix calls this SelectLabel inside a Group)
// ---------------------------------------------------------------------------

const SelectGroupLabel = ({
  className,
  ref,
  ...props
}: ComponentPropsWithoutRef<typeof SelectPrimitiveLabel> & {
  ref?: RefObject<HTMLDivElement | null>;
}) => (
  <SelectPrimitiveLabel
    ref={ref}
    className={cn("px-2 py-1.5 font-mono text-dim text-w-sm uppercase tracking-wider", className)}
    {...props}
  />
);
SelectGroupLabel.displayName = "SelectGroupLabel";

// ---------------------------------------------------------------------------
// SelectLabel (standalone, outside groups)
// ---------------------------------------------------------------------------

function SelectLabel({
  className,
  ...props
}: { className?: string; children: ReactNode } & Record<string, unknown>) {
  return <div className={cn("mb-1 font-mono text-dim text-w-sm", className)} {...props} />;
}
SelectLabel.displayName = "SelectLabel";

// ---------------------------------------------------------------------------
// SelectSeparator
// ---------------------------------------------------------------------------

const SelectSeparator = ({
  className,
  ref,
  ...props
}: ComponentPropsWithoutRef<typeof SelectPrimitiveSeparator> & {
  ref?: RefObject<HTMLDivElement | null>;
}) => (
  <SelectPrimitiveSeparator
    ref={ref}
    className={cn("-mx-1 my-1 border-border border-t", className)}
    {...props}
  />
);
SelectSeparator.displayName = "SelectSeparator";

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export type {
  NativeSelectProps,
  SelectContentProps,
  SelectItemProps,
  SelectProps,
  SelectTriggerProps,
};
export {
  NativeSelect,
  Select,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectLabel,
  SelectSearch,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
