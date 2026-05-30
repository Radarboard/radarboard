"use client";

import { cn } from "@radarboard/utils/cn";
import { AnimatePresence, domAnimation, LazyMotion, m, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

interface SkeletonShimmerProps {
  /** Whether the content is still loading. */
  loading: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Wraps children in a maskImage-based shimmer overlay while `loading` is true.
 *
 * The children render their full layout (with mock/fallback data) but appear as
 * muted, animated skeleton shapes through the CSS mask. When data arrives and
 * `loading` becomes false, the mask is removed and the local fade animation
 * reveals the content without triggering document-wide transitions.
 *
 * No separate skeleton component is needed -- the real UI IS the skeleton.
 *
 * Screen readers: parent views often pair this with `aria-busy` or a polite
 * live region; this wrapper sets `aria-busy` while the shimmer is active.
 */
export function SkeletonShimmer({ loading, children, className }: SkeletonShimmerProps) {
  const reduceMotion = useReducedMotion();
  const fadeDuration = reduceMotion ? 0 : 0.3;

  return (
    <LazyMotion features={domAnimation}>
      <div
        className={cn("relative h-full w-full", loading && "skeleton-shimmer", className)}
        aria-busy={loading}
      >
        <AnimatePresence mode="wait">
          <m.div
            key={loading ? "loading" : "content"}
            initial={loading || reduceMotion ? false : { opacity: 0.6 }}
            animate={{ opacity: 1 }}
            transition={{ duration: fadeDuration, ease: "easeOut" }}
            className="h-full w-full"
          >
            {children}
          </m.div>
        </AnimatePresence>
      </div>
    </LazyMotion>
  );
}
