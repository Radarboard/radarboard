"use client";

import {
  type DataSourceResolverProps,
  registerTemplateDataSource,
  reportResolverState,
} from "@radarboard/widget-sdk/data-source-registry";
import { useEffect } from "react";
import { useGenericRest } from "./hooks/use-generic-rest";
import type { GenericRestBinding } from "./types";

function GenericRestResolver({ projectSlug, config, onState }: DataSourceResolverProps) {
  const binding = (config ?? {}) as GenericRestBinding;
  const { data, error, isLoading, refetch } = useGenericRest(
    binding.integrationId ?? null,
    binding.dataSourceAction ?? "data",
    projectSlug
  );

  const fetchedAt = (data as { _fetchedAt?: number } | null)?._fetchedAt ?? null;

  useEffect(() => {
    reportResolverState(onState, {
      data,
      loading: isLoading,
      error,
      fetchedAt,
      refetch,
    });
  }, [data, isLoading, error, fetchedAt, refetch, onState]);

  return null;
}

registerTemplateDataSource("generic-rest", GenericRestResolver);
