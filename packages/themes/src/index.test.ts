import { describe, expect, it } from "vitest";
import {
  applyThemeVariables,
  DEFAULT_THEME_FAMILY_ID,
  DEFAULT_THEME_MODE,
  getThemeContrastReport,
  resolveTheme,
  resolveThemeMode,
  themeFamilies,
} from "./index";

describe("@radarboard/themes", () => {
  it("exports a default theme family", () => {
    expect(themeFamilies).toHaveLength(6);
    expect(themeFamilies[0]?.id).toBe(DEFAULT_THEME_FAMILY_ID);
  });

  it("exposes unique theme family ids", () => {
    expect(new Set(themeFamilies.map((family) => family.id)).size).toBe(themeFamilies.length);
  });

  it("resolves system mode to the provided resolved mode", () => {
    expect(resolveThemeMode("system", "light")).toBe("light");
    expect(resolveThemeMode("system", "dark")).toBe("dark");
  });

  it("resolves the default family and theme mode", () => {
    const theme = resolveTheme(undefined, DEFAULT_THEME_MODE, "dark");
    expect(theme.family.id).toBe(DEFAULT_THEME_FAMILY_ID);
    expect(theme.resolvedMode).toBe("dark");
    expect(theme.variables["--theme-color-background"]).toBe("#101010");
  });

  it("applies theme variables and font slots to an element", () => {
    const root = document.createElement("div");
    const theme = resolveTheme("radarboard", "light", "light");

    applyThemeVariables(root, theme);

    expect(root.dataset.themeFamily).toBe("radarboard");
    expect(root.style.colorScheme).toBe("light");
    expect(root.style.getPropertyValue("--theme-color-background")).toBe("#ffffff");
    expect(root.style.getPropertyValue("--font-sans")).toContain("Geist Sans");
    expect(root.style.getPropertyValue("--font-mono")).toContain("Geist Mono");
  });

  it("resolves additional theme families", () => {
    const theme = resolveTheme("blueprint", "light", "light");

    expect(theme.family.label).toBe("Blueprint");
    expect(theme.variables["--theme-color-accent"]).toBe("#2459d1");
    expect(theme.variables["--theme-color-surface"]).toBe("#fcfdff");
  });

  it("resolves newly added opinionated theme families", () => {
    const theme = resolveTheme("signal", "dark", "dark");

    expect(theme.family.label).toBe("Signal");
    expect(theme.variables["--theme-color-accent"]).toBe("#2fd4f7");
    expect(theme.family.fontMeta.label).toBe("Sora / Chivo Mono");
  });

  it("meets WCAG AA contrast on core semantic token pairs", () => {
    for (const family of themeFamilies) {
      for (const mode of ["light", "dark"] as const) {
        const report = getThemeContrastReport(family.id, mode);
        expect(
          report.filter((item) => !item.passes),
          `${family.id} ${mode}`
        ).toEqual([]);
      }
    }
  });
});
