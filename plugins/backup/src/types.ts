/**
 * Backup & Export — Data types
 */

export type ExportFormat = "json" | "csv";

export interface BackupSettings {
  defaultFormat: ExportFormat;
  defaultRange: string;
}

export const DEFAULT_SETTINGS: BackupSettings = {
  defaultFormat: "json",
  defaultRange: "30d",
};

export interface ExportResult {
  filename: string;
  format: ExportFormat;
  size: number;
  itemCount: number;
  createdAt: string;
}

export interface ExportableSource {
  id: string;
  name: string;
  description: string;
}

export const EXPORTABLE_SOURCES: ExportableSource[] = [
  { id: "analytics", name: "Analytics", description: "Visitor and session data from OpenPanel" },
  { id: "revenue", name: "Revenue", description: "Revenue data from RevenueCat" },
  { id: "seo", name: "SEO", description: "Search performance from Google Search Console" },
  { id: "github", name: "GitHub", description: "PRs, issues, stars, and commits" },
  { id: "linear", name: "Linear", description: "Issues and project data" },
  { id: "deployments", name: "Deployments", description: "Deployment history from Vercel" },
  { id: "errors", name: "Errors", description: "Error tracking from Sentry" },
];
