import type {
  CommonRouteParams,
  DataSourceContext,
  DataSourceDescriptor,
} from "@radarboard/integration-sdk/types";
import {
  filterPackages,
  type NpmPackageFilters,
  parsePackageList,
  resolveNpmCatalog,
} from "./utils";

interface NpmDownloadCount {
  downloads: number;
  start: string;
  end: string;
  package: string;
}

interface NpmPackageInfo {
  version: string;
}

async function fetchNpmDownloadsData(packageNames: string[]) {
  if (packageNames.length === 0) {
    return { packages: [], totalWeekly: 0, totalMonthly: 0 };
  }

  const results = await Promise.allSettled(
    packageNames.map(async (name) => {
      const [weeklyRes, monthlyRes, infoRes] = await Promise.all([
        fetch(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name)}`),
        fetch(`https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(name)}`),
        fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`),
      ]);

      const weekly = weeklyRes.ok ? ((await weeklyRes.json()) as NpmDownloadCount) : null;
      const monthly = monthlyRes.ok ? ((await monthlyRes.json()) as NpmDownloadCount) : null;
      const info = infoRes.ok ? ((await infoRes.json()) as NpmPackageInfo) : null;

      return {
        name,
        weeklyDownloads: weekly?.downloads ?? 0,
        monthlyDownloads: monthly?.downloads ?? 0,
        version: info?.version ?? "0.0.0",
      };
    })
  );

  const packages = results
    .filter(
      (
        r
      ): r is PromiseFulfilledResult<{
        name: string;
        weeklyDownloads: number;
        monthlyDownloads: number;
        version: string;
      }> => r.status === "fulfilled"
    )
    .map((r) => r.value);

  return {
    packages,
    totalWeekly: packages.reduce((sum, p) => sum + p.weeklyDownloads, 0),
    totalMonthly: packages.reduce((sum, p) => sum + p.monthlyDownloads, 0),
  };
}

export const npmDataSource: DataSourceDescriptor<NpmPackageFilters> = {
  action: "data",
  description: "npm package download stats.",
  cacheTtlSeconds: 3_600,
  pollingSourceId: "npm-downloads",
  parseParams: (searchParams) => ({
    include: searchParams.getAll("include"),
    exclude: searchParams.getAll("exclude"),
  }),
  buildCacheKey: (params: CommonRouteParams & NpmPackageFilters) => {
    const include = parsePackageList(params.include).sort().join("|");
    const exclude = parsePackageList(params.exclude).sort().join("|");
    return `npm-downloads:all:${include}:${exclude}`;
  },
  async fetch(params: CommonRouteParams & NpmPackageFilters, ctx: DataSourceContext) {
    const includeCandidates = parsePackageList(params.include).filter(
      (pattern) => !pattern.includes("*")
    );
    const catalog = Array.from(
      new Set([...(await resolveNpmCatalog(ctx)), ...includeCandidates])
    ).sort((left, right) => left.localeCompare(right));
    if (catalog.length === 0) return { configured: false };
    const filteredPackages = filterPackages(catalog, params);
    return fetchNpmDownloadsData(filteredPackages);
  },
};

export const npmDataSources: DataSourceDescriptor[] = [npmDataSource];
