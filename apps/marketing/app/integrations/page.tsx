import type { Metadata } from "next";
import { CatalogHero } from "@/components/catalog-hero";
import { CTABanner } from "@/components/cta-banner";
import { IntegrationCard } from "@/components/integration-card";
import {
  categoryColorClasses,
  categoryLabels,
  getIntegrationsByCategory,
  type IntegrationCategory,
} from "@/data/integrations";
import { site } from "@/data/site";
import { getDesktopReleaseAction, getDesktopReleaseState } from "@/lib/desktop-releases";

export const metadata: Metadata = {
  title: "Integrations",
  description: `All integrations available in ${site.name}. Connect the services you already use.`,
};

const categoryOrder: IntegrationCategory[] = [
  "revenue",
  "analytics",
  "seo",
  "monitoring",
  "shipping",
  "sponsorship",
  "app-store",
  "distribution",
  "alerts",
];

/* biome-ignore lint/style/noDefaultExport: Next.js app routes require a default export. */
export default async function IntegrationsPage() {
  const grouped = getIntegrationsByCategory();
  const integrationCount = Array.from(grouped.values()).reduce((sum, list) => sum + list.length, 0);
  const desktopReleaseState = await getDesktopReleaseState();
  const desktopReleaseAction = getDesktopReleaseAction(desktopReleaseState);

  return (
    <>
      <CatalogHero
        countLabel={`${integrationCount} integrations`}
        title="Connect your work stack."
        subtitle="See every signal in one place."
        description={`Browse integrations by workflow, then wire the services that already run your revenue, release activity, growth, and operations inside ${site.name}.`}
        stats={[
          { label: "Best for", value: site.audiencesLabel },
          { label: "Auth mix", value: "API, OAuth, MCP, webhooks" },
        ]}
      />

      {categoryOrder.map((categoryKey) => {
        const items = grouped.get(categoryKey);
        if (!items?.length) return null;
        const colorClass = categoryColorClasses[categoryKey];
        return (
          <section key={categoryKey} className="py-12">
            <div className="mx-auto max-w-7xl px-4 md:px-8">
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <div className="mb-3 flex items-center gap-3">
                    <span className={`inline-block size-2 ${colorClass}`} />
                    <h2 className="font-bold text-foreground text-w-xl">
                      {categoryLabels[categoryKey]}
                    </h2>
                  </div>
                  <p className="max-w-2xl text-muted text-w-sm leading-relaxed">
                    {items
                      .map((item) => item.signals[0])
                      .slice(0, 3)
                      .join(", ")}{" "}
                    and the rest of the signals that matter in this part of your workflow.
                  </p>
                </div>
                <span className="border border-border bg-surface-raised px-3 py-1.5 font-mono text-muted text-w-xs">
                  {items.length} services
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((integration) => (
                  <IntegrationCard key={integration.slug} integration={integration} />
                ))}
              </div>
            </div>
          </section>
        );
      })}

      <CTABanner releaseAction={desktopReleaseAction} />
    </>
  );
}
