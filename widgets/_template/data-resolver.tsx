"use client";

import {
  type DataSourceResolverProps,
  registerTemplateDataSource,
  reportResolverState,
} from "@radarboard/widget-sdk/data-source-registry";
import { use__WIDGET_PASCAL__ } from "./hooks/use-__WIDGET_KEBAB__";

function __widgetPascalResolver({ config, onData }: DataSourceResolverProps) {
  const { data, error, isLoading } = use__WIDGET_PASCAL__(config?.projectSlug ?? null);

  reportResolverState(onData, "__WIDGET_KEBAB__", {
    loading: isLoading,
    error: error?.message ?? null,
    configured: true,
    fetchedAt: null,
    stale: false,
    data: data ? { items: [] } : null,
  });

  return null;
}

registerTemplateDataSource("__WIDGET_KEBAB__", __widgetPascalResolver);
