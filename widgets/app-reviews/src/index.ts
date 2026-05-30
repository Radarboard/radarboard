/**
 * Review Pulse — Widget Descriptor
 */

import { API_ROUTES } from "@radarboard/types/api-routes";
import {
  buildTemplateRecipe,
  type TemplateRecipeModel,
  TemplateWidget,
  TemplateWidgetExpanded,
  type WidgetTemplateConfig,
} from "@radarboard/widget-engine/templates";
import type { WidgetDescriptor, WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { createElement } from "react";

const REVIEW_PULSE_RECIPE: TemplateRecipeModel = {
  kind: "rail_content",
  summary: [],
  railWidth: 208,
  rail: [
    {
      type: "overview-panel",
      eyebrow: "App Reviews",
      titleSource: { sourceId: "app-store", field: "appName" },
      metricLabel: "Rating",
      metricSource: { sourceId: "app-store", field: "averageRating", format: "number" },
      metricToneSource: { sourceId: "app-store", field: "averageRatingTone" },
      badgeSource: { sourceId: "app-store", field: "reviewPressureLabel" },
      badgeToneSource: { sourceId: "app-store", field: "reviewPressureTone" },
      descriptionSource: { sourceId: "app-store", field: "reviewSummaryText" },
      rows: [
        { label: "Reviews", source: { sourceId: "app-store", field: "totalReviewsLabel" } },
        {
          label: "Low",
          source: { sourceId: "app-store", field: "recentNegativeReviews", format: "number" },
        },
        {
          label: "Positive",
          source: { sourceId: "app-store", field: "recentPositiveReviews", format: "number" },
        },
      ],
      footerStart: { sourceId: "app-store", field: "latestVersion" },
      footerEnd: { sourceId: "app-store", field: "latestVersionMeta" },
    },
  ],
  content: [
    {
      type: "row-list",
      source: { sourceId: "app-store", field: "reviews" },
      emptyMessage: "App Store Connect not configured or no reviews yet",
      itemTemplate: {
        title: { sourceId: "app-store", field: "titleText" },
        subtitle: { sourceId: "app-store", field: "subtitleText" },
        value: { sourceId: "app-store", field: "ratingLabel" },
        timestamp: { sourceId: "app-store", field: "timestampLabel" },
        badge: {
          label: { sourceId: "app-store", field: "ratingLabel" },
          color: { sourceId: "app-store", field: "ratingColor" },
        },
      },
    },
  ],
};

const REVIEW_PULSE_EXPANDED_RECIPE: TemplateRecipeModel = {
  ...REVIEW_PULSE_RECIPE,
  railWidth: 224,
};

export const REVIEW_PULSE_TEMPLATE_CONFIG: WidgetTemplateConfig = {
  dataSources: [{ id: "app-store" }],
  recipe: REVIEW_PULSE_RECIPE,
  sections: buildTemplateRecipe(REVIEW_PULSE_RECIPE),
  expandedRecipe: REVIEW_PULSE_EXPANDED_RECIPE,
  expandedSections: buildTemplateRecipe(REVIEW_PULSE_EXPANDED_RECIPE),
};

function isTemplateConfig(config: unknown): config is WidgetTemplateConfig {
  return (
    config !== null &&
    typeof config === "object" &&
    Array.isArray((config as WidgetTemplateConfig).dataSources) &&
    Array.isArray((config as WidgetTemplateConfig).sections)
  );
}

function ReviewPulseModule(props: WidgetRenderProps<WidgetTemplateConfig>) {
  return createElement(TemplateWidget, {
    ...props,
    config: isTemplateConfig(props.config) ? props.config : REVIEW_PULSE_TEMPLATE_CONFIG,
  });
}

function ReviewPulseExpandedModule(props: WidgetRenderProps<WidgetTemplateConfig>) {
  return createElement(TemplateWidgetExpanded, {
    ...props,
    config: isTemplateConfig(props.config) ? props.config : REVIEW_PULSE_TEMPLATE_CONFIG,
  });
}

export const reviewPulseDescriptor: WidgetDescriptor<WidgetTemplateConfig> = {
  id: "app-reviews",
  name: "App Reviews",
  description: "App Store rating pressure, summaries, and recent customer reviews",
  catalogCategory: "product",
  capabilities: [
    {
      id: "app-reviews",
      role: "canonical",
      providers: [{ integration: "app-store-connect", action: "data" }],
    },
  ],
  requiredIntegrations: ["appStoreConnect"],
  defaultSlot: "slot8",
  component: ReviewPulseModule,
  expandedComponent: ReviewPulseExpandedModule,
  defaultConfig: REVIEW_PULSE_TEMPLATE_CONFIG,
  visualEditor: {
    kind: "template",
    getConfig: ({ config }) => (isTemplateConfig(config) ? config : REVIEW_PULSE_TEMPLATE_CONFIG),
    setConfig: ({ editorConfig }) => editorConfig as WidgetTemplateConfig,
  },
  polling: { sourceIds: ["app-store"] },
  defaultPollInterval: 900_000,
  auth: {
    id: "app-store-connect",
    name: "App Store Connect",
    type: "api_key",
    fields: [
      { key: "keyId", label: "Key ID", type: "text", placeholder: "" },
      { key: "issuerId", label: "Issuer ID", type: "text", placeholder: "" },
      { key: "privateKey", label: "Private Key (.p8)", type: "file", accept: ".p8,.pem" },
    ],
    testEndpoint: API_ROUTES.credentialsTest,
    docsUrl:
      "https://developer.apple.com/documentation/appstoreconnectapi/creating_api_keys_for_app_store_connect_api",
  },
};

export const appReviewsDescriptor = reviewPulseDescriptor;
