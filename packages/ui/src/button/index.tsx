import { cn } from "@radarboard/utils/cn";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, Ref } from "react";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap font-mono tracking-wider transition-interactive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-foreground hover:bg-accent/90",
        outline: "border border-border bg-transparent hover:bg-muted",
        "outline-accent": "border border-accent/20 text-accent hover:bg-accent/10",
        "outline-destructive":
          "border border-destructive/20 text-destructive hover:bg-destructive/10",
        ghost: "hover:bg-muted",
        "ghost-link": "h-auto p-0 hover:bg-transparent text-dim hover:text-foreground-secondary",
        active: "bg-secondary text-foreground",
        secondary: "bg-secondary text-foreground-secondary hover:bg-muted",
        destructive:
          "border border-transparent text-destructive hover:border-destructive/20 hover:bg-destructive/10",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-7 px-3 text-w-sm",
        sm: "h-6 px-2 text-w-sm",
        xs: "h-5 px-1.5 text-w-sm",
        lg: "h-9 px-4 text-w-base",
        icon: "h-7 w-7",
        /** Icon slot uses `icon-lg` (20px), not “small” text. */
        "icon-sm": "icon-lg",
        /** Icon slot uses `icon-base` (16px). */
        "icon-xs": "icon-base",
      },
      spacing: {
        default: "",
        none: "h-auto p-0",
      },
      uppercase: {
        true: "uppercase",
        false: "normal-case tracking-normal",
      },
      rounded: {
        default: "rounded-item",
        none: "rounded-none",
        full: "rounded-full",
        md: "rounded-item",
        lg: "rounded-card",
        xl: "rounded-panel",
      },
      fullWidth: {
        true: "w-full",
        false: "w-auto",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      spacing: "default",
      uppercase: true,
      rounded: "default",
      fullWidth: false,
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

/**
 * Action button. Icon-only sizes (`icon`, `icon-sm`, `icon-xs`) need `aria-label`.
 * `icon-sm` / `icon-xs` refer to icon slot size (`icon-lg` / `icon-base`), not label text size.
 */
export const Button = ({
  className,
  variant,
  size,
  spacing,
  uppercase,
  rounded,
  fullWidth,
  asChild = false,
  ref,
  ...props
}: ButtonProps & { ref?: Ref<HTMLButtonElement | null> }) => {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(
        buttonVariants({ variant, size, spacing, uppercase, rounded, fullWidth, className })
      )}
      ref={ref}
      {...props}
    />
  );
};
Button.displayName = "Button";
