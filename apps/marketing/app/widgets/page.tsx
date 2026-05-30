import type { Metadata } from "next";
import { CatalogHero } from "@/components/catalog-hero";
import { CTABanner } from "@/components/cta-banner";
import { WidgetCard } from "@/components/widget-card";
import { site } from "@/data/site";
import { widgets } from "@/data/widgets";
import { getDesktopReleaseAction, getDesktopReleaseState } from "@/lib/desktop-releases";

export const metadata: Metadata = {
  title: "Widgets",
  description: `All widgets available in ${site.name}. Drag, drop, and resize to build your dashboard.`,
};

const starterBoards = [
  {
    title: "Maintainer board",
    description: "Releases, stars, sponsors, packages, and issues.",
    widgets: ["Shipping", "GitHub Stars", "Sponsorship"],
  },
  {
    title: "Creator board",
    description: "Audience growth, sponsorship, SEO, and publishing signals.",
    widgets: ["Analytics", "Sponsorship", "SEO Performance"],
  },
  {
    title: "Launch board",
    description: "Revenue, deploys, roadmap, and service health.",
    widgets: ["Revenue", "Shipping", "Service Monitor"],
  },
] as const;

const categories = Array.from(new Set(widgets.map((widget) => widget.category)));

/* biome-ignore lint/style/noDefaultExport: Next.js app routes require a default export. */
export default async function WidgetsPage() {
  const desktopReleaseState = await getDesktopReleaseState();
  const desktopReleaseAction = getDesktopReleaseAction(desktopReleaseState);

  return (
    <>
      <CatalogHero
        countLabel={`${widgets.length} widgets`}
        title="Build your operating board."
        subtitle="Use only the signals that matter."
        description="Combine widgets into focused boards for launches, revenue, open source, creator growth, and day-to-day operations."
        stats={[
          { label: "Categories", value: `${categories.length} widget groups` },
          { label: "Works for", value: site.audiencesLabel },
        ]}
      />

      <section className="pb-16">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="mb-6">
            <div className="mono-label text-accent-light">STARTER BOARDS</div>
            <div className="mt-2 font-semibold text-foreground text-w-xl">
              See how widgets turn into real operating views
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {starterBoards.map((board) => (
              <article
                key={board.title}
                className="overflow-hidden border border-border bg-surface p-5"
              >
                <div className="mono-label text-accent-light">Layout idea</div>
                <h2 className="mt-3 font-semibold text-foreground text-w-lg">{board.title}</h2>
                <p className="mt-3 text-muted text-w-sm leading-relaxed">{board.description}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {board.widgets.map((widget) => (
                    <span
                      key={widget}
                      className="border border-border bg-background px-2.5 py-1 font-mono text-foreground text-w-xs"
                    >
                      {widget}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <div className="mono-label text-accent-light">WIDGET CATALOG</div>
              <div className="mt-2 font-semibold text-foreground text-w-xl">
                Browse by role, not just by name
              </div>
            </div>
            <span className="border border-border bg-surface-raised px-3 py-1.5 font-mono text-muted text-w-xs">
              Drag, drop, resize
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {widgets.map((widget) => (
              <WidgetCard key={widget.slug} widget={widget} />
            ))}
          </div>
        </div>
      </section>

      <CTABanner releaseAction={desktopReleaseAction} />
    </>
  );
}
