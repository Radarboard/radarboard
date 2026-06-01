"use client";

import { cn } from "@radarboard/utils/cn";
import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import {
  DEBUG_SANDBOXES,
  DEBUG_SECTION_GROUPS,
  DEBUG_SECTION_MAP,
  DEBUG_SECTIONS,
  DEFAULT_DEBUG_SECTION,
} from "../registry";

interface DebugShellState {
  activeId: string;
  description: string;
  docsHref: string;
  label: string;
  title: string;
}

export function resolveDebugShellState(pathname: string, tab: string | null): DebugShellState {
  const sandbox = DEBUG_SANDBOXES.find((item) => item.href === pathname);
  if (sandbox) {
    return {
      activeId: sandbox.id,
      description: sandbox.description,
      docsHref: sandbox.docsHref,
      label: sandbox.label,
      title: sandbox.title,
    };
  }

  const sectionId = DEBUG_SECTION_MAP.has(tab ?? "") ? (tab as string) : DEFAULT_DEBUG_SECTION;
  const section = DEBUG_SECTION_MAP.get(sectionId);
  return {
    activeId: sectionId,
    description: section?.description ?? "Inspect Radarboard runtime diagnostics.",
    docsHref: section?.docsHref ?? "https://docs.radarboard.app/developer-guide/debug-panels",
    label: section?.label ?? "Debug",
    title: section?.title ?? "Debug",
  };
}

function navClassName(active: boolean) {
  return cn(
    "flex h-auto w-full items-center gap-2 rounded-none border-l-2 px-4 py-2 text-left font-mono font-normal text-w-sm transition-colors",
    active
      ? "border-accent bg-accent/10 text-foreground"
      : "border-transparent text-dim hover:bg-muted hover:text-foreground-secondary"
  );
}

function DebugSidebar({ activeId }: { activeId: string }) {
  return (
    <nav className="scrollbar-thin w-48 flex-shrink-0 overflow-y-auto border-border border-r py-2">
      {DEBUG_SECTION_GROUPS.map((group) => (
        <div key={group.id}>
          <div className="px-4 py-2 font-mono text-dim text-w-sm uppercase tracking-widest">
            {group.label}
          </div>
          {DEBUG_SECTIONS.filter((section) => section.group === group.id).map((section) => {
            const Icon = section.icon;
            const active = activeId === section.id;
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={navClassName(active)}
                href={`/debug?tab=${section.id}`}
                key={section.id}
              >
                <Icon className="icon-xs flex-shrink-0" />
                {section.label}
              </Link>
            );
          })}
        </div>
      ))}

      <div>
        <div className="px-4 py-2 font-mono text-dim text-w-sm uppercase tracking-widest">
          Dev Sandboxes
        </div>
        {DEBUG_SANDBOXES.map((sandbox) => {
          const Icon = sandbox.icon;
          const active = activeId === sandbox.id;
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={navClassName(active)}
              href={sandbox.href}
              key={sandbox.id}
            >
              <Icon className="icon-xs flex-shrink-0" />
              {sandbox.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function DebugShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const state = resolveDebugShellState(pathname, searchParams.get("tab"));

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background font-mono text-muted-foreground">
      <div className="flex flex-shrink-0 items-center gap-3 border-border border-b px-4 py-2">
        <Link
          className="text-dim text-w-sm uppercase tracking-wider transition-colors hover:text-foreground-secondary"
          href="/"
        >
          ← Dashboard
        </Link>
        <span className="text-border">/</span>
        <Link
          className="text-dim text-w-sm uppercase tracking-wider transition-colors hover:text-foreground-secondary"
          href={`/debug?tab=${DEFAULT_DEBUG_SECTION}`}
        >
          Debug
        </Link>
        <span className="text-border">/</span>
        <span className="text-foreground-secondary text-w-sm uppercase tracking-wider">
          {state.label}
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <DebugSidebar activeId={state.activeId} />
        <main className="scrollbar-thin min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="space-y-5 p-4">
            <header className="flex min-w-0 flex-wrap items-start justify-between gap-4 border-border border-b pb-4">
              <div className="min-w-0 space-y-1">
                <div className="font-mono text-dim text-w-xs uppercase tracking-widest">Debug</div>
                <h1 className="font-semibold text-foreground text-w-2xl">{state.title}</h1>
                <p className="max-w-prose text-muted-foreground text-w-sm leading-relaxed">
                  {state.description}
                </p>
              </div>
              <a
                className="inline-flex flex-shrink-0 items-center gap-1 border border-border px-2 py-1 font-mono text-dim text-w-xs uppercase tracking-wider transition-colors hover:bg-muted hover:text-foreground-secondary"
                href={state.docsHref}
                rel="noreferrer"
                target="_blank"
              >
                Docs
                <ExternalLinkIcon className="icon-xs" />
              </a>
            </header>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
