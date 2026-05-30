export type ShortcutPlatform = "mac" | "windows" | "linux" | "generic";

export function resolveShortcutPlatform(): ShortcutPlatform {
  if (typeof navigator === "undefined") return "generic";

  const userAgentDataPlatform = (
    navigator as Navigator & {
      userAgentData?: { platform?: string };
    }
  ).userAgentData?.platform;
  const candidate = userAgentDataPlatform ?? navigator.platform ?? navigator.userAgent ?? "";
  const platform = candidate.toLowerCase();

  if (platform.includes("mac") || platform.includes("iphone") || platform.includes("ipad")) {
    return "mac";
  }
  if (platform.includes("win")) return "windows";
  if (platform.includes("linux") || platform.includes("x11")) return "linux";
  return "generic";
}

export function formatShortcutLabel(shortcut: string, platform: ShortcutPlatform): string {
  const tokens = formatShortcutParts(shortcut, platform);

  if (platform === "mac") {
    return tokens.join("");
  }

  return tokens.join("+");
}

export function formatShortcutParts(shortcut: string, platform: ShortcutPlatform): string[] {
  const tokens = shortcut.split("+").filter(Boolean);

  return tokens.map((token) => {
    if (token === "Mod") return platform === "mac" ? "⌘" : "Ctrl";
    if (token === "Shift") return platform === "mac" ? "⇧" : "Shift";
    if (token === "Alt") return platform === "mac" ? "⌥" : "Alt";
    if (token === "Ctrl") return platform === "mac" ? "⌃" : "Ctrl";
    return token.length === 1 ? token.toUpperCase() : token;
  });
}
