import { cn } from "@radarboard/utils/cn";
import { cva, type VariantProps } from "class-variance-authority";
import type { InputHTMLAttributes, Ref } from "react";

const inputVariants = cva(
  "flex w-full border border-border font-mono transition-interactive file:border-0 file:bg-transparent file:text-w-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:focus-visible:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-secondary text-foreground-secondary focus-visible:border-accent",
        surface: "bg-surface text-foreground focus-visible:border-accent",
        ghost:
          "border-none bg-transparent shadow-none p-0 focus-visible:border-b focus-visible:border-accent rounded-none",
        outline: "bg-transparent hover:border-accent/40 focus-visible:border-accent",
      },
      size: {
        default: "h-7 px-2 py-1 text-w-sm",
        sm: "h-6 px-2 py-0.5 text-w-sm",
        lg: "h-9 px-3 py-2 text-w-base",
        xl: "h-10 px-4 py-2 text-w-base",
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

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {}

export const Input = ({
  className,
  variant,
  size,
  rounded,
  type,
  ref,
  ...props
}: InputProps & { ref?: Ref<HTMLInputElement> }) => {
  return (
    <input
      type={type}
      className={cn(inputVariants({ variant, size, rounded, className }))}
      ref={ref}
      {...props}
    />
  );
};
Input.displayName = "Input";
