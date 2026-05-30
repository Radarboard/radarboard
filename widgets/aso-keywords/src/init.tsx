"use client";
import type { AsoKeyword } from "@radarboard/types/aso-keywords";
import {
  registerTemplateDetailRenderer,
  type TemplateDetailRendererProps,
} from "@radarboard/widget-sdk/detail-renderer-registry";
import { AsoKeywordDetail } from "./components/aso-keyword-detail";

function AsoKeywordDetailRenderer({ item }: TemplateDetailRendererProps<AsoKeyword>) {
  return <AsoKeywordDetail keyword={item} />;
}

export function initializeAsoKeywordsWidget() {
  registerTemplateDetailRenderer("aso.keyword", AsoKeywordDetailRenderer);
}
