"use client";

import { useDashboard } from "@radarboard/hooks/use-dashboard";
import { TemplateWidgetExpanded } from "@radarboard/widget-engine/templates";
import type { WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { domAnimation, LazyMotion, m } from "motion/react";
import { resolveObservabilityMode } from "../../capabilities";
import {
  getResolvedAppStoreTemplateConfig,
  getResolvedHealthTemplateConfig,
  getResolvedSentryTemplateConfig,
} from "../observability-compact";

// --- Expanded View ---

export function DetailExpanded({ widgetId, projectSlug, config }: WidgetRenderProps) {
  const { projects } = useDashboard();

  const mode = resolveObservabilityMode(projects, projectSlug);
  const getTemplateConfig = () => {
    if (mode === "sentry")
      return getResolvedSentryTemplateConfig(config as Record<string, unknown>);
    if (mode === "appstore")
      return getResolvedAppStoreTemplateConfig(config as Record<string, unknown>);
    return getResolvedHealthTemplateConfig(config as Record<string, unknown>);
  };
  const templateConfig = getTemplateConfig();

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex h-full flex-col"
      >
        <TemplateWidgetExpanded
          widgetId={widgetId}
          projectSlug={projectSlug}
          config={templateConfig}
        />
      </m.div>
    </LazyMotion>
  );
}
