export const APP_SHORTCUT_ACTION_IDS = [
  "search",
  "assistant",
  "notifications",
  "edit-layout",
  "open-settings",
  "show-focus-window",
] as const;

export type AppShortcutActionId = (typeof APP_SHORTCUT_ACTION_IDS)[number];

export interface ShortcutBindingConfig {
  /**
   * Binding string in TanStack/Tauri-compatible normalized format.
   * Example: "Mod+Shift+N".
   */
  shortcut?: string | null;
  /**
   * Whether the binding should attempt desktop-global registration in Tauri.
   * Ignored on the web and for actions that do not support global registration.
   */
  desktopGlobal?: boolean;
}

export type AppShortcutPreferencesConfig = Partial<
  Record<AppShortcutActionId, ShortcutBindingConfig>
>;
