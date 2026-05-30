import { cn } from "@radarboard/utils/cn";
import type { HTMLAttributes, LabelHTMLAttributes, RefObject } from "react";

/**
 * Visible label for a control. Always set `htmlFor` to match the input’s `id`
 * (or wrap the control) so the field is exposed correctly to assistive tech.
 */
export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {}

export const Label = ({
  className,
  htmlFor,
  ref,
  ...props
}: LabelProps & { ref?: RefObject<HTMLLabelElement | null> }) => {
  const classes = cn(
    "font-mono text-muted-foreground text-w-sm uppercase tracking-wider",
    className
  );

  if (!htmlFor) {
    return <span className={classes} {...(props as HTMLAttributes<HTMLSpanElement>)} />;
  }

  // biome-ignore lint/a11y/noLabelWithoutControl: this primitive is only used as a real label when htmlFor is provided
  return <label ref={ref} htmlFor={htmlFor} className={classes} {...props} />;
};
Label.displayName = "Label";
