export type ThemeMode = "light" | "dark" | "system";
export type ResolvedThemeMode = "light" | "dark";
export type ThemeFamilyId =
  | "radarboard"
  | "graphite"
  | "blueprint"
  | "amber"
  | "editorial"
  | "signal";

export const DEFAULT_THEME_FAMILY_ID: ThemeFamilyId = "radarboard";
export const DEFAULT_THEME_MODE: ThemeMode = "dark";

export type ThemeVariableMap = Record<`--theme-${string}`, string>;

export interface ThemeFontSlots {
  sans: string;
  mono: string;
}

export interface ThemeFontMeta {
  label: string;
}

export interface ThemePreview {
  surface: string;
  accent: string;
  text: string;
  sansScale: number;
  monoScale: number;
}

export interface ThemeFamily {
  id: ThemeFamilyId;
  label: string;
  description: string;
  fonts: ThemeFontSlots;
  fontMeta: ThemeFontMeta;
  preview: ThemePreview;
  modes: Record<ResolvedThemeMode, ThemeVariableMap>;
}

export interface ResolvedTheme {
  family: ThemeFamily;
  mode: ThemeMode;
  resolvedMode: ResolvedThemeMode;
  variables: ThemeVariableMap;
}

export interface ThemeContrastReportItem {
  id: string;
  ratio: number;
  minimumRatio: number;
  passes: boolean;
}

const radarboardLight: ThemeVariableMap = {
  "--theme-color-background": "#ffffff",
  "--theme-color-foreground": "#111111",
  "--theme-color-surface": "#ffffff",
  "--theme-color-surface-raised": "#f1f3f7",
  "--theme-color-card": "#ffffff",
  "--theme-color-card-foreground": "#111111",
  "--theme-color-popover": "#ffffff",
  "--theme-color-popover-foreground": "#111111",
  "--theme-color-primary": "#111111",
  "--theme-color-primary-foreground": "#ffffff",
  "--theme-color-secondary": "#e8ebf0",
  "--theme-color-secondary-foreground": "#111111",
  "--theme-color-muted": "#e8ebf0",
  "--theme-color-muted-foreground": "#525866",
  "--theme-color-foreground-secondary": "#2f3745",
  "--theme-color-dim": "#626b7a",
  "--theme-color-accent": "#1f5fd4",
  "--theme-color-accent-foreground": "#ffffff",
  "--theme-color-destructive": "#b9382d",
  "--theme-color-destructive-foreground": "#ffffff",
  "--theme-color-success": "#136f48",
  "--theme-color-success-foreground": "#ffffff",
  "--theme-color-success-bg": "rgba(19, 111, 72, 0.06)",
  "--theme-color-warning": "#8a5f10",
  "--theme-color-warning-foreground": "#ffffff",
  "--theme-color-warning-bg": "rgba(138, 95, 16, 0.07)",
  "--theme-color-destructive-bg": "rgba(185, 56, 45, 0.07)",
  "--theme-color-info": "#2563eb",
  "--theme-color-info-foreground": "#ffffff",
  "--theme-color-info-bg": "rgba(37, 99, 235, 0.08)",
  "--theme-color-unread-bg": "rgba(37, 99, 235, 0.05)",
  "--theme-color-line": "#d3d8e1",
  "--theme-color-border": "#bfc7d3",
  "--theme-color-input": "#bfc7d3",
  "--theme-color-ring": "#2563eb",
  "--theme-color-chart-1": "#2563eb",
  "--theme-color-chart-2": "#dc2626",
  "--theme-color-chart-3": "#16a34a",
  "--theme-color-chart-4": "#ca8a04",
  "--theme-color-chart-5": "#9333ea",
  "--theme-shadow-popover": "0 8px 32px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04)",
  "--theme-shadow-modal": "0 24px 80px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05)",
  "--theme-shadow-glow": "inset 0 0 0 1px rgba(0, 0, 0, 0.05)",
};

const radarboardDark: ThemeVariableMap = {
  "--theme-color-background": "#101010",
  "--theme-color-foreground": "#e8e8e8",
  "--theme-color-surface": "#111111",
  "--theme-color-surface-raised": "#161616",
  "--theme-color-card": "#181818",
  "--theme-color-card-foreground": "#e8e8e8",
  "--theme-color-popover": "#181818",
  "--theme-color-popover-foreground": "#e8e8e8",
  "--theme-color-primary": "#e8e8e8",
  "--theme-color-primary-foreground": "#101010",
  "--theme-color-secondary": "#1e1e1e",
  "--theme-color-secondary-foreground": "#e8e8e8",
  "--theme-color-muted": "#1e1e1e",
  "--theme-color-muted-foreground": "#888888",
  "--theme-color-foreground-secondary": "#cccccc",
  "--theme-color-dim": "#858585",
  "--theme-color-accent": "#5b8af5",
  "--theme-color-accent-foreground": "#e8e8e8",
  "--theme-color-destructive": "#e05555",
  "--theme-color-destructive-foreground": "#e8e8e8",
  "--theme-color-success": "#4ade80",
  "--theme-color-success-foreground": "#101010",
  "--theme-color-success-bg": "rgba(74, 222, 128, 0.08)",
  "--theme-color-warning": "#f5c542",
  "--theme-color-warning-foreground": "#101010",
  "--theme-color-warning-bg": "rgba(245, 197, 66, 0.08)",
  "--theme-color-destructive-bg": "rgba(224, 85, 85, 0.08)",
  "--theme-color-info": "#5b8af5",
  "--theme-color-info-foreground": "#e8e8e8",
  "--theme-color-info-bg": "rgba(91, 138, 245, 0.08)",
  "--theme-color-unread-bg": "rgba(91, 138, 245, 0.06)",
  "--theme-color-line": "#1a1a1a",
  "--theme-color-border": "#2a2a2a",
  "--theme-color-input": "#2a2a2a",
  "--theme-color-ring": "#5b8af5",
  "--theme-color-chart-1": "#5b8af5",
  "--theme-color-chart-2": "#e05555",
  "--theme-color-chart-3": "#4ade80",
  "--theme-color-chart-4": "#f5c542",
  "--theme-color-chart-5": "#b388ff",
  "--theme-shadow-popover": "0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)",
  "--theme-shadow-modal": "0 24px 80px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.03)",
  "--theme-shadow-glow": "inset 0 0 0 1px rgba(255, 255, 255, 0.08)",
};

const graphiteLight: ThemeVariableMap = {
  "--theme-color-background": "#f2f3f5",
  "--theme-color-foreground": "#18181b",
  "--theme-color-surface": "#ffffff",
  "--theme-color-surface-raised": "#e8eaee",
  "--theme-color-card": "#ffffff",
  "--theme-color-card-foreground": "#18181b",
  "--theme-color-popover": "#ffffff",
  "--theme-color-popover-foreground": "#18181b",
  "--theme-color-primary": "#18181b",
  "--theme-color-primary-foreground": "#ffffff",
  "--theme-color-secondary": "#e1e4ea",
  "--theme-color-secondary-foreground": "#23242a",
  "--theme-color-muted": "#e1e4ea",
  "--theme-color-muted-foreground": "#565b66",
  "--theme-color-foreground-secondary": "#373b45",
  "--theme-color-dim": "#686e79",
  "--theme-color-accent": "#495983",
  "--theme-color-accent-foreground": "#ffffff",
  "--theme-color-destructive": "#a73d3d",
  "--theme-color-destructive-foreground": "#ffffff",
  "--theme-color-success": "#1f6747",
  "--theme-color-success-foreground": "#ffffff",
  "--theme-color-success-bg": "rgba(31, 103, 71, 0.07)",
  "--theme-color-warning": "#8e5d16",
  "--theme-color-warning-foreground": "#ffffff",
  "--theme-color-warning-bg": "rgba(142, 93, 22, 0.08)",
  "--theme-color-destructive-bg": "rgba(167, 61, 61, 0.08)",
  "--theme-color-info": "#5b6b9a",
  "--theme-color-info-foreground": "#ffffff",
  "--theme-color-info-bg": "rgba(91, 107, 154, 0.1)",
  "--theme-color-unread-bg": "rgba(91, 107, 154, 0.08)",
  "--theme-color-line": "#d4d7de",
  "--theme-color-border": "#bcc2cc",
  "--theme-color-input": "#bcc2cc",
  "--theme-color-ring": "#5b6b9a",
  "--theme-color-chart-1": "#5b6b9a",
  "--theme-color-chart-2": "#d04b4b",
  "--theme-color-chart-3": "#27825a",
  "--theme-color-chart-4": "#b7791f",
  "--theme-color-chart-5": "#8b5cf6",
  "--theme-shadow-popover": "0 10px 30px rgba(27, 30, 36, 0.08), 0 0 0 1px rgba(27, 30, 36, 0.04)",
  "--theme-shadow-modal": "0 28px 80px rgba(27, 30, 36, 0.12), 0 0 0 1px rgba(27, 30, 36, 0.05)",
  "--theme-shadow-glow": "inset 0 0 0 1px rgba(27, 30, 36, 0.05)",
};

const graphiteDark: ThemeVariableMap = {
  "--theme-color-background": "#0d1014",
  "--theme-color-foreground": "#ebecef",
  "--theme-color-surface": "#13171d",
  "--theme-color-surface-raised": "#1a2027",
  "--theme-color-card": "#171b22",
  "--theme-color-card-foreground": "#ebecef",
  "--theme-color-popover": "#14161b",
  "--theme-color-popover-foreground": "#ebecef",
  "--theme-color-primary": "#ebecef",
  "--theme-color-primary-foreground": "#0b0c0f",
  "--theme-color-secondary": "#1b1f26",
  "--theme-color-secondary-foreground": "#e3e7ef",
  "--theme-color-muted": "#1b1f26",
  "--theme-color-muted-foreground": "#8a91a0",
  "--theme-color-foreground-secondary": "#c3c7d0",
  "--theme-color-dim": "#7d8491",
  "--theme-color-accent": "#8fa3ff",
  "--theme-color-accent-foreground": "#0b1020",
  "--theme-color-destructive": "#ff7272",
  "--theme-color-destructive-foreground": "#2a0f0f",
  "--theme-color-success": "#5ed39a",
  "--theme-color-success-foreground": "#091910",
  "--theme-color-success-bg": "rgba(94, 211, 154, 0.1)",
  "--theme-color-warning": "#f1ba63",
  "--theme-color-warning-foreground": "#231808",
  "--theme-color-warning-bg": "rgba(241, 186, 99, 0.12)",
  "--theme-color-destructive-bg": "rgba(255, 114, 114, 0.12)",
  "--theme-color-info": "#8fa3ff",
  "--theme-color-info-foreground": "#0b1020",
  "--theme-color-info-bg": "rgba(143, 163, 255, 0.12)",
  "--theme-color-unread-bg": "rgba(143, 163, 255, 0.1)",
  "--theme-color-line": "#17191d",
  "--theme-color-border": "#2a2f38",
  "--theme-color-input": "#2a2f38",
  "--theme-color-ring": "#8fa3ff",
  "--theme-color-chart-1": "#8fa3ff",
  "--theme-color-chart-2": "#ff7272",
  "--theme-color-chart-3": "#5ed39a",
  "--theme-color-chart-4": "#f1ba63",
  "--theme-color-chart-5": "#b388ff",
  "--theme-shadow-popover": "0 10px 30px rgba(0, 0, 0, 0.42), 0 0 0 1px rgba(255, 255, 255, 0.04)",
  "--theme-shadow-modal": "0 28px 80px rgba(0, 0, 0, 0.56), 0 0 0 1px rgba(255, 255, 255, 0.04)",
  "--theme-shadow-glow": "inset 0 0 0 1px rgba(255, 255, 255, 0.05)",
};

const blueprintLight: ThemeVariableMap = {
  "--theme-color-background": "#eaf1ff",
  "--theme-color-foreground": "#0f172a",
  "--theme-color-surface": "#fcfdff",
  "--theme-color-surface-raised": "#d8e3fc",
  "--theme-color-card": "#ffffff",
  "--theme-color-card-foreground": "#0f172a",
  "--theme-color-popover": "#ffffff",
  "--theme-color-popover-foreground": "#0f172a",
  "--theme-color-primary": "#0f172a",
  "--theme-color-primary-foreground": "#ffffff",
  "--theme-color-secondary": "#ccddff",
  "--theme-color-secondary-foreground": "#12316b",
  "--theme-color-muted": "#ccddff",
  "--theme-color-muted-foreground": "#52657f",
  "--theme-color-foreground-secondary": "#24364f",
  "--theme-color-dim": "#52657f",
  "--theme-color-accent": "#2459d1",
  "--theme-color-accent-foreground": "#ffffff",
  "--theme-color-destructive": "#b53b4d",
  "--theme-color-destructive-foreground": "#ffffff",
  "--theme-color-success": "#186c46",
  "--theme-color-success-foreground": "#ffffff",
  "--theme-color-success-bg": "rgba(24, 108, 70, 0.07)",
  "--theme-color-warning": "#93620d",
  "--theme-color-warning-foreground": "#ffffff",
  "--theme-color-warning-bg": "rgba(147, 98, 13, 0.08)",
  "--theme-color-destructive-bg": "rgba(181, 59, 77, 0.08)",
  "--theme-color-info": "#2f6bff",
  "--theme-color-info-foreground": "#ffffff",
  "--theme-color-info-bg": "rgba(47, 107, 255, 0.1)",
  "--theme-color-unread-bg": "rgba(47, 107, 255, 0.08)",
  "--theme-color-line": "#c3d5f6",
  "--theme-color-border": "#9db7e7",
  "--theme-color-input": "#9db7e7",
  "--theme-color-ring": "#2f6bff",
  "--theme-color-chart-1": "#2f6bff",
  "--theme-color-chart-2": "#d9485f",
  "--theme-color-chart-3": "#218b5b",
  "--theme-color-chart-4": "#c98a15",
  "--theme-color-chart-5": "#7c5cff",
  "--theme-shadow-popover": "0 10px 34px rgba(20, 59, 133, 0.1), 0 0 0 1px rgba(20, 59, 133, 0.04)",
  "--theme-shadow-modal": "0 28px 84px rgba(20, 59, 133, 0.14), 0 0 0 1px rgba(20, 59, 133, 0.05)",
  "--theme-shadow-glow": "inset 0 0 0 1px rgba(47, 107, 255, 0.08)",
};

const blueprintDark: ThemeVariableMap = {
  "--theme-color-background": "#081222",
  "--theme-color-foreground": "#ecf2ff",
  "--theme-color-surface": "#0d1833",
  "--theme-color-surface-raised": "#162447",
  "--theme-color-card": "#122040",
  "--theme-color-card-foreground": "#ecf2ff",
  "--theme-color-popover": "#111b38",
  "--theme-color-popover-foreground": "#ecf2ff",
  "--theme-color-primary": "#ecf2ff",
  "--theme-color-primary-foreground": "#0a1020",
  "--theme-color-secondary": "#18274d",
  "--theme-color-secondary-foreground": "#d7e6ff",
  "--theme-color-muted": "#18274d",
  "--theme-color-muted-foreground": "#90a4cf",
  "--theme-color-foreground-secondary": "#c5d5ff",
  "--theme-color-dim": "#7b8fb6",
  "--theme-color-accent": "#6ea2ff",
  "--theme-color-accent-foreground": "#081224",
  "--theme-color-destructive": "#ff7b88",
  "--theme-color-destructive-foreground": "#310b14",
  "--theme-color-success": "#4dd4a3",
  "--theme-color-success-foreground": "#081a16",
  "--theme-color-success-bg": "rgba(77, 212, 163, 0.12)",
  "--theme-color-warning": "#f0b35d",
  "--theme-color-warning-foreground": "#28190a",
  "--theme-color-warning-bg": "rgba(240, 179, 93, 0.13)",
  "--theme-color-destructive-bg": "rgba(255, 123, 136, 0.12)",
  "--theme-color-info": "#6ea2ff",
  "--theme-color-info-foreground": "#081224",
  "--theme-color-info-bg": "rgba(110, 162, 255, 0.12)",
  "--theme-color-unread-bg": "rgba(110, 162, 255, 0.1)",
  "--theme-color-line": "#13203d",
  "--theme-color-border": "#22355f",
  "--theme-color-input": "#22355f",
  "--theme-color-ring": "#6ea2ff",
  "--theme-color-chart-1": "#6ea2ff",
  "--theme-color-chart-2": "#ff7b88",
  "--theme-color-chart-3": "#4dd4a3",
  "--theme-color-chart-4": "#f0b35d",
  "--theme-color-chart-5": "#9d8cff",
  "--theme-shadow-popover":
    "0 12px 32px rgba(3, 10, 24, 0.45), 0 0 0 1px rgba(110, 162, 255, 0.05)",
  "--theme-shadow-modal": "0 30px 84px rgba(3, 10, 24, 0.58), 0 0 0 1px rgba(110, 162, 255, 0.06)",
  "--theme-shadow-glow": "inset 0 0 0 1px rgba(110, 162, 255, 0.08)",
};

const amberLight: ThemeVariableMap = {
  "--theme-color-background": "#fdf7ee",
  "--theme-color-foreground": "#1e1b16",
  "--theme-color-surface": "#fffdf9",
  "--theme-color-surface-raised": "#f0e1cd",
  "--theme-color-card": "#ffffff",
  "--theme-color-card-foreground": "#1e1b16",
  "--theme-color-popover": "#ffffff",
  "--theme-color-popover-foreground": "#1e1b16",
  "--theme-color-primary": "#1e1b16",
  "--theme-color-primary-foreground": "#fffaf2",
  "--theme-color-secondary": "#e9d5b6",
  "--theme-color-secondary-foreground": "#6f4a1a",
  "--theme-color-muted": "#ead7bc",
  "--theme-color-muted-foreground": "#775f45",
  "--theme-color-foreground-secondary": "#463624",
  "--theme-color-dim": "#715b43",
  "--theme-color-accent": "#8f5718",
  "--theme-color-accent-foreground": "#fffaf2",
  "--theme-color-destructive": "#a63d30",
  "--theme-color-destructive-foreground": "#fffaf2",
  "--theme-color-success": "#1a6747",
  "--theme-color-success-foreground": "#fffaf2",
  "--theme-color-success-bg": "rgba(26, 103, 71, 0.07)",
  "--theme-color-warning": "#8f5f14",
  "--theme-color-warning-foreground": "#fffaf2",
  "--theme-color-warning-bg": "rgba(143, 95, 20, 0.08)",
  "--theme-color-destructive-bg": "rgba(166, 61, 48, 0.08)",
  "--theme-color-info": "#c67b2d",
  "--theme-color-info-foreground": "#fffaf2",
  "--theme-color-info-bg": "rgba(198, 123, 45, 0.1)",
  "--theme-color-unread-bg": "rgba(198, 123, 45, 0.08)",
  "--theme-color-line": "#dbc8ad",
  "--theme-color-border": "#ccb492",
  "--theme-color-input": "#ccb492",
  "--theme-color-ring": "#c67b2d",
  "--theme-color-chart-1": "#c67b2d",
  "--theme-color-chart-2": "#c64b3b",
  "--theme-color-chart-3": "#25805a",
  "--theme-color-chart-4": "#b7791f",
  "--theme-color-chart-5": "#7c5cff",
  "--theme-shadow-popover": "0 10px 30px rgba(74, 48, 19, 0.08), 0 0 0 1px rgba(74, 48, 19, 0.04)",
  "--theme-shadow-modal": "0 28px 80px rgba(74, 48, 19, 0.12), 0 0 0 1px rgba(74, 48, 19, 0.05)",
  "--theme-shadow-glow": "inset 0 0 0 1px rgba(198, 123, 45, 0.08)",
};

const amberDark: ThemeVariableMap = {
  "--theme-color-background": "#181109",
  "--theme-color-foreground": "#f5ede3",
  "--theme-color-surface": "#1e1510",
  "--theme-color-surface-raised": "#281c15",
  "--theme-color-card": "#241911",
  "--theme-color-card-foreground": "#f5ede3",
  "--theme-color-popover": "#1f1711",
  "--theme-color-popover-foreground": "#f5ede3",
  "--theme-color-primary": "#f5ede3",
  "--theme-color-primary-foreground": "#14100c",
  "--theme-color-secondary": "#332418",
  "--theme-color-secondary-foreground": "#f3d2af",
  "--theme-color-muted": "#2a1e15",
  "--theme-color-muted-foreground": "#b29a84",
  "--theme-color-foreground-secondary": "#e0ccb7",
  "--theme-color-dim": "#a58f7a",
  "--theme-color-accent": "#f0a14a",
  "--theme-color-accent-foreground": "#2c1807",
  "--theme-color-destructive": "#ee6b5f",
  "--theme-color-destructive-foreground": "#2f0f0a",
  "--theme-color-success": "#65c18c",
  "--theme-color-success-foreground": "#0b1911",
  "--theme-color-success-bg": "rgba(101, 193, 140, 0.12)",
  "--theme-color-warning": "#f0a14a",
  "--theme-color-warning-foreground": "#2c1807",
  "--theme-color-warning-bg": "rgba(240, 161, 74, 0.14)",
  "--theme-color-destructive-bg": "rgba(238, 107, 95, 0.12)",
  "--theme-color-info": "#f0a14a",
  "--theme-color-info-foreground": "#2c1807",
  "--theme-color-info-bg": "rgba(240, 161, 74, 0.12)",
  "--theme-color-unread-bg": "rgba(240, 161, 74, 0.1)",
  "--theme-color-line": "#21170f",
  "--theme-color-border": "#4a3525",
  "--theme-color-input": "#4a3525",
  "--theme-color-ring": "#f0a14a",
  "--theme-color-chart-1": "#f0a14a",
  "--theme-color-chart-2": "#ee6b5f",
  "--theme-color-chart-3": "#65c18c",
  "--theme-color-chart-4": "#f6c970",
  "--theme-color-chart-5": "#b388ff",
  "--theme-shadow-popover": "0 10px 30px rgba(0, 0, 0, 0.42), 0 0 0 1px rgba(240, 161, 74, 0.05)",
  "--theme-shadow-modal": "0 30px 84px rgba(0, 0, 0, 0.56), 0 0 0 1px rgba(240, 161, 74, 0.06)",
  "--theme-shadow-glow": "inset 0 0 0 1px rgba(240, 161, 74, 0.08)",
};

const editorialLight: ThemeVariableMap = {
  "--theme-color-background": "#f8f4ef",
  "--theme-color-foreground": "#211a14",
  "--theme-color-surface": "#fffdfa",
  "--theme-color-surface-raised": "#efe6db",
  "--theme-color-card": "#fffdfa",
  "--theme-color-card-foreground": "#211a14",
  "--theme-color-popover": "#fffdfa",
  "--theme-color-popover-foreground": "#211a14",
  "--theme-color-primary": "#211a14",
  "--theme-color-primary-foreground": "#fffdfa",
  "--theme-color-secondary": "#eadfce",
  "--theme-color-secondary-foreground": "#5b4230",
  "--theme-color-muted": "#eadfce",
  "--theme-color-muted-foreground": "#6f5e51",
  "--theme-color-foreground-secondary": "#4f3f33",
  "--theme-color-dim": "#7b6a5b",
  "--theme-color-accent": "#874c6b",
  "--theme-color-accent-foreground": "#fffdfa",
  "--theme-color-destructive": "#a84437",
  "--theme-color-destructive-foreground": "#fffdfa",
  "--theme-color-success": "#2b7156",
  "--theme-color-success-foreground": "#fffdfa",
  "--theme-color-success-bg": "rgba(43, 113, 86, 0.08)",
  "--theme-color-warning": "#8c6120",
  "--theme-color-warning-foreground": "#fffdfa",
  "--theme-color-warning-bg": "rgba(140, 97, 32, 0.08)",
  "--theme-color-destructive-bg": "rgba(168, 68, 55, 0.08)",
  "--theme-color-info": "#874c6b",
  "--theme-color-info-foreground": "#fffdfa",
  "--theme-color-info-bg": "rgba(135, 76, 107, 0.09)",
  "--theme-color-unread-bg": "rgba(135, 76, 107, 0.08)",
  "--theme-color-line": "#dfd2c3",
  "--theme-color-border": "#cdbca9",
  "--theme-color-input": "#cdbca9",
  "--theme-color-ring": "#874c6b",
  "--theme-color-chart-1": "#874c6b",
  "--theme-color-chart-2": "#a84437",
  "--theme-color-chart-3": "#2b7156",
  "--theme-color-chart-4": "#8c6120",
  "--theme-color-chart-5": "#5564a4",
  "--theme-shadow-popover": "0 10px 28px rgba(50, 33, 20, 0.08), 0 0 0 1px rgba(50, 33, 20, 0.04)",
  "--theme-shadow-modal": "0 30px 84px rgba(50, 33, 20, 0.12), 0 0 0 1px rgba(50, 33, 20, 0.05)",
  "--theme-shadow-glow": "inset 0 0 0 1px rgba(135, 76, 107, 0.06)",
};

const editorialDark: ThemeVariableMap = {
  "--theme-color-background": "#15110e",
  "--theme-color-foreground": "#f3ece4",
  "--theme-color-surface": "#1b1511",
  "--theme-color-surface-raised": "#251d17",
  "--theme-color-card": "#211a14",
  "--theme-color-card-foreground": "#f3ece4",
  "--theme-color-popover": "#211a14",
  "--theme-color-popover-foreground": "#f3ece4",
  "--theme-color-primary": "#f3ece4",
  "--theme-color-primary-foreground": "#15110e",
  "--theme-color-secondary": "#33271f",
  "--theme-color-secondary-foreground": "#ead7c2",
  "--theme-color-muted": "#2c221b",
  "--theme-color-muted-foreground": "#b9a595",
  "--theme-color-foreground-secondary": "#dfcfbf",
  "--theme-color-dim": "#a69283",
  "--theme-color-accent": "#d68ab1",
  "--theme-color-accent-foreground": "#2a1020",
  "--theme-color-destructive": "#ef7e70",
  "--theme-color-destructive-foreground": "#300f0b",
  "--theme-color-success": "#6bc7a0",
  "--theme-color-success-foreground": "#0c1a15",
  "--theme-color-success-bg": "rgba(107, 199, 160, 0.1)",
  "--theme-color-warning": "#e0b06b",
  "--theme-color-warning-foreground": "#2b1b08",
  "--theme-color-warning-bg": "rgba(224, 176, 107, 0.12)",
  "--theme-color-destructive-bg": "rgba(239, 126, 112, 0.12)",
  "--theme-color-info": "#d68ab1",
  "--theme-color-info-foreground": "#2a1020",
  "--theme-color-info-bg": "rgba(214, 138, 177, 0.12)",
  "--theme-color-unread-bg": "rgba(214, 138, 177, 0.1)",
  "--theme-color-line": "#241b15",
  "--theme-color-border": "#49392d",
  "--theme-color-input": "#49392d",
  "--theme-color-ring": "#d68ab1",
  "--theme-color-chart-1": "#d68ab1",
  "--theme-color-chart-2": "#ef7e70",
  "--theme-color-chart-3": "#6bc7a0",
  "--theme-color-chart-4": "#e0b06b",
  "--theme-color-chart-5": "#94a4ff",
  "--theme-shadow-popover": "0 12px 30px rgba(0, 0, 0, 0.42), 0 0 0 1px rgba(214, 138, 177, 0.05)",
  "--theme-shadow-modal": "0 32px 84px rgba(0, 0, 0, 0.58), 0 0 0 1px rgba(214, 138, 177, 0.06)",
  "--theme-shadow-glow": "inset 0 0 0 1px rgba(214, 138, 177, 0.08)",
};

const signalLight: ThemeVariableMap = {
  "--theme-color-background": "#edf8fb",
  "--theme-color-foreground": "#07131a",
  "--theme-color-surface": "#fbfeff",
  "--theme-color-surface-raised": "#d8f0f6",
  "--theme-color-card": "#ffffff",
  "--theme-color-card-foreground": "#07131a",
  "--theme-color-popover": "#ffffff",
  "--theme-color-popover-foreground": "#07131a",
  "--theme-color-primary": "#07131a",
  "--theme-color-primary-foreground": "#ffffff",
  "--theme-color-secondary": "#d1ebf3",
  "--theme-color-secondary-foreground": "#04485c",
  "--theme-color-muted": "#d1ebf3",
  "--theme-color-muted-foreground": "#4b6973",
  "--theme-color-foreground-secondary": "#16323d",
  "--theme-color-dim": "#4f6770",
  "--theme-color-accent": "#006d85",
  "--theme-color-accent-foreground": "#ffffff",
  "--theme-color-destructive": "#aa3f4b",
  "--theme-color-destructive-foreground": "#ffffff",
  "--theme-color-success": "#0f7a66",
  "--theme-color-success-foreground": "#ffffff",
  "--theme-color-success-bg": "rgba(15, 122, 102, 0.08)",
  "--theme-color-warning": "#7c5e10",
  "--theme-color-warning-foreground": "#ffffff",
  "--theme-color-warning-bg": "rgba(124, 94, 16, 0.07)",
  "--theme-color-destructive-bg": "rgba(170, 63, 75, 0.07)",
  "--theme-color-info": "#008aa6",
  "--theme-color-info-foreground": "#ffffff",
  "--theme-color-info-bg": "rgba(0, 138, 166, 0.1)",
  "--theme-color-unread-bg": "rgba(0, 138, 166, 0.08)",
  "--theme-color-line": "#c7e2e9",
  "--theme-color-border": "#afcfd8",
  "--theme-color-input": "#afcfd8",
  "--theme-color-ring": "#008aa6",
  "--theme-color-chart-1": "#008aa6",
  "--theme-color-chart-2": "#c94a58",
  "--theme-color-chart-3": "#0f7a66",
  "--theme-color-chart-4": "#8c6a12",
  "--theme-color-chart-5": "#6f6cff",
  "--theme-shadow-popover": "0 10px 28px rgba(4, 63, 79, 0.08), 0 0 0 1px rgba(4, 63, 79, 0.04)",
  "--theme-shadow-modal": "0 30px 84px rgba(4, 63, 79, 0.12), 0 0 0 1px rgba(4, 63, 79, 0.05)",
  "--theme-shadow-glow": "inset 0 0 0 1px rgba(0, 138, 166, 0.07)",
};

const signalDark: ThemeVariableMap = {
  "--theme-color-background": "#07131a",
  "--theme-color-foreground": "#e8fbff",
  "--theme-color-surface": "#0a1a22",
  "--theme-color-surface-raised": "#0f232d",
  "--theme-color-card": "#0d1e27",
  "--theme-color-card-foreground": "#e8fbff",
  "--theme-color-popover": "#0d1e27",
  "--theme-color-popover-foreground": "#e8fbff",
  "--theme-color-primary": "#e8fbff",
  "--theme-color-primary-foreground": "#07131a",
  "--theme-color-secondary": "#12303c",
  "--theme-color-secondary-foreground": "#bdefff",
  "--theme-color-muted": "#112935",
  "--theme-color-muted-foreground": "#8eb2be",
  "--theme-color-foreground-secondary": "#c6e9f5",
  "--theme-color-dim": "#88a8b3",
  "--theme-color-accent": "#2fd4f7",
  "--theme-color-accent-foreground": "#05202a",
  "--theme-color-destructive": "#ff8891",
  "--theme-color-destructive-foreground": "#340d11",
  "--theme-color-success": "#4ee0bb",
  "--theme-color-success-foreground": "#082019",
  "--theme-color-success-bg": "rgba(78, 224, 187, 0.12)",
  "--theme-color-warning": "#f2c66e",
  "--theme-color-warning-foreground": "#2f2208",
  "--theme-color-warning-bg": "rgba(242, 198, 110, 0.12)",
  "--theme-color-destructive-bg": "rgba(255, 136, 145, 0.12)",
  "--theme-color-info": "#2fd4f7",
  "--theme-color-info-foreground": "#05202a",
  "--theme-color-info-bg": "rgba(47, 212, 247, 0.12)",
  "--theme-color-unread-bg": "rgba(47, 212, 247, 0.1)",
  "--theme-color-line": "#0f212b",
  "--theme-color-border": "#1f4350",
  "--theme-color-input": "#1f4350",
  "--theme-color-ring": "#2fd4f7",
  "--theme-color-chart-1": "#2fd4f7",
  "--theme-color-chart-2": "#ff8891",
  "--theme-color-chart-3": "#4ee0bb",
  "--theme-color-chart-4": "#f2c66e",
  "--theme-color-chart-5": "#8a8cff",
  "--theme-shadow-popover": "0 12px 30px rgba(0, 0, 0, 0.44), 0 0 0 1px rgba(47, 212, 247, 0.05)",
  "--theme-shadow-modal": "0 32px 84px rgba(0, 0, 0, 0.58), 0 0 0 1px rgba(47, 212, 247, 0.06)",
  "--theme-shadow-glow": "inset 0 0 0 1px rgba(47, 212, 247, 0.08)",
};

export const themeFamilies: ThemeFamily[] = [
  {
    id: "radarboard",
    label: "Radarboard",
    description: "The default dashboard theme with Geist Sans and Geist Mono.",
    fonts: {
      sans: '"Geist Sans", ui-sans-serif, system-ui, sans-serif',
      mono: '"Geist Mono", ui-monospace, "SFMono-Regular", monospace',
    },
    fontMeta: {
      label: "Geist Sans / Geist Mono",
    },
    preview: {
      surface: "#111111",
      accent: "#5b8af5",
      text: "#e8e8e8",
      sansScale: 1,
      monoScale: 1,
    },
    modes: {
      light: radarboardLight,
      dark: radarboardDark,
    },
  },
  {
    id: "graphite",
    label: "Graphite",
    description: "A restrained neutral theme inspired by modern editor and dashboard palettes.",
    fonts: {
      sans: '"IBM Plex Sans Variable", "IBM Plex Sans", sans-serif',
      mono: '"JetBrains Mono Variable", "JetBrains Mono", monospace',
    },
    fontMeta: {
      label: "IBM Plex Sans / JetBrains Mono",
    },
    preview: {
      surface: "#111317",
      accent: "#8fa3ff",
      text: "#ebecef",
      sansScale: 1,
      monoScale: 1,
    },
    modes: {
      light: graphiteLight,
      dark: graphiteDark,
    },
  },
  {
    id: "blueprint",
    label: "Blueprint",
    description: "A blue-forward theme tuned for dashboards with clearer depth and stronger focus.",
    fonts: {
      sans: '"Space Grotesk Variable", "Space Grotesk", sans-serif',
      mono: '"Source Code Pro Variable", "Source Code Pro", monospace',
    },
    fontMeta: {
      label: "Space Grotesk / Source Code Pro",
    },
    preview: {
      surface: "#0e1630",
      accent: "#6ea2ff",
      text: "#ecf2ff",
      sansScale: 0.96,
      monoScale: 1,
    },
    modes: {
      light: blueprintLight,
      dark: blueprintDark,
    },
  },
  {
    id: "amber",
    label: "Amber",
    description:
      "A warm operational palette that keeps the dashboard legible without losing urgency.",
    fonts: {
      sans: '"Fraunces Variable", "Fraunces", serif',
      mono: '"Inconsolata Variable", "Inconsolata", monospace',
    },
    fontMeta: {
      label: "Fraunces / Inconsolata",
    },
    preview: {
      surface: "#1a1410",
      accent: "#f0a14a",
      text: "#f5ede3",
      sansScale: 1.08,
      monoScale: 1.04,
    },
    modes: {
      light: amberLight,
      dark: amberDark,
    },
  },
  {
    id: "editorial",
    label: "Editorial",
    description: "A softer reading-forward theme with warmer contrast and calmer surfaces.",
    fonts: {
      sans: '"Newsreader Variable", "Newsreader", serif',
      mono: '"Inconsolata Variable", "Inconsolata", monospace',
    },
    fontMeta: {
      label: "Newsreader / Inconsolata",
    },
    preview: {
      surface: "#1b1511",
      accent: "#d68ab1",
      text: "#f3ece4",
      sansScale: 1.12,
      monoScale: 1.02,
    },
    modes: {
      light: editorialLight,
      dark: editorialDark,
    },
  },
  {
    id: "signal",
    label: "Signal",
    description: "A sharper technical theme with cleaner cyan edges and higher signal contrast.",
    fonts: {
      sans: '"Sora Variable", "Sora", sans-serif',
      mono: '"Chivo Mono Variable", "Chivo Mono", monospace',
    },
    fontMeta: {
      label: "Sora / Chivo Mono",
    },
    preview: {
      surface: "#0a1a22",
      accent: "#2fd4f7",
      text: "#e8fbff",
      sansScale: 0.98,
      monoScale: 0.98,
    },
    modes: {
      light: signalLight,
      dark: signalDark,
    },
  },
];

const themeFamilyMap = new Map(themeFamilies.map((family) => [family.id, family]));

export function getThemeFamily(themeFamilyId: string | null | undefined): ThemeFamily {
  return themeFamilyMap.get(themeFamilyId as ThemeFamilyId) ?? themeFamilies[0]!;
}

export function resolveThemeMode(
  themeMode: ThemeMode | null | undefined,
  systemMode: ResolvedThemeMode = "dark"
): ResolvedThemeMode {
  if (themeMode === "light" || themeMode === "dark") return themeMode;
  return systemMode;
}

export function resolveTheme(
  themeFamilyId: string | null | undefined,
  themeMode: ThemeMode | null | undefined,
  systemMode: ResolvedThemeMode = "dark"
): ResolvedTheme {
  const family = getThemeFamily(themeFamilyId);
  const mode = themeMode ?? DEFAULT_THEME_MODE;
  const resolvedMode = resolveThemeMode(mode, systemMode);
  return {
    family,
    mode,
    resolvedMode,
    variables: family.modes[resolvedMode],
  };
}

export function applyThemeVariables(root: HTMLElement, theme: ResolvedTheme): void {
  root.dataset.themeFamily = theme.family.id;
  root.style.colorScheme = theme.resolvedMode;
  root.style.setProperty("--font-sans", theme.family.fonts.sans);
  root.style.setProperty("--font-mono", theme.family.fonts.mono);
  root.style.setProperty("--default-font-family", theme.family.fonts.sans);
  root.style.setProperty("--default-mono-font-family", theme.family.fonts.mono);

  for (const [name, value] of Object.entries(theme.variables)) {
    root.style.setProperty(name, value);
  }
}

interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

function parseColor(input: string): RgbaColor {
  const value = input.trim();
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    if (hex.length === 3) {
      const [r, g, b] = hex.split("");
      return {
        r: Number.parseInt(`${r}${r}`, 16),
        g: Number.parseInt(`${g}${g}`, 16),
        b: Number.parseInt(`${b}${b}`, 16),
        a: 1,
      };
    }
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }

  const rgbaMatch = value.match(/rgba?\(([^)]+)\)/i);
  if (!rgbaMatch) {
    throw new Error(`Unsupported color format: ${input}`);
  }

  const [r, g, b, a = "1"] = rgbaMatch[1]!.split(",").map((part) => part.trim());
  return {
    r: Number.parseFloat(r!),
    g: Number.parseFloat(g!),
    b: Number.parseFloat(b!),
    a: Number.parseFloat(a),
  };
}

function compositeColor(foreground: RgbaColor, background: RgbaColor): RgbaColor {
  const alpha = foreground.a + background.a * (1 - foreground.a);
  if (alpha <= 0) return { r: 0, g: 0, b: 0, a: 0 };

  return {
    r: (foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / alpha,
    g: (foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / alpha,
    b: (foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / alpha,
    a: alpha,
  };
}

function getLuminance(color: RgbaColor): number {
  const normalize = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * normalize(color.r) + 0.7152 * normalize(color.g) + 0.0722 * normalize(color.b);
}

function getContrastRatio(foreground: RgbaColor, background: RgbaColor): number {
  const lighter = Math.max(getLuminance(foreground), getLuminance(background));
  const darker = Math.min(getLuminance(foreground), getLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function getThemeVariable(variables: ThemeVariableMap, token: keyof ThemeVariableMap): string {
  const value = variables[token];
  if (!value) {
    throw new Error(`Missing theme token: ${token}`);
  }
  return value;
}

type ThemeColorSource =
  | { type: "token"; token: keyof ThemeVariableMap }
  | { type: "alpha"; token: keyof ThemeVariableMap; alpha: number; over: keyof ThemeVariableMap };

function resolveColorSource(variables: ThemeVariableMap, source: ThemeColorSource): RgbaColor {
  if (source.type === "token") {
    const parsed = parseColor(getThemeVariable(variables, source.token));
    if (parsed.a < 1) {
      return compositeColor(
        parsed,
        parseColor(getThemeVariable(variables, "--theme-color-surface"))
      );
    }
    return parsed;
  }

  const tokenColor = parseColor(getThemeVariable(variables, source.token));
  const overColor = parseColor(getThemeVariable(variables, source.over));
  return compositeColor({ ...tokenColor, a: source.alpha }, overColor);
}

const CORE_CONTRAST_CHECKS: Array<{
  id: ThemeContrastReportItem["id"];
  foreground: ThemeColorSource;
  background: ThemeColorSource;
  minimumRatio: number;
}> = [
  {
    id: "foreground/background",
    foreground: { type: "token", token: "--theme-color-foreground" },
    background: { type: "token", token: "--theme-color-background" },
    minimumRatio: 4.5,
  },
  {
    id: "foreground/surface",
    foreground: { type: "token", token: "--theme-color-foreground" },
    background: { type: "token", token: "--theme-color-surface" },
    minimumRatio: 4.5,
  },
  {
    id: "foreground-secondary/surface",
    foreground: { type: "token", token: "--theme-color-foreground-secondary" },
    background: { type: "token", token: "--theme-color-surface" },
    minimumRatio: 4.5,
  },
  {
    id: "muted-foreground/surface",
    foreground: { type: "token", token: "--theme-color-muted-foreground" },
    background: { type: "token", token: "--theme-color-surface" },
    minimumRatio: 4.5,
  },
  {
    id: "dim/surface",
    foreground: { type: "token", token: "--theme-color-dim" },
    background: { type: "token", token: "--theme-color-surface" },
    minimumRatio: 4.5,
  },
  {
    id: "accent/accent-bg",
    foreground: { type: "token", token: "--theme-color-accent" },
    background: {
      type: "alpha",
      token: "--theme-color-accent",
      alpha: 0.1,
      over: "--theme-color-surface",
    },
    minimumRatio: 4.5,
  },
  {
    id: "destructive/destructive-bg",
    foreground: { type: "token", token: "--theme-color-destructive" },
    background: {
      type: "token",
      token: "--theme-color-destructive-bg",
    },
    minimumRatio: 4.5,
  },
  {
    id: "success/success-bg",
    foreground: { type: "token", token: "--theme-color-success" },
    background: { type: "token", token: "--theme-color-success-bg" },
    minimumRatio: 4.5,
  },
  {
    id: "warning/warning-bg",
    foreground: { type: "token", token: "--theme-color-warning" },
    background: { type: "token", token: "--theme-color-warning-bg" },
    minimumRatio: 4.5,
  },
];

export function getThemeContrastReport(
  themeFamilyId: string,
  resolvedMode: ResolvedThemeMode
): ThemeContrastReportItem[] {
  const theme = resolveTheme(themeFamilyId, resolvedMode, resolvedMode);

  return CORE_CONTRAST_CHECKS.map((check) => {
    const foreground = resolveColorSource(theme.variables, check.foreground);
    const background = resolveColorSource(theme.variables, check.background);
    const ratio = getContrastRatio(foreground, background);

    return {
      id: check.id,
      ratio,
      minimumRatio: check.minimumRatio,
      passes: ratio >= check.minimumRatio,
    };
  });
}
