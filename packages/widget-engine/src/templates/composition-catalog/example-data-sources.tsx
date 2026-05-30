"use client";

import { type DataSourceResolverProps, registerTemplateDataSource } from "@radarboard/widget-sdk";
import { useEffect } from "react";

function createStaticResolver(data: unknown) {
  return function StaticResolver({ onState }: DataSourceResolverProps) {
    useEffect(() => {
      onState({
        data,
        fetchedAt: 1_700_000_000,
        refetch: null,
        loading: false,
        error: null,
      });
    }, [onState]);

    return null;
  };
}

registerTemplateDataSource(
  "example.revenue",
  createStaticResolver({
    revenue: 12950,
    mrr: 6480,
    customers: 812,
    growth: 0.12,
  })
);

registerTemplateDataSource(
  "example.analytics",
  createStaticResolver({
    liveVisitors: 18,
    sessions: 4200,
    pages: 12890,
    topPages: [
      { path: "/pricing", sessions: 1200 },
      { path: "/docs", sessions: 980 },
      { path: "/blog", sessions: 720 },
    ],
    trend: [
      { date: "Mon", value: 1100 },
      { date: "Tue", value: 1320 },
      { date: "Wed", value: 1180 },
      { date: "Thu", value: 1490 },
    ],
  })
);

registerTemplateDataSource("example.logs", createStaticResolver({}));

registerTemplateDataSource(
  "example.reviews",
  createStaticResolver({
    appName: "Goshuin Atlas",
    rating: 4.7,
    risk: "elevated",
    summary: "Users praise the design, but mention onboarding friction.",
    recentReviews: [
      {
        title: "Excellent shrine tracker",
        reviewer: "david",
        ratingLabel: "5★",
        timestampLabel: "1h ago",
      },
      {
        title: "Solid update",
        reviewer: "alex",
        ratingLabel: "4★",
        timestampLabel: "4h ago",
      },
    ],
  })
);

registerTemplateDataSource(
  "example.sentry",
  createStaticResolver({
    issueCount: 14,
    trend: [
      { date: "Mon", value: 4 },
      { date: "Tue", value: 6 },
      { date: "Wed", value: 5 },
      { date: "Thu", value: 9 },
    ],
    issues: [
      { title: "OAuth callback failed", culprit: "app/api/auth", count: 12 },
      { title: "Webhook timeout", culprit: "api/webhooks", count: 7 },
    ],
  })
);

registerTemplateDataSource(
  "example.health",
  createStaticResolver({
    upCount: 7,
    incidentCount: 1,
    checks: [
      { name: "API", status: "operational", responseTimeMs: 184 },
      { name: "Worker", status: "operational", responseTimeMs: 142 },
    ],
    incidents: [{ name: "Stripe degraded", cause: "upstream delay" }],
  })
);
