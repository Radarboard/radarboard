"use client";
import type { RaindropBookmark, RaindropCollection } from "@radarboard/types/raindrop";
import {
  registerTemplateDetailRenderer,
  type TemplateDetailRendererProps,
} from "@radarboard/widget-sdk/detail-renderer-registry";
import { RaindropBookmarkDetail } from "./details/raindrop-bookmark-detail";
import { RaindropCollectionDetail } from "./details/raindrop-collection-detail";

function RaindropBookmarkDetailRenderer({ item }: TemplateDetailRendererProps<RaindropBookmark>) {
  return <RaindropBookmarkDetail bookmark={item} />;
}
function RaindropCollectionDetailRenderer({
  item,
}: TemplateDetailRendererProps<RaindropCollection>) {
  return <RaindropCollectionDetail collection={item} />;
}

export function initializeRaindropWidget() {
  registerTemplateDetailRenderer("raindrop.bookmark", RaindropBookmarkDetailRenderer);
  registerTemplateDetailRenderer("raindrop.collection", RaindropCollectionDetailRenderer);
}

export const initializeBookmarksWidget = initializeRaindropWidget;
