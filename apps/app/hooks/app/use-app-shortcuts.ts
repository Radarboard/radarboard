"use client";

import { useDashboard } from "@radarboard/hooks/use-dashboard";
import type { AppShortcutActionId } from "@radarboard/types/shortcuts";
import { formatShortcutLabel, resolveShortcutPlatform } from "@radarboard/utils/shortcut-label";
import { useMemo } from "react";
import { resolveAppShortcutBindings } from "@/lib/shortcuts/registry";

export function useResolvedAppShortcuts() {
  const { preferences } = useDashboard();

  return useMemo(() => {
    const bindings = resolveAppShortcutBindings(preferences.shortcuts);
    return new Map(bindings.map((binding) => [binding.id, binding]));
  }, [preferences.shortcuts]);
}

export function useFormattedAppShortcutLabel(actionId: AppShortcutActionId): string | null {
  const shortcuts = useResolvedAppShortcuts();
  const platform = useMemo(() => resolveShortcutPlatform(), []);
  const binding = shortcuts.get(actionId);
  return binding?.shortcut ? formatShortcutLabel(binding.shortcut, platform) : null;
}
