import {
  PRODUCT_DASHBOARD_DESCRIPTION,
  PRODUCT_DESCRIPTION,
  PRODUCT_NAME,
} from "@radarboard/product";
import { DEFAULT_THEME_FAMILY_ID, resolveTheme } from "@radarboard/themes";
import type { Metadata, Viewport } from "next";

export const APP_MANIFEST_PATH = "/manifest.json";

const lightThemeColor =
  resolveTheme(DEFAULT_THEME_FAMILY_ID, "light", "light").variables["--theme-color-background"] ??
  "#ffffff";

const darkThemeColor =
  resolveTheme(DEFAULT_THEME_FAMILY_ID, "dark", "dark").variables["--theme-color-background"] ??
  "#101010";

export const appMetadata: Metadata = {
  title: {
    default: PRODUCT_NAME,
    template: `%s — ${PRODUCT_NAME}`,
  },
  description: PRODUCT_DESCRIPTION,
  manifest: APP_MANIFEST_PATH,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const appViewport: Viewport = {
  themeColor: [
    {
      media: "(prefers-color-scheme: light)",
      color: lightThemeColor,
    },
    {
      media: "(prefers-color-scheme: dark)",
      color: darkThemeColor,
    },
  ],
};

export function createPageMetadata({
  title,
  description,
}: {
  title?: string;
  description?: string;
}): Metadata {
  return {
    title,
    description,
  };
}

export const DASHBOARD_DESCRIPTION = PRODUCT_DASHBOARD_DESCRIPTION;
