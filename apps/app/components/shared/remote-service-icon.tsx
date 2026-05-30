"use client";

import { cn } from "@radarboard/utils/cn";
import Image from "next/image";
import type { ReactNode } from "react";
import { useState } from "react";

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
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
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
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      unoptimized
      referrerPolicy="no-referrer"
      className={cn("shrink-0 rounded-full border border-border", className)}
      onError={() => setHasError(true)}
      aria-hidden={alt ? undefined : true}
    />
  );
}
