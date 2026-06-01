"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import type { WidgetTemplateConfig } from "@radarboard/widget-engine/templates";
import { createTemplateDescriptor } from "@radarboard/widget-engine/templates/create-template-descriptor";

export const RAINDROP_TEMPLATE_CONFIG: WidgetTemplateConfig = {
  dataSources: [{ id: "raindrop" }],
  sections: [
    {
      type: "alert",
      severity: "setup",
      source: { sourceId: "raindrop", field: "setupMessage" },
      condition: {
        source: { sourceId: "raindrop", field: "configured" },
        operator: "eq",
        value: false,
      },
      message: "{{value}}",
    },
    {
      type: "alert",
      severity: "error",
      source: { sourceId: "raindrop", field: "errorMessage" },
      condition: {
        source: { sourceId: "raindrop", field: "errorPresent" },
        operator: "eq",
        value: true,
      },
      message: "{{value}}",
    },
    {
      type: "kpi-row",
      columns: 4,
      variant: "compact",
      metrics: [
        {
          label: "Saved",
          source: { sourceId: "raindrop", field: "summary.savedCount", format: "number" },
        },
        {
          label: "Collections",
          source: { sourceId: "raindrop", field: "summary.totalCollections", format: "number" },
        },
        {
          label: "Tags",
          source: { sourceId: "raindrop", field: "summary.totalTags", format: "number" },
        },
        {
          label: "Recent",
          source: { sourceId: "raindrop", field: "summary.recentCount", format: "number" },
        },
      ],
    },
    {
      type: "list",
      source: { sourceId: "raindrop", field: "recent" },
      layout: "inline",
      inlineHeader: {
        title: "Bookmark",
        subtitle: "Domain",
        value: "Collection",
        timestamp: "Saved",
        gridTemplateColumns: "minmax(0,1fr) 140px 140px 72px",
      },
      maxItems: 25,
      emptyMessage: "No recent bookmarks",
      hrefSource: { sourceId: "raindrop", field: "link" },
      hrefTarget: "_blank",
      selection: {
        selectionId: "raindrop.bookmark",
        keyField: "key",
        detailRendererId: "raindrop.bookmark",
        dialog: { size: "md" },
      },
      itemTemplate: {
        title: { sourceId: "raindrop", field: "title" },
        subtitle: { sourceId: "raindrop", field: "domainLabel" },
        value: { sourceId: "raindrop", field: "collectionTitle" },
        timestamp: { sourceId: "raindrop", field: "savedAgo" },
      },
    },
  ],
  expandedSections: [
    {
      type: "alert",
      severity: "setup",
      source: { sourceId: "raindrop", field: "setupMessage" },
      condition: {
        source: { sourceId: "raindrop", field: "configured" },
        operator: "eq",
        value: false,
      },
      message: "{{value}}",
    },
    {
      type: "alert",
      severity: "error",
      source: { sourceId: "raindrop", field: "errorMessage" },
      condition: {
        source: { sourceId: "raindrop", field: "errorPresent" },
        operator: "eq",
        value: true,
      },
      message: "{{value}}",
    },
    {
      type: "kpi-row",
      columns: 4,
      metrics: [
        {
          label: "Saved",
          source: { sourceId: "raindrop", field: "summary.savedCount", format: "number" },
        },
        {
          label: "Collections",
          source: { sourceId: "raindrop", field: "summary.totalCollections", format: "number" },
        },
        {
          label: "Tags",
          source: { sourceId: "raindrop", field: "summary.totalTags", format: "number" },
        },
        {
          label: "Recent",
          source: { sourceId: "raindrop", field: "summary.recentCount", format: "number" },
        },
      ],
    },
    {
      type: "tabs",
      defaultTab: "recent",
      tabs: [
        {
          id: "recent",
          label: "Recent",
          countSource: { sourceId: "raindrop", field: "summary.recentCount", format: "number" },
          sections: [
            {
              type: "tabs",
              variant: "compact",
              defaultTab: "cards",
              queryParam: "raindropView",
              tabs: [
                {
                  id: "cards",
                  label: "Cards",
                  sections: [
                    {
                      type: "card-list",
                      source: { sourceId: "raindrop", field: "recent" },
                      titleSource: { sourceId: "raindrop", field: "title" },
                      subtitleSource: { sourceId: "raindrop", field: "domainLabel" },
                      descriptionSource: { sourceId: "raindrop", field: "excerpt" },
                      imageSource: { sourceId: "raindrop", field: "coverUrl" },
                      badgeSource: { sourceId: "raindrop", field: "collectionTitle" },
                      minCardWidth: 240,
                      searchable: true,
                      filterPlaceholder: "Filter bookmark cards…",
                      emptyMessage: "No bookmark cards in the current window",
                      selection: {
                        selectionId: "raindrop.bookmark",
                        keyField: "key",
                        detailRendererId: "raindrop.bookmark",
                        dialog: { size: "md" },
                      },
                      meta: [
                        {
                          label: "Saved",
                          source: {
                            sourceId: "raindrop",
                            field: "created",
                            format: "relative-time",
                          },
                        },
                      ],
                    },
                  ],
                },
                {
                  id: "table",
                  label: "Table",
                  sections: [
                    {
                      type: "table",
                      source: { sourceId: "raindrop", field: "recent" },
                      searchable: true,
                      defaultSort: { key: "created", direction: "desc" },
                      emptyMessage: "No bookmarks in the current window",
                      selection: {
                        selectionId: "raindrop.bookmark",
                        keyField: "key",
                        detailRendererId: "raindrop.bookmark",
                        dialog: { size: "md" },
                      },
                      columns: [
                        { key: "title", header: "Bookmark", sortable: true },
                        { key: "domainLabel", header: "Domain", sortable: true },
                        { key: "collectionTitle", header: "Collection", sortable: true },
                        {
                          key: "created",
                          header: "Saved",
                          sortable: true,
                          format: "relative-time",
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: "collections",
          label: "Collections",
          countSource: {
            sourceId: "raindrop",
            field: "summary.totalCollections",
            format: "number",
          },
          sections: [
            {
              type: "table",
              source: { sourceId: "raindrop", field: "collections" },
              searchable: true,
              defaultSort: { key: "count", direction: "desc" },
              emptyMessage: "No collections found",
              selection: {
                selectionId: "raindrop.collection",
                keyField: "key",
                detailRendererId: "raindrop.collection",
                dialog: { size: "sm" },
              },
              columns: [
                { key: "title", header: "Collection", sortable: true },
                { key: "count", header: "Bookmarks", sortable: true, format: "number" },
                {
                  key: "lastUpdate",
                  header: "Updated",
                  sortable: true,
                  format: "relative-time",
                },
              ],
            },
            {
              type: "list",
              source: { sourceId: "raindrop", field: "topTags" },
              emptyMessage: "No tags found",
              maxItems: 8,
              itemTemplate: {
                title: { sourceId: "raindrop", field: "name" },
                value: { sourceId: "raindrop", field: "count", format: "number" },
              },
            },
          ],
        },
      ],
    },
  ],
};

export const raindropDescriptor = createTemplateDescriptor(
  "bookmarks",
  "Bookmarks",
  "Recent bookmarks, collections, and tagged references",
  RAINDROP_TEMPLATE_CONFIG,
  {
    catalogCategory: "product",
    capabilities: [
      {
        id: "bookmarks",
        role: "canonical",
        providers: [{ integration: "raindrop", action: "data" }],
      },
    ],
    defaultSlot: "slot9",
    defaultPollInterval: 300_000,
    pollingSourceIds: ["bookmarks"],
    auth: {
      id: "raindrop",
      name: "Raindrop",
      type: "api_key",
      fields: [
        {
          key: "accessToken",
          label: "Access Token",
          type: "password",
          placeholder: "",
        },
      ],
      testEndpoint: API_ROUTES.credentialsTest,
      docsUrl: "https://developer.raindrop.io/v1/authentication/token",
    },
  }
);

export const bookmarksDescriptor = raindropDescriptor;
