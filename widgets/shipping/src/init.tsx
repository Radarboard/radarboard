"use client";
import type { ShippingItem } from "@radarboard/types/shipping";
import {
  registerTemplateDetailRenderer,
  type TemplateDetailRendererProps,
} from "@radarboard/widget-sdk/detail-renderer-registry";
import { ShippingDetail } from "./components/shipping-detail";

function ShippingItemDetailRenderer({ item }: TemplateDetailRendererProps<ShippingItem>) {
  return <ShippingDetail item={item} />;
}

export function initializeShippingWidget() {
  registerTemplateDetailRenderer("shipping.item", ShippingItemDetailRenderer);
}
