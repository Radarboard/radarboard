// @generated — do not edit manually. Run `pnpm generate:extensions` to regenerate.

/**
 * Registers all first-party widgets.
 */

// ─── Widget descriptors ──────────────────────────────────────────────────────
import { analyticsDescriptor } from "@radarboard/widget-analytics";
import { initializeAnalyticsWidget } from "@radarboard/widget-analytics/init";
import { bookmarksDescriptor } from "@radarboard/widget-bookmarks";
import { initializeBookmarksWidget } from "@radarboard/widget-bookmarks/init";
import { registerWidget } from "@radarboard/widget-engine/widgets/registry";
import { logsDescriptor } from "@radarboard/widget-logs";
import { observabilityDescriptor } from "@radarboard/widget-observability";
import { revenueDescriptor } from "@radarboard/widget-revenue";
import { roadmapDescriptor } from "@radarboard/widget-roadmap";
import { seoDescriptor } from "@radarboard/widget-seo";
import { initializeSeoWidget } from "@radarboard/widget-seo/init";
import { shippingDescriptor } from "@radarboard/widget-shipping";
import { initializeShippingWidget } from "@radarboard/widget-shipping/init";
import { sponsorshipDescriptor } from "@radarboard/widget-sponsorship";
import { initializeSponsorshipWidget } from "@radarboard/widget-sponsorship/init";

// ─── Widget data resolvers (self-registering side effects) ────────────────────
import "@radarboard/widget-analytics/data-resolver";
import "@radarboard/widget-observability/data-resolver";
import "@radarboard/widget-bookmarks/data-resolver";
import "@radarboard/widget-revenue/data-resolver";
import "@radarboard/widget-roadmap/data-resolver";
import "@radarboard/widget-seo/data-resolver";
import "@radarboard/widget-shipping/data-resolver";
import "@radarboard/widget-sponsorship/data-resolver";

export function initializeWidgets() {
  // Register Descriptors
  registerWidget(analyticsDescriptor);
  registerWidget(logsDescriptor);
  registerWidget(observabilityDescriptor);
  registerWidget(bookmarksDescriptor);
  registerWidget(revenueDescriptor);
  registerWidget(roadmapDescriptor);
  registerWidget(seoDescriptor);
  registerWidget(shippingDescriptor);
  registerWidget(sponsorshipDescriptor);

  // Initialize Widget-specific logic (Detail Renderers, etc.)
  initializeAnalyticsWidget();
  initializeBookmarksWidget();
  initializeSeoWidget();
  initializeShippingWidget();
  initializeSponsorshipWidget();
}
