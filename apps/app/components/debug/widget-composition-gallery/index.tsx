"use client";

import {
  COMPOSITION_EXAMPLES,
  type DataSourceResolverProps,
  registerTemplateDataSource,
  synchronizeTemplateConfig,
  TemplateWidget,
} from "@radarboard/widget-engine/templates";
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

export function WidgetCompositionGallery() {
  return (
    <div className="space-y-5 text-foreground-secondary">
      <div className="grid gap-4 xl:grid-cols-2">
        {COMPOSITION_EXAMPLES.map((example) => {
          const config = synchronizeTemplateConfig(example.config);
          return (
            <section
              key={example.id}
              data-testid={`composition-example-${example.recipeKind}`}
              className="overflow-hidden border border-border bg-surface"
            >
              <div className="border-border border-b px-3 py-2">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-mono text-dim text-w-sm uppercase tracking-wide">
                      {example.recipeKind}
                    </div>
                    <h2 className="mt-1 font-medium text-foreground text-lg">{example.title}</h2>
                  </div>
                  <div className="border border-border px-2 py-0.5 font-mono text-dim/80 text-w-sm uppercase tracking-wide">
                    v{config.version}
                  </div>
                </div>
                <ul className="mt-3 space-y-1 text-dim/80 text-w-xs">
                  {example.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
              <div className="overflow-hidden p-3" style={{ height: 360 }}>
                <div className="h-full overflow-hidden border border-border bg-surface-raised">
                  <TemplateWidget
                    widgetId={`gallery:${example.id}`}
                    projectSlug={null}
                    config={config}
                  />
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
