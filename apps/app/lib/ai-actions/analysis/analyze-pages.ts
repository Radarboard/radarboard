/**
 * AI Action: Page Performance Analyzer
 *
 * Cross-references GSC search data with OpenPanel engagement data
 * to classify pages into actionable categories.
 */

interface SearchPage {
  query: string;
  path?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  siteUrl?: string;
}

interface EngagementPage {
  path: string;
  sessions: number;
  bounce_rate: number;
  avg_duration: number;
}

export interface PageClassification {
  path: string;
  category:
    | "high-search-low-engagement"
    | "low-search-high-engagement"
    | "winner"
    | "underperformer";
  searchMetrics: { clicks: number; impressions: number; ctr: number; position: number } | null;
  engagementMetrics: { sessions: number; bounceRate: number; avgDuration: number } | null;
  recommendation: string;
}

/**
 * Classify pages by combining search performance and engagement data.
 */
export function analyzePagePerformance(
  searchPages: SearchPage[],
  engagementPages: EngagementPage[]
): PageClassification[] {
  // Build lookup map by normalized path
  const engagementMap = new Map<string, EngagementPage>();
  for (const page of engagementPages) {
    const normalizedPath = page.path.split("?")[0]?.toLowerCase() ?? page.path;
    engagementMap.set(normalizedPath, page);
  }

  const results: PageClassification[] = [];
  const processedPaths = new Set<string>();

  // Classify pages that appear in search data
  for (const sp of searchPages) {
    const path = sp.path ?? "/";
    const normalizedPath = path.split("?")[0]?.toLowerCase() ?? path;
    if (processedPaths.has(normalizedPath)) continue;
    processedPaths.add(normalizedPath);

    const engagement = engagementMap.get(normalizedPath);
    const hasHighSearch = sp.impressions > 50;
    const hasHighEngagement = engagement
      ? engagement.bounce_rate < 60 && engagement.avg_duration > 60
      : false;

    let category: PageClassification["category"];
    let recommendation: string;

    if (hasHighSearch && !hasHighEngagement) {
      category = "high-search-low-engagement";
      recommendation =
        "Ranks well but visitors bounce. Improve content quality, loading speed, or match search intent better.";
    } else if (!hasHighSearch && hasHighEngagement) {
      category = "low-search-high-engagement";
      recommendation =
        "Great content that doesn't get search traffic. Optimize for target keywords, build backlinks, or promote on social.";
    } else if (hasHighSearch && hasHighEngagement) {
      category = "winner";
      recommendation =
        "Top performer — protect and expand this content. Consider creating supporting articles.";
    } else {
      category = "underperformer";
      recommendation =
        "Low search visibility and low engagement. Consider merging with better content, redirecting, or rewriting.";
    }

    results.push({
      path,
      category,
      searchMetrics: {
        clicks: sp.clicks,
        impressions: sp.impressions,
        ctr: sp.ctr,
        position: sp.position,
      },
      engagementMetrics: engagement
        ? {
            sessions: engagement.sessions,
            bounceRate: engagement.bounce_rate,
            avgDuration: engagement.avg_duration,
          }
        : null,
      recommendation,
    });
  }

  // Add engagement-only pages (no search data — potential promotion opportunities)
  for (const [path, engagement] of engagementMap) {
    if (processedPaths.has(path)) continue;
    if (engagement.sessions < 5) continue; // Skip very low traffic pages
    results.push({
      path: engagement.path,
      category: "low-search-high-engagement",
      searchMetrics: null,
      engagementMetrics: {
        sessions: engagement.sessions,
        bounceRate: engagement.bounce_rate,
        avgDuration: engagement.avg_duration,
      },
      recommendation: "Has engagement but no search presence. Consider SEO optimization.",
    });
  }

  // Sort: winners first, then opportunities, then issues
  const priority: Record<string, number> = {
    winner: 0,
    "high-search-low-engagement": 1,
    "low-search-high-engagement": 2,
    underperformer: 3,
  };
  return results.sort((a, b) => (priority[a.category] ?? 4) - (priority[b.category] ?? 4));
}
