"use client";

import Image from "next/image";
import { useState } from "react";

const tabs = [
  {
    id: "desktop",
    label: "macOS app",
    title: "A native shell around a local operating board.",
    description:
      "Radarboard is moving toward a Tauri desktop app with a native window, tray behavior, a local sidecar server, and SQLite by default.",
    visual: "desktop",
  },
  {
    id: "maintain",
    label: "Maintain",
    title: "Keep open-source and dev work visible.",
    description:
      "Track GitHub, npm, releases, issues, commits, stars, sponsorship, and project work without living in every tab.",
    visual: "dashboard",
  },
  {
    id: "operate",
    label: "Operate",
    title: "Watch reliability, releases, and incidents.",
    description:
      "Bring Sentry, uptime, logs, deployments, app reviews, and operational signals into a board that stays scan-friendly.",
    visual: "widgets",
  },
  {
    id: "grow",
    label: "Grow",
    title: "Keep growth and business signals near the work.",
    description:
      "Revenue, web analytics, SEO, ASO, sponsors, and audience signals sit beside the technical context that explains them.",
    visual: "dashboard",
  },
  {
    id: "install",
    label: "Install",
    title: "macOS direct download first. Homebrew after the first signed release.",
    description:
      "The release flow should support signed macOS DMGs first, then a Homebrew cask once the public desktop channel is real.",
    visual: "install",
  },
] as const;

type Tab = (typeof tabs)[number];

function TabVisual({ tab }: { tab: Tab }) {
  if (tab.visual === "dashboard") {
    return (
      <Image
        src="/media/radarboard-dashboard.png"
        alt="Radarboard dashboard showing revenue, shipping, growth, and health widgets"
        width={1600}
        height={1000}
        priority
        sizes="(max-width: 1024px) 100vw, 74vw"
        className="h-auto w-full border border-border bg-background"
      />
    );
  }

  if (tab.visual === "widgets") {
    return (
      <Image
        src="/media/radarboard-widgets.png"
        alt="Radarboard widget surfaces rendered from the product component library"
        width={1100}
        height={360}
        sizes="(max-width: 1024px) 100vw, 74vw"
        className="h-auto w-full border border-border bg-background"
      />
    );
  }

  if (tab.visual === "install") {
    return (
      <div className="flex min-h-media flex-col justify-between border border-border bg-background p-5">
        <div className="grid gap-px overflow-hidden border border-border bg-border">
          <div className="bg-surface p-4">
            <p className="mono-label text-muted">direct download</p>
            <p className="mt-2 text-foreground text-w-base">
              Radarboard-[version]-macos-aarch64.dmg
            </p>
          </div>
          <div className="bg-surface p-4">
            <p className="mono-label text-muted">homebrew cask</p>
            <p className="mt-2 text-foreground text-w-base">brew install --cask radarboard</p>
          </div>
          <div className="bg-surface p-4">
            <p className="mono-label text-muted">updates</p>
            <p className="mt-2 text-foreground text-w-base">
              Signed updater metadata from published desktop releases
            </p>
          </div>
        </div>
        <p className="mt-8 text-muted text-w-sm leading-relaxed">
          Placeholder for a release/install video once the first public desktop channel and cask are
          ready.
        </p>
      </div>
    );
  }

  return (
    <div className="media-placeholder flex min-h-media flex-col justify-between border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-4">
        <p className="mono-label text-muted">desktop app slot</p>
        <p className="text-muted text-w-xs">ideal asset: macOS window + tray capture</p>
      </div>
      <div>
        <p className="max-w-xl font-semibold text-foreground text-w-xl leading-tight">
          Show Radarboard as an installed macOS app, not a browser tab.
        </p>
        <p className="mt-4 max-w-2xl text-muted text-w-sm leading-relaxed">
          Placeholder for a real macOS/Tauri app screenshot: native window, tray behavior, local
          server, and the board running with desktop polish.
        </p>
      </div>
    </div>
  );
}

export function HeroProductTabs() {
  const [selectedId, setSelectedId] = useState<Tab["id"]>("maintain");
  const selectedTab = tabs.find((tab) => tab.id === selectedId) ?? tabs[0];

  return (
    <div className="console-shell mt-12 overflow-hidden border border-border bg-background">
      <div
        className="grid gap-px bg-border md:grid-cols-5"
        role="tablist"
        aria-label="Radarboard views"
      >
        {tabs.map((tab) => {
          const selected = tab.id === selectedTab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`min-h-14 bg-background px-4 py-3 text-left text-w-sm transition-interactive ${
                selected ? "text-accent" : "text-muted hover:text-foreground"
              }`}
              onClick={() => setSelectedId(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-px bg-border lg:grid-cols-12">
        <div className="min-w-0 bg-surface-raised p-2 md:p-4 lg:col-span-9">
          <TabVisual tab={selectedTab} />
        </div>
        <aside className="min-w-0 bg-background p-5 lg:col-span-3">
          <p className="eyebrow text-accent">{selectedTab.label}</p>
          <h2 className="mt-5 font-semibold text-foreground text-w-lg leading-tight">
            {selectedTab.title}
          </h2>
          <p className="mt-4 text-muted text-w-sm leading-relaxed">{selectedTab.description}</p>
        </aside>
      </div>
    </div>
  );
}
