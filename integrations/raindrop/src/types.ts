import type { RaindropBookmark, RaindropCollection, RaindropTag } from "@radarboard/types/raindrop";

export interface RaindropConfig {
  accessToken: string;
}

export interface RawRaindropCollectionRef {
  $id?: number;
}

export interface RawRaindropItem {
  _id: number;
  title?: string;
  excerpt?: string;
  link: string;
  domain?: string;
  created?: string;
  lastUpdate?: string;
  tags?: string[];
  important?: boolean;
  collection?: RawRaindropCollectionRef;
  cover?: string;
  media?: Array<{ link?: string }>;
}

export interface RawRaindropCollection {
  _id: number;
  title: string;
  count?: number;
  color?: string;
  lastUpdate?: string;
  parent?: RawRaindropCollectionRef;
}

export interface RawRaindropTag {
  _id: string;
  count: number;
}

export interface RaindropItemsResponse {
  result: boolean;
  items: RawRaindropItem[];
}

export interface RaindropCollectionsResponse {
  result: boolean;
  items: RawRaindropCollection[];
}

export interface RaindropTagsResponse {
  result: boolean;
  items: RawRaindropTag[];
}

export interface RaindropDataPayload {
  configured: boolean;
  summary: RaindropBookmarkDataSummary;
  recent: RaindropBookmark[];
  collections: RaindropCollection[];
  topTags: RaindropTag[];
  source: "api" | "mcp";
  error?: string;
}

export interface RaindropBookmarkDataSummary {
  savedCount: number;
  totalCollections: number;
  totalTags: number;
  recentCount: number;
}
