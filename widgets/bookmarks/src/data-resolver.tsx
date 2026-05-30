"use client";

import type { RaindropResponse } from "@radarboard/types/raindrop";
import { formatTimeAgo } from "@radarboard/utils/format-time-ago";
import {
  type DataSourceResolverProps,
  registerTemplateDataSource,
  reportResolverState,
} from "@radarboard/widget-sdk/data-source-registry";
import { useEffect, useMemo } from "react";
import { useRaindrop } from "./hooks/use-raindrop";

function stripWwwPrefix(domain: string): string {
  return domain.replace(/^www\./i, "");
}

function RaindropResolver({ timeRange = "30d", onState }: DataSourceResolverProps) {
  const { data, fetchedAt, loading, error, refetch } = useRaindrop(timeRange);

  const resolvedData = useMemo<
    RaindropResponse & {
      errorMessage: string;
      errorPresent: boolean;
      setupMessage: string;
      recent: Array<
        RaindropResponse["recent"][number] & {
          key: string;
          domainLabel: string;
          savedAgo: string;
        }
      >;
      collections: Array<
        RaindropResponse["collections"][number] & {
          key: string;
        }
      >;
    }
  >(() => {
    const baseData: RaindropResponse = data ?? {
      configured: true,
      source: "api",
      summary: {
        savedCount: 0,
        totalCollections: 0,
        totalTags: 0,
        recentCount: 0,
      },
      recent: [],
      collections: [],
      topTags: [],
    };

    return {
      ...baseData,
      recent: baseData.recent.map((bookmark) => ({
        ...bookmark,
        key: String(bookmark.id),
        domainLabel: stripWwwPrefix(bookmark.domain),
        savedAgo: formatTimeAgo(bookmark.created),
      })),
      collections: baseData.collections.map((collection) => ({
        ...collection,
        key: String(collection.id),
      })),
      errorMessage: error ?? baseData.error ?? "",
      errorPresent: Boolean(error ?? baseData.error),
      setupMessage: baseData.configured
        ? ""
        : "Raindrop is not configured. Add an access token or connect mcp::raindrop.",
    };
  }, [data, error]);

  useEffect(() => {
    reportResolverState(onState, {
      data: resolvedData,
      fetchedAt,
      refetch,
      loading,
      error,
    });
  }, [resolvedData, fetchedAt, refetch, loading, error, onState]);

  return null;
}

registerTemplateDataSource("raindrop", RaindropResolver);
