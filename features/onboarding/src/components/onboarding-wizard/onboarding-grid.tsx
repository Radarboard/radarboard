import type { ReactNode } from "react";

/**
 * Responsive grid for onboarding card layouts.
 * Accepts a className for the grid — callers provide container-query breakpoints
 * since Tailwind class scanning may not reach this file in all build configurations.
 */
export function OnboardingGrid({
  children,
  className = "grid grid-cols-1 gap-3",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}
