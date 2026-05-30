export interface RaindropSummary {
  savedCount: number;
  totalCollections: number;
  totalTags: number;
  recentCount: number;
}

export interface RaindropBookmark {
  id: number;
  title: string;
  excerpt: string;
  link: string;
  domain: string;
  created: string;
  lastUpdate: string;
  tags: string[];
  important: boolean;
  collectionId: number | null;
  collectionTitle: string;
  collectionUrl: string | null;
  raindropUrl: string;
  coverUrl: string | null;
}

export interface RaindropCollection {
  id: number;
  title: string;
  count: number;
  color: string | null;
  parentId: number | null;
  lastUpdate: string;
  collectionUrl: string;
}

export interface RaindropTag {
  name: string;
  count: number;
}

export interface RaindropOverview {
  summary: RaindropSummary;
  recent: RaindropBookmark[];
  collections: RaindropCollection[];
  topTags: RaindropTag[];
  source: "api" | "mcp";
}

export interface RaindropResponse extends RaindropOverview {
  configured: boolean;
  error?: string;
  _fetchedAt?: number;
  _stale?: boolean;
}
