"use client";

import type { Transition } from "motion/react";

export interface WidgetExpandedLayoutIds {
  groupId: string;
  shellId: string;
  headerId: string;
  titleId: string;
}

export const WIDGET_EXPANDED_LAYOUT_TRANSITION: Transition = {
  type: "spring",
  stiffness: 320,
  damping: 34,
  mass: 0.9,
};

export const WIDGET_EXPANDED_FADE_TRANSITION: Transition = {
  duration: 0.18,
  ease: "easeOut",
};

export const WIDGET_EXPANDED_CONTENT_DELAY = 0.14;

export function getWidgetExpandedLayoutIds(widgetId: string): WidgetExpandedLayoutIds {
  return {
    groupId: `widget-expanded-${widgetId}`,
    shellId: "shell",
    headerId: "header",
    titleId: "title",
  };
}
