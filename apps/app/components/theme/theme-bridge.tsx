"use client";

import { useDashboard } from "@radarboard/hooks/use-dashboard";
import {
  applyThemeVariables,
  DEFAULT_THEME_FAMILY_ID,
  DEFAULT_THEME_MODE,
  type ResolvedThemeMode,
  resolveTheme,
} from "@radarboard/themes";
import { useTheme } from "next-themes";
import { useEffect } from "react";

export function ThemeBridge() {
  const { appearance } = useDashboard();
  const { resolvedTheme, setTheme, theme } = useTheme();

  const themeFamilyId = appearance.themeFamilyId ?? DEFAULT_THEME_FAMILY_ID;
  const themeMode = appearance.themeMode ?? DEFAULT_THEME_MODE;
  const systemMode: ResolvedThemeMode = resolvedTheme === "light" ? "light" : "dark";

  useEffect(() => {
    if (theme !== themeMode) {
      setTheme(themeMode);
    }
  }, [setTheme, theme, themeMode]);

  useEffect(() => {
    applyThemeVariables(
      document.documentElement,
      resolveTheme(themeFamilyId, themeMode, systemMode)
    );
  }, [systemMode, themeFamilyId, themeMode]);

  return null;
}
