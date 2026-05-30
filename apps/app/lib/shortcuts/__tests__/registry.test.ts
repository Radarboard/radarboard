import { describe, expect, it } from "vitest";
import {
  APP_SHORTCUT_DEFINITIONS,
  detectShortcutConflicts,
  resolveAppShortcutBindings,
  toTauriShortcut,
} from "../registry";

describe("shortcut registry", () => {
  it("resolves app defaults when no preferences are set", () => {
    const bindings = resolveAppShortcutBindings(undefined);
    const notifications = bindings.find((binding) => binding.id === "notifications");
    const search = bindings.find((binding) => binding.id === "search");

    expect(search?.shortcut).toBe("Mod+K");
    expect(notifications?.shortcut).toBe("Mod+Shift+N");
    expect(notifications?.desktopGlobal).toBe(true);
  });

  it("supports explicit unassignment via null shortcut overrides", () => {
    const bindings = resolveAppShortcutBindings({
      notifications: { shortcut: null, desktopGlobal: false },
    });
    const notifications = bindings.find((binding) => binding.id === "notifications");

    expect(notifications?.shortcut).toBeNull();
    expect(notifications?.desktopGlobal).toBe(false);
  });

  it("detects duplicate shortcuts across rows", () => {
    const conflicts = detectShortcutConflicts([
      { id: "app:search", shortcut: "Mod+K" },
      { id: "plugin:tasks", shortcut: "Mod+Shift+T" },
      { id: "plugin:notes", shortcut: "Mod+K" },
    ]);

    expect(conflicts).toEqual([{ shortcut: "mod+k", actionIds: ["app:search", "plugin:notes"] }]);
  });

  it("converts Mod bindings to Tauri-compatible strings", () => {
    expect(toTauriShortcut("Mod+Shift+N")).toBe("CmdOrCtrl+Shift+N");
  });

  it("keeps app defaults unique", () => {
    const shortcuts = APP_SHORTCUT_DEFINITIONS.map(
      (definition) => definition.defaultShortcut
    ).filter((shortcut): shortcut is string => Boolean(shortcut));
    expect(new Set(shortcuts).size).toBe(shortcuts.length);
  });
});
