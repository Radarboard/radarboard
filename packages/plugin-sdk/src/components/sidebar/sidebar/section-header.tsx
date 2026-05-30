"use client";

import type React from "react";

export interface SectionHeaderProps {
  label: string;
}

/** Simple section label for sidebar navigation groups. */
export function SidebarSectionHeader({ label }: SectionHeaderProps) {
  return (
    <div className="px-3 py-1 font-mono text-dim text-w-xs uppercase tracking-widest">{label}</div>
  );
}

export interface SidebarSectionProps {
  /** Section title */
  title: string;
  /** Optional action button/control in the header (e.g. create button) */
  action?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Sidebar section with title and optional action slot.
 *
 * Provides consistent section layout used across all plugin sidebars:
 * ```
 * [TITLE]                 [action]
 * [children items]
 * ```
 */
export function SidebarSection({ title, action, children }: SidebarSectionProps) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between px-3 py-1">
        <span className="font-mono text-dim text-w-xs uppercase tracking-widest">{title}</span>
        {action}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
