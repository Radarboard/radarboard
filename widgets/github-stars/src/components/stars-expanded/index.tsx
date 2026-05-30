"use client";

import { TemplateWidgetExpanded } from "@radarboard/widget-engine/templates";
import type { WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { domAnimation, LazyMotion, m } from "motion/react";
import type { GitHubStarsConfig } from "../../types";
import { GITHUB_STARS_TEMPLATE_CONFIG, isTemplateConfig } from "../stars-compact";

export function GitHubStarsExpanded({
  widgetId,
  projectSlug,
  timeRange,
  config,
  selectedDetailId,
  onSelectedDetailIdChange,
  onFetchedAt,
  onRefetch,
}: WidgetRenderProps<GitHubStarsConfig>) {
  const templateConfig = isTemplateConfig(config) ? config : GITHUB_STARS_TEMPLATE_CONFIG;

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
          timeRange={timeRange}
          config={templateConfig}
          selectedDetailId={selectedDetailId}
          onSelectedDetailIdChange={onSelectedDetailIdChange}
          onFetchedAt={onFetchedAt}
          onRefetch={onRefetch}
        />
      </m.div>
    </LazyMotion>
  );
}
