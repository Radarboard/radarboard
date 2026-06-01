/**
 * Shared style constants for plugin UI components.
 *
 * Use these with `cn()` to ensure consistent styling across all plugins.
 * These replace ad-hoc className strings that were previously copy-pasted.
 */
export const PLUGIN_STYLES = {
  /** Primary action button (Create, Save) */
  actionButton:
    "flex items-center gap-1.5 px-3 py-1.5 rounded-item text-w-base font-mono transition-colors",

  /** Destructive action (Delete, Remove) */
  dangerButton: "text-destructive/70 hover:text-destructive hover:bg-destructive/10",

  /** Ghost/subtle button (Close, Toggle) */
  ghostButton: "text-dim hover:text-foreground-secondary hover:bg-surface-raised",

  /** Standard text input */
  input:
    "w-full bg-transparent text-w-sm text-foreground-secondary placeholder:text-dim outline-none",

  /** Search input with icon space */
  searchInput:
    "w-full border border-border bg-surface pl-8 pr-3 py-1.5 text-w-sm text-foreground-secondary outline-none focus:border-accent rounded",

  /** Section header label (FOLDERS, TAGS, etc.) */
  sectionHeader: "text-w-xs font-mono uppercase tracking-widest text-dim",

  /** Small tag/chip */
  tagChip: "border border-border px-1.5 py-0.5 text-w-xs font-mono text-dim rounded-item",

  /** Detail panel field label */
  fieldLabel: "text-w-sm text-dim",

  /** Detail panel field value */
  fieldValue: "text-w-sm text-foreground-secondary",

  /** Metadata text (timestamps, IDs) */
  metaText: "text-w-sm font-mono text-dim",
} as const;
