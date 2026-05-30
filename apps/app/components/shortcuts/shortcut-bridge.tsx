"use client";

import { useDashboard } from "@radarboard/hooks/use-dashboard";
import { getAllPlugins } from "@radarboard/plugin-sdk/registry";
import type { PluginUserConfig } from "@radarboard/plugin-sdk/types";
import { getHotkeyManager } from "@tanstack/react-hotkeys";
import { useEffect, useMemo } from "react";
import { isTauri } from "@/lib/platform";
import {
  resolveAppShortcutBindings,
  resolvePluginShortcutBinding,
  toTauriShortcut,
} from "@/lib/shortcuts/registry";
import { dispatchShortcutRuntimeEvent } from "@/lib/shortcuts/runtime";

export function ShortcutRuntimeBridge({
  pluginConfigs,
}: {
  pluginConfigs: Map<string, PluginUserConfig>;
}) {
  const { preferences } = useDashboard();

  const appBindings = useMemo(
    () =>
      resolveAppShortcutBindings(preferences.shortcuts).filter(
        (binding) => !binding.desktopOnly && binding.shortcut
      ),
    [preferences.shortcuts]
  );

  const pluginBindings = useMemo(
    () =>
      getAllPlugins()
        .map((plugin) => resolvePluginShortcutBinding(plugin, pluginConfigs.get(plugin.id)))
        .filter((binding) => binding.shortcut),
    [pluginConfigs]
  );

  useEffect(() => {
    const manager = getHotkeyManager();
    const handles: Array<{ unregister: () => void }> = [];

    for (const binding of appBindings) {
      if (!binding.shortcut) continue;
      const actionId = binding.id;
      const handle = manager.register(
        binding.shortcut as Parameters<typeof manager.register>[0],
        (event) => {
          event.preventDefault();
          dispatchShortcutRuntimeEvent({ kind: "app", actionId });
        }
      );
      handles.push(handle);
    }

    return () => {
      for (const handle of handles) handle.unregister();
    };
  }, [appBindings]);

  useEffect(() => {
    const manager = getHotkeyManager();
    const handles: Array<{ unregister: () => void }> = [];

    for (const binding of pluginBindings) {
      if (!binding.shortcut) continue;
      const pluginId = binding.pluginId;
      const handle = manager.register(
        binding.shortcut as Parameters<typeof manager.register>[0],
        (event) => {
          event.preventDefault();
          dispatchShortcutRuntimeEvent({ kind: "plugin", pluginId });
        }
      );
      handles.push(handle);
    }

    return () => {
      for (const handle of handles) handle.unregister();
    };
  }, [pluginBindings]);

  useEffect(() => {
    if (!isTauri()) return;

    let active = true;

    const globalAppBindings = resolveAppShortcutBindings(preferences.shortcuts).filter(
      (binding) => binding.desktopGlobalCapable && binding.desktopGlobal && binding.shortcut
    );
    const globalPluginBindings = getAllPlugins()
      .map((plugin) => resolvePluginShortcutBinding(plugin, pluginConfigs.get(plugin.id)))
      .filter(
        (binding) => binding.desktopGlobalCapable && binding.desktopGlobal && binding.shortcut
      );

    const bindings = [
      ...globalAppBindings.map((binding) => ({
        shortcut: toTauriShortcut(binding.shortcut!),
        detail: { kind: "app" as const, actionId: binding.id },
      })),
      ...globalPluginBindings.map((binding) => ({
        shortcut: toTauriShortcut(binding.shortcut!),
        detail: { kind: "plugin" as const, pluginId: binding.pluginId },
      })),
    ];

    const register = async () => {
      const [{ Channel, invoke }, { getCurrentWindow }] = await Promise.all([
        import("@tauri-apps/api/core"),
        import("@tauri-apps/api/window"),
      ]);

      await invoke("plugin:global-shortcut|unregister_all").catch(() => undefined);

      for (const binding of bindings) {
        const handler = new Channel<{ state: "Pressed" | "Released" }>();
        handler.onmessage = async (event) => {
          if (!active || event.state !== "Pressed") return;
          const window = getCurrentWindow();
          await window.show().catch(() => undefined);
          await window.setFocus().catch(() => undefined);
          if (binding.detail.kind === "app" && binding.detail.actionId === "show-focus-window") {
            return;
          }
          dispatchShortcutRuntimeEvent(binding.detail);
        };

        await invoke("plugin:global-shortcut|register", {
          shortcuts: [binding.shortcut],
          handler,
        }).catch(() => undefined);
      }
    };

    register().catch(() => undefined);

    return () => {
      active = false;
      import("@tauri-apps/api/core")
        .then(({ invoke }) => invoke("plugin:global-shortcut|unregister_all"))
        .catch(() => undefined);
    };
  }, [pluginConfigs, preferences.shortcuts]);

  return null;
}
