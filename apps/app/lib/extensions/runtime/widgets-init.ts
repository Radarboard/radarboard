// @generated — do not edit manually. Run `pnpm generate:extensions` to regenerate.

/**
 * Registers all first-party widgets.
 */

// ─── Widget descriptors ──────────────────────────────────────────────────────
import { analyticsDescriptor } from "@radarboard/widget-analytics";
import { initializeAnalyticsWidget } from "@radarboard/widget-analytics/init";
import { asoKeywordsDescriptor } from "@radarboard/widget-aso-keywords";
import { initializeAsoKeywordsWidget } from "@radarboard/widget-aso-keywords/init";
import { buildsDescriptor } from "@radarboard/widget-builds";
import { githubCommitsDescriptor } from "@radarboard/widget-github-commits";
import { deploymentsDescriptor } from "@radarboard/widget-deployments";
import { vercelDomainsDescriptor } from "@radarboard/widget-vercel-domains";
import { npmDownloadsDescriptor } from "@radarboard/widget-npm-downloads";
import { logsDescriptor } from "@radarboard/widget-logs";
import { observabilityDescriptor } from "@radarboard/widget-observability";
import { projectsDescriptor } from "@radarboard/widget-projects";
import { pullsDescriptor } from "@radarboard/widget-pulls";
import { bookmarksDescriptor } from "@radarboard/widget-bookmarks";
import { initializeBookmarksWidget } from "@radarboard/widget-bookmarks/init";
import { revenueDescriptor } from "@radarboard/widget-revenue";
import { appReviewsDescriptor } from "@radarboard/widget-app-reviews";
import { roadmapDescriptor } from "@radarboard/widget-roadmap";
import { seoDescriptor } from "@radarboard/widget-seo";
import { initializeSeoWidget } from "@radarboard/widget-seo/init";
import { shippingDescriptor } from "@radarboard/widget-shipping";
import { initializeShippingWidget } from "@radarboard/widget-shipping/init";
import { sponsorshipDescriptor } from "@radarboard/widget-sponsorship";
import { initializeSponsorshipWidget } from "@radarboard/widget-sponsorship/init";
import { githubStarsDescriptor } from "@radarboard/widget-github-stars";
import { initializeGithubStarsWidget } from "@radarboard/widget-github-stars/init";
import { registerWidget } from "@radarboard/widget-engine/widgets/registry";

// ─── Widget data resolvers (self-registering side effects) ────────────────────
import "@radarboard/widget-analytics/data-resolver";
import "@radarboard/widget-aso-keywords/data-resolver";
import "@radarboard/widget-deployments/data-resolver";
import "@radarboard/widget-npm-downloads/data-resolver";
import "@radarboard/widget-observability/data-resolver";
import "@radarboard/widget-pulls/data-resolver";
import "@radarboard/widget-bookmarks/data-resolver";
import "@radarboard/widget-revenue/data-resolver";
import "@radarboard/widget-roadmap/data-resolver";
import "@radarboard/widget-seo/data-resolver";
import "@radarboard/widget-shipping/data-resolver";
import "@radarboard/widget-sponsorship/data-resolver";
import "@radarboard/widget-github-stars/data-resolver";

export function initializeWidgets() {
  // Register Descriptors
  registerWidget(analyticsDescriptor);
  registerWidget(asoKeywordsDescriptor);
  registerWidget(buildsDescriptor);
  registerWidget(githubCommitsDescriptor);
  registerWidget(deploymentsDescriptor);
  registerWidget(vercelDomainsDescriptor);
  registerWidget(npmDownloadsDescriptor);
  registerWidget(logsDescriptor);
  registerWidget(observabilityDescriptor);
  registerWidget(projectsDescriptor);
  registerWidget(pullsDescriptor);
  registerWidget(bookmarksDescriptor);
  registerWidget(revenueDescriptor);
  registerWidget(appReviewsDescriptor);
  registerWidget(roadmapDescriptor);
  registerWidget(seoDescriptor);
  registerWidget(shippingDescriptor);
  registerWidget(sponsorshipDescriptor);
  registerWidget(githubStarsDescriptor);

  // Initialize Widget-specific logic (Detail Renderers, etc.)
  initializeAnalyticsWidget();
  initializeAsoKeywordsWidget();
  initializeBookmarksWidget();
  initializeSeoWidget();
  initializeShippingWidget();
  initializeSponsorshipWidget();
  initializeGithubStarsWidget();
}
