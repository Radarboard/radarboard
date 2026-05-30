"use client";

import type { TopPage } from "@radarboard/types/analytics";
import {
  registerTemplateDetailRenderer,
  type TemplateDetailRendererProps,
} from "@radarboard/widget-sdk/detail-renderer-registry";
import { TopPageDetail } from "./components/top-page-detail";

function AnalyticsTopPageDetailRenderer({ item }: TemplateDetailRendererProps<TopPage>) {
  return <TopPageDetail page={item} />;
}

export function initializeAnalyticsWidget() {
  registerTemplateDetailRenderer("analytics.top-page", AnalyticsTopPageDetailRenderer);
}
