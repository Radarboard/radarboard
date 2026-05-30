import type { SearchQuery, SeoQueryDetail } from "@radarboard/types/seo";

export type DiagnosisTone = "positive" | "neutral" | "warning";
export type DiagnosisPriority = "high" | "medium" | "low";
export type DiagnosisConfidence = "high" | "medium" | "low";

export interface SeoDiagnosisItem {
  label: string;
  detail: string;
  tone: DiagnosisTone;
}

export interface SeoDiagnosisRecommendation {
  title: string;
  detail: string;
  priority: DiagnosisPriority;
}

export interface SeoDiagnosisOpportunity {
  label: string;
  detail: string;
  tone: DiagnosisTone;
}

export interface SeoQueryDiagnosis {
  headline: string;
  summary: string;
  confidence: DiagnosisConfidence;
  dataWindowLabel: string | null;
  observations: SeoDiagnosisItem[];
  recommendations: SeoDiagnosisRecommendation[];
  opportunity: SeoDiagnosisOpportunity;
}

interface TrendSnapshot {
  deltaPct: number | null;
  first: number | null;
  last: number | null;
}

function formatSignedPercent(value: number): string {
  const rounded = Math.abs(value) >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${value > 0 ? "+" : ""}${rounded}%`;
}

function formatPositionDelta(value: number): string {
  const rounded = Math.abs(value) >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${value > 0 ? "+" : ""}${rounded}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getDateWindowLabel(detail: SeoQueryDetail): string | null {
  const trend = detail.clicksTrend.length > 0 ? detail.clicksTrend : detail.impressionsTrend;
  const start = trend[0]?.date;
  const end = trend[trend.length - 1]?.date;
  if (!start || !end) return null;
  return start === end ? start : `${start} to ${end}`;
}

function getRecentAverageDelta(values: number[]): number | null {
  if (values.length < 4) return null;

  const recentWindow = Math.min(7, Math.max(2, Math.floor(values.length / 2)));
  const recent = values.slice(-recentWindow);
  const previous = values.slice(-(recentWindow * 2), -recentWindow);
  if (previous.length === 0) return null;

  const recentAvg = recent.reduce((sum, value) => sum + value, 0) / recent.length;
  const previousAvg = previous.reduce((sum, value) => sum + value, 0) / previous.length;
  if (previousAvg === 0) return null;

  return ((recentAvg - previousAvg) / previousAvg) * 100;
}

function getTrendSnapshot(values: number[]): TrendSnapshot {
  return {
    deltaPct: getRecentAverageDelta(values),
    first: values[0] ?? null,
    last: values[values.length - 1] ?? null,
  };
}

function getShare(value: number, total: number): number | null {
  if (total <= 0) return null;
  return (value / total) * 100;
}

function getPositionRange(values: number[]): number | null {
  if (values.length < 2) return null;
  return Math.max(...values) - Math.min(...values);
}

function getTopPageShare(detail: SeoQueryDetail): number | null {
  const totalClicks = detail.pages.reduce((sum, page) => sum + page.clicks, 0);
  if (totalClicks > 0) {
    return getShare(detail.pages[0]?.clicks ?? 0, totalClicks);
  }

  const totalImpressions = detail.pages.reduce((sum, page) => sum + page.impressions, 0);
  return getShare(detail.pages[0]?.impressions ?? 0, totalImpressions);
}

function getTopDeviceShare(detail: SeoQueryDetail): number | null {
  const totalClicks = detail.devices.reduce((sum, device) => sum + device.clicks, 0);
  return getShare(detail.devices[0]?.clicks ?? 0, totalClicks);
}

function getTopCountryShare(detail: SeoQueryDetail): number | null {
  const totalClicks = detail.countries.reduce((sum, country) => sum + country.clicks, 0);
  return getShare(detail.countries[0]?.clicks ?? 0, totalClicks);
}

function getPrimaryPagePath(page: string | null): string | null {
  if (!page) return null;
  try {
    return new URL(page).pathname || "/";
  } catch {
    return page;
  }
}

function isPageOne(position: number): boolean {
  return position <= 10;
}

function getConfidence(detail: SeoQueryDetail): DiagnosisConfidence {
  let signalCount = 0;
  if (detail.clicksTrend.length >= 4) signalCount += 1;
  if (detail.impressionsTrend.length >= 4) signalCount += 1;
  if (detail.positionTrend.length >= 4) signalCount += 1;
  if (detail.pages.length > 0) signalCount += 1;
  if (detail.devices.length > 0) signalCount += 1;
  if (detail.countries.length > 0) signalCount += 1;

  if (signalCount >= 5) return "high";
  if (signalCount >= 3) return "medium";
  return "low";
}

function getHeadline(query: SearchQuery, siteAvgCtr: number): string {
  if (query.position <= 3 && query.ctr >= siteAvgCtr) {
    return "Strong query with maintainable upside";
  }
  if (query.position <= 10 && query.ctr >= siteAvgCtr) {
    return "Healthy page-one query with top-3 upside";
  }
  if (query.position <= 10 && query.ctr < siteAvgCtr) {
    return "Visible query with a snippet improvement opportunity";
  }
  return "Developing query that still needs visibility gains";
}

function getOpportunity(
  query: SearchQuery,
  detail: SeoQueryDetail,
  siteAvgCtr: number
): SeoDiagnosisOpportunity {
  const ctrGap = query.ctr - siteAvgCtr;
  const positionRange = getPositionRange(detail.positionTrend.map((point) => point.value)) ?? 0;

  if (query.position <= 5 && ctrGap <= -2) {
    return {
      label: "CTR opportunity",
      detail:
        "The query already ranks well enough that snippet improvements could unlock faster gains.",
      tone: "warning",
    };
  }

  if (query.position > 3 && query.position <= 10 && query.impressions >= 20) {
    return {
      label: "Top-3 opportunity",
      detail: "This term is already visible on page one and looks close enough to push higher.",
      tone: "positive",
    };
  }

  if (positionRange >= 3) {
    return {
      label: "Stability opportunity",
      detail:
        "Recent ranking movement is wide enough that stabilizing the primary page could help.",
      tone: "warning",
    };
  }

  return {
    label: "Monitor and compound",
    detail:
      "The query looks reasonably healthy; the best move is incremental improvement on the winning page.",
    tone: "neutral",
  };
}

function buildCtrObservation(query: SearchQuery, ctrGap: number): SeoDiagnosisItem {
  const direction = ctrGap >= 0 ? "above" : "below";
  return {
    label: "CTR vs site average",
    detail: `${formatPercent(query.ctr)} is ${formatSignedPercent(ctrGap)} ${direction} the site average.`,
    tone: ctrGap >= 0 ? "positive" : "warning",
  };
}

function buildRankingObservation(query: SearchQuery, positionGap: number): SeoDiagnosisItem {
  const better = positionGap >= 0;
  return {
    label: "Current ranking",
    detail: better
      ? `Average position ${query.position.toFixed(1)} is better than the site average by ${formatPositionDelta(positionGap)}.`
      : `Average position ${query.position.toFixed(1)} trails the site average by ${formatPositionDelta(positionGap)}.`,
    tone: better ? "positive" : "warning",
  };
}

function buildMomentumObservation(
  clicksTrend: { deltaPct: number | null },
  impressionsTrend: { deltaPct: number | null }
): SeoDiagnosisItem | null {
  if (clicksTrend.deltaPct == null && impressionsTrend.deltaPct == null) return null;
  const parts: string[] = [];
  if (clicksTrend.deltaPct != null)
    parts.push(`clicks ${formatSignedPercent(clicksTrend.deltaPct)}`);
  if (impressionsTrend.deltaPct != null)
    parts.push(`impressions ${formatSignedPercent(impressionsTrend.deltaPct)}`);
  return {
    label: "Recent momentum",
    detail: `Over the recent window, ${parts.join(" and ")} versus the prior period.`,
    tone:
      (clicksTrend.deltaPct ?? 0) >= 0 && (impressionsTrend.deltaPct ?? 0) >= 0
        ? "positive"
        : "neutral",
  };
}

function buildStabilityObservation(positionRange: number | null): SeoDiagnosisItem | null {
  if (positionRange == null) return null;
  return {
    label: "Ranking stability",
    detail: `Recent position moved within a ${positionRange.toFixed(1)}-point range.`,
    tone: (() => {
      if (positionRange <= 2) return "positive" as const;
      if (positionRange >= 4) return "warning" as const;
      return "neutral" as const;
    })(),
  };
}

function buildPageObservation(detail: SeoQueryDetail): SeoDiagnosisItem | null {
  const topPage = detail.pages[0];
  const topPageShare = getTopPageShare(detail);
  if (!topPage || topPageShare == null) return null;
  return {
    label: "Primary ranking page",
    detail: `${getPrimaryPagePath(topPage.page) ?? topPage.page} drives about ${topPageShare.toFixed(0)}% of recorded page-level demand.`,
    tone: topPageShare >= 70 ? "neutral" : "positive",
  };
}

function buildDeviceObservation(detail: SeoQueryDetail): SeoDiagnosisItem | null {
  const topDevice = detail.devices[0];
  const topDeviceShare = getTopDeviceShare(detail);
  if (!topDevice || topDeviceShare == null) return null;
  return {
    label: "Device mix",
    detail: `${topDevice.device.toLowerCase()} accounts for roughly ${topDeviceShare.toFixed(0)}% of clicks.`,
    tone: "neutral",
  };
}

function buildCountryObservation(detail: SeoQueryDetail): SeoDiagnosisItem | null {
  const topCountry = detail.countries[0];
  const topCountryShare = getTopCountryShare(detail);
  if (!topCountry || topCountryShare == null) return null;
  return {
    label: "Country concentration",
    detail: `${topCountry.country.toUpperCase()} contributes about ${topCountryShare.toFixed(0)}% of clicks.`,
    tone: "neutral",
  };
}

function buildObservations(
  query: SearchQuery,
  detail: SeoQueryDetail,
  siteAvgCtr: number,
  siteAvgPosition: number
): SeoDiagnosisItem[] {
  const ctrGap = query.ctr - siteAvgCtr;
  const positionGap = siteAvgPosition - query.position;
  const clicksTrend = getTrendSnapshot(detail.clicksTrend.map((p) => p.value));
  const impressionsTrend = getTrendSnapshot(detail.impressionsTrend.map((p) => p.value));
  const positionRange = getPositionRange(detail.positionTrend.map((p) => p.value));

  const candidates: (SeoDiagnosisItem | null)[] = [
    buildCtrObservation(query, ctrGap),
    buildRankingObservation(query, positionGap),
    buildMomentumObservation(clicksTrend, impressionsTrend),
    buildStabilityObservation(positionRange),
    buildPageObservation(detail),
    buildDeviceObservation(detail),
    buildCountryObservation(detail),
  ];

  return candidates.filter((item): item is SeoDiagnosisItem => item != null).slice(0, 4);
}

function buildRecommendations(
  query: SearchQuery,
  detail: SeoQueryDetail,
  siteAvgCtr: number
): SeoDiagnosisRecommendation[] {
  const recommendations: SeoDiagnosisRecommendation[] = [];
  const ctrGap = query.ctr - siteAvgCtr;
  const primaryPage = detail.pages[0];
  const primaryPagePath = getPrimaryPagePath(primaryPage?.page ?? null);
  const topPageShare = getTopPageShare(detail);
  const activePages = detail.pages.filter((page) => page.impressions > 0);
  const primaryActivePage = activePages[0];
  const secondaryActivePage = activePages[1];
  const topDevice = detail.devices[0];
  const topDeviceShare = getTopDeviceShare(detail);
  const positionValues = detail.positionTrend.map((point) => point.value);
  const positionRange = getPositionRange(positionValues);

  if (query.position > 3 && isPageOne(query.position)) {
    recommendations.push({
      title: "Push the primary page into the top 3",
      detail: `${primaryPagePath ?? "The leading page"} is already ranking on page one, so incremental content and internal-link improvements are the fastest next lever.`,
      priority: "high",
    });
  }

  if (query.position <= 5 && ctrGap <= -2) {
    recommendations.push({
      title: "Improve the SERP snippet",
      detail:
        "CTR is lagging despite strong visibility, so title and meta experiments are likely the quickest gain.",
      priority: "high",
    });
  }

  if (topPageShare != null && topPageShare >= 70 && primaryPagePath) {
    recommendations.push({
      title: "Deepen coverage on the winning page",
      detail: `${primaryPagePath} carries most of the demand, so expanding examples, internal links, and supporting sections there should compound results.`,
      priority: "medium",
    });
  }

  if (
    primaryActivePage &&
    secondaryActivePage &&
    Math.abs(primaryActivePage.position - secondaryActivePage.position) <= 2 &&
    secondaryActivePage.impressions >= primaryActivePage.impressions * 0.3
  ) {
    recommendations.push({
      title: "Clarify the primary target page",
      detail:
        "More than one page is ranking in a similar band, which can dilute relevance and click concentration.",
      priority: "medium",
    });
  }

  if (topDevice && topDeviceShare != null && topDevice.device.toLowerCase() === "desktop") {
    recommendations.push({
      title: "Check the mobile result before scaling",
      detail: `Desktop currently drives about ${topDeviceShare.toFixed(0)}% of clicks, so confirm the mobile snippet and landing experience are not capping growth.`,
      priority: "low",
    });
  }

  if (positionRange != null && positionRange >= 4) {
    recommendations.push({
      title: "Monitor ranking volatility",
      detail:
        "The position range is wide enough that small content or internal-link changes should be validated carefully before and after publishing.",
      priority: "medium",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      title: "Preserve the current win",
      detail:
        "This query looks comparatively healthy; keep the primary page fresh and watch for CTR or rank decay.",
      priority: "low",
    });
  }

  return recommendations.slice(0, 3);
}

export function buildSeoQueryDiagnosis(
  query: SearchQuery,
  detail: SeoQueryDetail,
  siteAvgCtr: number,
  siteAvgPosition: number
): SeoQueryDiagnosis {
  const confidence = getConfidence(detail);
  const opportunity = getOpportunity(query, detail, siteAvgCtr);
  const observations = buildObservations(query, detail, siteAvgCtr, siteAvgPosition);
  const recommendations = buildRecommendations(query, detail, siteAvgCtr);
  const dataWindowLabel = getDateWindowLabel(detail);
  const topPage = getPrimaryPagePath(detail.pages[0]?.page ?? null);
  const ctrGap = query.ctr - siteAvgCtr;

  const getPositionSummary = () => {
    if (query.position <= 3) return "The query is already ranking strongly.";
    if (isPageOne(query.position)) return "The query is visible on page one with room to climb.";
    return "The query still needs stronger visibility.";
  };
  const getCtrSummary = () => {
    if (ctrGap >= 2) return "CTR is outperforming the site average.";
    if (ctrGap <= -2) return "CTR is underperforming the site average.";
    return "CTR is roughly in line with the site average.";
  };
  const summaryParts = [
    getPositionSummary(),
    getCtrSummary(),
    topPage
      ? `${topPage} looks like the primary landing page for this term.`
      : "The current signals still point to a single main landing page opportunity.",
  ];

  return {
    headline: getHeadline(query, siteAvgCtr),
    summary: summaryParts.join(" "),
    confidence,
    dataWindowLabel,
    observations,
    recommendations,
    opportunity,
  };
}
