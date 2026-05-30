"use client";

import { UI_TOAST_EVENT, type UiToastDetail } from "@radarboard/ui/toast";
import { useTheme } from "next-themes";
import { useEffect } from "react";
import { Toaster, toast } from "sonner";

function syncThemeColorMetaTag() {
  const root = document.documentElement;
  const computedStyle = getComputedStyle(root);
  const themeColor =
    computedStyle.getPropertyValue("--theme-color-background").trim() ||
    computedStyle.getPropertyValue("--color-background").trim();

  if (!themeColor) return;

  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.append(meta);
  }

  meta.content = themeColor;
}

export function ThemeChrome() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    syncThemeColorMetaTag();

    const observer = new MutationObserver(() => {
      syncThemeColorMetaTag();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    syncThemeColorMetaTag();
  }, []);

  useEffect(() => {
    const handleToastEvent = (event: Event) => {
      const { variant, title, description } = (event as CustomEvent<UiToastDetail>).detail;
      toast[variant](title, { description });
    };

    window.addEventListener(UI_TOAST_EVENT, handleToastEvent);
    return () => window.removeEventListener(UI_TOAST_EVENT, handleToastEvent);
  }, []);

  return (
    <Toaster
      theme={resolvedTheme === "light" ? "light" : "dark"}
      position="bottom-right"
      style={{ zIndex: "var(--z-toast)" }}
      toastOptions={{
        style: {
          background: "var(--color-popover)",
          border: "1px solid var(--color-border)",
          color: "var(--color-popover-foreground)",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-w-sm)",
          zIndex: "var(--z-toast)",
        },
      }}
    />
  );
}
