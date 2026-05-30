/**
 * npm Downloads — Data types
 */

import type { WidgetTemplateConfig } from "@radarboard/widget-engine/templates";

export type NpmDownloadsRange = "7d" | "30d" | "90d" | "12m";

export interface NpmPackageData {
  name: string;
  weeklyDownloads: number;
  monthlyDownloads: number;
  version: string;
}

export interface NpmDownloadsData {
  packages: NpmPackageData[];
  totalWeekly: number;
  totalMonthly: number;
  _fetchedAt?: number;
}

export interface NpmDownloadsConfig extends WidgetTemplateConfig {
  includePackages?: string[];
  excludePackages?: string[];
}
