import type { Metadata } from "next";
import { CTABanner } from "@/components/cta-banner";
import { HeroProductTabs } from "@/components/hero-product-tabs";
import { integrations } from "@/data/integrations";
import { site } from "@/data/site";
import { widgets } from "@/data/widgets";
import { getDesktopReleaseAction, getDesktopReleaseState } from "@/lib/desktop-releases";

const operatingModes = [
  {
    label: "macOS app",
    title: "Install Radarboard as a macOS-first desktop app",
    description:
      "The production path starts with a Tauri app that runs the Radarboard server locally and opens in a native OS window.",
  },
  {
    label: "Homebrew",
    title: "Make installation scriptable after the signed release",
    description:
      "A cask should follow the first credible desktop channel so operators can install and update Radarboard like the rest of their tools.",
  },
  {
    label: "Hosted / custom",
    title: "Grow beyond one machine",
    description:
      "Hosted and custom versions make sense when teams need shared access, internal integrations, or managed setup.",
  },
] as const;

const usageTracks = [
  {
    title: "Open-source maintainers",
    description:
      "GitHub activity, npm downloads, sponsorship, releases, stars, issues, and backlog signals in one place.",
  },
  {
    title: "Developers and DevOps",
    description:
      "Deployments, logs, uptime, Sentry issues, service health, pull requests, and release risk stay visible.",
  },
  {
    title: "Marketing and growth",
    description:
      "SEO queries, web analytics, App Store reviews, ASO keywords, audience movement, and conversion signals sit near the work.",
  },
  {
    title: "Founders and teams",
    description:
      "Revenue, roadmap, release activity, customer-facing quality, and operating cadence become one board instead of a stack of tabs.",
  },
] as const;

const highlightedWidgets = widgets.slice(0, 8);
const highlightedIntegrations = integrations.slice(0, 12);

export const metadata: Metadata = {
  title: `${site.name} | ${site.tagline}`,
  description: site.description,
};

/* biome-ignore lint/style/noDefaultExport: Next.js app routes require a default export. */
export default async function HomePage() {
  const desktopReleaseState = await getDesktopReleaseState();
  const desktopReleaseAction = getDesktopReleaseAction(desktopReleaseState);

  return (
    <>
      <section className="hero-stage border-border border-b">
        <div className="mx-auto max-w-7xl px-4 pt-28 pb-12 md:px-8 md:pt-32">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
            <div className="min-w-0 lg:col-span-8">
              <p className="eyebrow text-accent">Radarboard / local-first signal board</p>
              <h1 className="mt-5 max-w-5xl font-semibold text-foreground text-w-xl leading-tight md:text-w-2xl">
                A desktop board for the work you run across code, ops, and growth.
              </h1>
            </div>
            <div className="min-w-0 lg:col-span-4">
              <p className="text-muted text-w-lg leading-relaxed">
                Radarboard brings GitHub, revenue, incidents, reviews, SEO, releases, and roadmap
                signals into one macOS-first local app for builders who need fewer tabs and clearer
                daily context.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                <a
                  href={desktopReleaseAction.href}
                  target={desktopReleaseAction.external ? "_blank" : undefined}
                  rel={desktopReleaseAction.external ? "noopener noreferrer" : undefined}
                  className="inline-flex min-h-11 items-center justify-center border border-accent bg-accent px-5 font-medium text-background text-w-sm transition-interactive hover:bg-accent-light"
                >
                  {desktopReleaseAction.label}
                </a>
                <a
                  href={site.links.docs}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center justify-center border border-border bg-surface px-5 font-medium text-foreground text-w-sm transition-interactive hover:border-accent hover:text-accent"
                >
                  Read setup docs
                </a>
              </div>
              <p className="mt-3 text-muted text-w-xs">{desktopReleaseAction.caption}</p>
              <p className="mt-1 text-muted text-w-xs">{site.platform.availabilityNote}</p>
            </div>
          </div>

          <div className="mt-10 grid gap-px overflow-hidden border border-border bg-border md:grid-cols-4">
            {[
              ["Maintain", "GitHub, releases, issues, npm, sponsors"],
              ["Operate", "Sentry, logs, uptime, deploys, reviews"],
              ["Grow", "Revenue, analytics, SEO, ASO, audience"],
              ["Ship", "Roadmap, tasks, changelog, launch loops"],
            ].map(([label, value]) => (
              <div key={label} className="bg-background p-4">
                <p className="mono-label text-accent">{label}</p>
                <p className="mt-2 text-muted text-w-sm leading-relaxed">{value}</p>
              </div>
            ))}
          </div>

          <HeroProductTabs />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-20 md:px-8 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-5">
          <p className="eyebrow text-accent">Who it is for</p>
          <h2 className="mt-4 font-semibold text-foreground text-w-xl leading-tight">
            Different roles, same problem: the signals are scattered.
          </h2>
        </div>
        <div className="min-w-0 lg:col-span-7">
          <div className="grid gap-px overflow-hidden border border-border bg-border">
            {usageTracks.map((item) => (
              <article key={item.title} className="grid bg-surface md:grid-cols-12">
                <h3 className="border-border border-b p-5 font-semibold text-foreground text-w-base md:col-span-4 md:border-r md:border-b-0">
                  {item.title}
                </h3>
                <p className="p-5 text-muted text-w-sm leading-relaxed md:col-span-8">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="paths" className="mx-auto max-w-7xl px-4 py-20 md:px-8">
        <div className="mb-8 grid gap-5 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="eyebrow text-accent">How it grows</p>
            <h2 className="mt-4 font-semibold text-foreground text-w-xl leading-tight">
              Start as a macOS app. Grow only when sharing becomes the job.
            </h2>
          </div>
          <p className="text-muted text-w-base leading-relaxed lg:col-span-5 lg:col-start-8">
            The desktop app is the proof. Homebrew, hosted, and custom paths should extend that same
            installed board idea, not turn Radarboard into another generic cloud dashboard.
          </p>
        </div>

        <div className="grid gap-px overflow-hidden border border-border bg-border md:grid-cols-3">
          {operatingModes.map((mode) => (
            <article key={mode.label} className="bg-background p-6 md:p-7">
              <p className="mono-label text-accent">{mode.label}</p>
              <h3 className="mt-4 font-semibold text-foreground text-w-lg">{mode.title}</h3>
              <p className="mt-4 text-muted text-w-sm leading-relaxed">{mode.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-20 md:px-8 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <div className="media-placeholder flex min-h-media flex-col justify-between border border-border bg-surface p-5">
            <div className="flex items-center justify-between gap-4">
              <p className="mono-label text-muted">video slot</p>
              <p className="text-muted text-w-xs">ideal asset: 45-60 sec workflow loop</p>
            </div>
            <div>
              <p className="max-w-xl font-semibold text-foreground text-w-xl leading-tight">
                Show the daily scan: connect a source, add widgets, catch a change, act.
              </p>
              <p className="mt-4 max-w-2xl text-muted text-w-sm leading-relaxed">
                Placeholder for a real walkthrough video or sharper app capture across maintainer,
                DevOps, growth, and founder workflows.
              </p>
            </div>
          </div>
        </div>

        <div className="min-w-0 lg:col-span-5">
          <p className="eyebrow text-accent">Widgets</p>
          <h2 className="mt-4 font-semibold text-foreground text-w-xl leading-tight">
            Every block answers a job.
          </h2>
          <p className="mt-5 text-muted text-w-base leading-relaxed">
            Widgets keep the board focused: what released, what broke, what grew, what earned, what
            people are saying, and what needs attention next.
          </p>
          <div className="mt-7 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2">
            {highlightedWidgets.map((widget) => (
              <article key={widget.slug} className="bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-medium text-foreground text-w-sm">{widget.name}</h3>
                  <span className="shrink-0 text-muted text-w-xs">{widget.category}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-muted text-w-xs leading-relaxed">
                  {widget.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-20 md:px-8 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-4">
          <p className="eyebrow text-accent">Integrations</p>
          <h2 className="mt-4 font-semibold text-foreground text-w-xl leading-tight">
            Keep the source tools. Change the operating view.
          </h2>
          <p className="mt-5 text-muted text-w-base leading-relaxed">
            Radarboard works because it sits above the services people already use instead of asking
            them to rebuild their work around a new system.
          </p>
        </div>

        <div className="min-w-0 lg:col-span-8">
          <div className="integration-matrix grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {highlightedIntegrations.map((integration) => (
              <article key={integration.slug} className="bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-medium text-foreground text-w-sm">{integration.name}</h3>
                  <span className="h-2 w-2 shrink-0 bg-accent" />
                </div>
                <p className="mt-3 text-muted text-w-xs leading-relaxed">
                  {integration.signals.join(" / ")}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 md:px-8">
        <div className="grid gap-8 border border-border bg-surface p-6 md:grid-cols-12 md:p-8">
          <div className="md:col-span-7">
            <p className="eyebrow text-accent">Next step</p>
            <h2 className="mt-4 font-semibold text-foreground text-w-xl leading-tight">
              Join the macOS beta. Build the board around your role.
            </h2>
          </div>
          <div className="md:col-span-5">
            <p className="text-muted text-w-base leading-relaxed">
              Connect one source, place the widgets you actually check, and decide whether
              Radarboard belongs in your working routine. Hosted and custom work can grow from that
              same foundation.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">
              <a
                href={desktopReleaseAction.href}
                target={desktopReleaseAction.external ? "_blank" : undefined}
                rel={desktopReleaseAction.external ? "noopener noreferrer" : undefined}
                className="inline-flex min-h-11 items-center justify-center border border-accent bg-accent px-5 font-medium text-background text-w-sm transition-interactive hover:bg-accent-light"
              >
                {desktopReleaseAction.label}
              </a>
              <a
                href={site.links.github}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center border border-border bg-background px-5 font-medium text-foreground text-w-sm transition-interactive hover:border-accent hover:text-accent"
              >
                Open repository
              </a>
            </div>
            <p className="mt-3 text-muted text-w-xs">{desktopReleaseAction.caption}</p>
            <p className="mt-1 text-muted text-w-xs">{site.platform.availabilityNote}</p>
          </div>
        </div>
      </section>

      <CTABanner releaseAction={desktopReleaseAction} />
    </>
  );
}
