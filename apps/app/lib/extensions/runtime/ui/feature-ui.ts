import { getFeature } from "@radarboard/feature-sdk/registry";
import type { ComponentType } from "react";
import "@/lib/features";

export function getFeatureUiComponent<TProps>(
  featureId: string,
  componentId: string
): ComponentType<TProps> | null {
  const component = getFeature(featureId)?.ui?.[componentId];
  return component ? (component as ComponentType<TProps>) : null;
}

export function getFeatureResources<TResources>(featureId: string): TResources | null {
  const resources = getFeature(featureId)?.resources;
  return resources ? (resources as TResources) : null;
}
