import { cn } from "@radarboard/utils/cn";
import type { Ref, TextareaHTMLAttributes } from "react";

const textareaClassName =
  "flex min-h-textarea w-full rounded-item border border-border bg-secondary px-3 py-2 font-mono text-foreground-secondary text-w-base ring-offset-background transition-interactive placeholder:text-muted-foreground focus-visible:border-accent focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:focus-visible:border-destructive";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = ({
  className,
  ref,
  ...props
}: TextareaProps & { ref?: Ref<HTMLTextAreaElement | null> }) => {
  return <textarea className={cn(textareaClassName, className)} ref={ref} {...props} />;
};
Textarea.displayName = "Textarea";
