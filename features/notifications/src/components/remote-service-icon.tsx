"use client";

import { cn } from "@radarboard/utils/cn";
import type { ReactNode } from "react";

interface RemoteServiceIconProps {
  src: string;
  alt?: string;
  size: number;
  className?: string;
  fallback?: ReactNode;
}

export function RemoteServiceIcon({
  src,
  alt = "",
  size,
  className,
  fallback = (
    <span className="inline-block h-full w-full rounded-full border border-border bg-muted" />
  ),
}: RemoteServiceIconProps) {
  if (!src) {
    return (
      <span
        className={cn("inline-flex shrink-0 items-center justify-center", className)}
        style={{ width: size, height: size }}
        aria-hidden={alt ? undefined : true}
      >
        {fallback}
      </span>
    );
  }

  return (
    <span
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={cn("inline-flex shrink-0 rounded-full border border-border bg-center bg-cover bg-no-repeat", className)}
      style={{ width: size, height: size, backgroundImage: `url("${src}")` }}
    />
  );
}
