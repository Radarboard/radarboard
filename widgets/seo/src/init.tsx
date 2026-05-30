"use client";
import type { SearchQuery, SeoOverview } from "@radarboard/types/seo";
import {
  registerTemplateDetailRenderer,
  type TemplateDetailRendererProps,
} from "@radarboard/widget-sdk/detail-renderer-registry";
import { SeoQueryDetail } from "./components/seo-query-detail";

function SeoQueryDetailRenderer({
  item,
  sourceData,
  projectSlug,
}: TemplateDetailRendererProps<SearchQuery, SeoOverview>) {
  return (
    <SeoQueryDetail
      query={item}
      siteAvgCtr={sourceData?.avgCtr ?? 0}
      siteAvgPosition={sourceData?.avgPosition ?? 0}
      projectSlug={projectSlug}
    />
  );
}

export function initializeSeoWidget() {
  registerTemplateDetailRenderer("seo.query", SeoQueryDetailRenderer);
}
