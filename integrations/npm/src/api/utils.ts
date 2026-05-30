import type { DataSourceContext } from "@radarboard/integration-sdk/types";

export interface NpmIntegrationConfig {
  extraPackages?: string | null;
}

export interface NpmPackageFilters {
  include?: string[];
  exclude?: string[];
}

export function parsePackageList(raw: string | string[] | null | undefined): string[] {
  if (Array.isArray(raw)) {
    return Array.from(
      new Set(raw.map((value) => value.trim()).filter((value) => value.length > 0))
    );
  }

  if (!raw) return [];

  return Array.from(
    new Set(
      raw
        .split(/[\n,]/)
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    )
  );
}

export function matchesPackagePattern(packageName: string, pattern: string): boolean {
  const trimmed = pattern.trim();
  if (trimmed.length === 0) return false;
  if (!trimmed.includes("*")) return packageName === trimmed;

  const escaped = trimmed.replace(/[|\\{}()[\]^$+?.]/g, "\\$&").replaceAll("*", ".*");

  return new RegExp(`^${escaped}$`).test(packageName);
}

export function filterPackages(packageNames: string[], filters: NpmPackageFilters = {}): string[] {
  const includePatterns = parsePackageList(filters.include);
  const excludePatterns = parsePackageList(filters.exclude);

  const included =
    includePatterns.length === 0
      ? packageNames
      : packageNames.filter((packageName) =>
          includePatterns.some((pattern) => matchesPackagePattern(packageName, pattern))
        );

  if (excludePatterns.length === 0) return included;

  return included.filter(
    (packageName) => !excludePatterns.some((pattern) => matchesPackagePattern(packageName, pattern))
  );
}

export function extractLegacyProjectPackages(
  projects: Array<{
    platforms: Array<{ integrations: Record<string, unknown> }>;
  }>
): string[] {
  const packageNames = new Set<string>();

  for (const project of projects) {
    for (const platform of project.platforms) {
      const npm = platform.integrations.npm as { packageName?: string } | undefined;
      const packageName = npm?.packageName?.trim();
      if (packageName) packageNames.add(packageName);
    }
  }

  return Array.from(packageNames).sort((left, right) => left.localeCompare(right));
}

export async function resolveNpmCatalog(ctx: DataSourceContext): Promise<string[]> {
  const [integrationConfig, allProjects] = await Promise.all([
    ctx.resolveCredential("npm"),
    ctx.getAllProjects(),
  ]);

  const config = (integrationConfig ?? {}) as NpmIntegrationConfig;
  const manualPackages = parsePackageList(config.extraPackages);
  const legacyPackages = extractLegacyProjectPackages(allProjects);

  return Array.from(new Set([...manualPackages, ...legacyPackages])).sort((left, right) =>
    left.localeCompare(right)
  );
}
