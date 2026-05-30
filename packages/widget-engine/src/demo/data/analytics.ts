import type { AnalyticsOverview } from "@radarboard/types/analytics";
import { generateSparkline } from "./helpers";

// --- Analytics ---
export const MOCK_ANALYTICS: AnalyticsOverview = {
  liveVisitors: 12,
  metrics: {
    uniqueVisitors: 3420,
    totalSessions: 4800,
    totalPageViews: 12300,
    bounceRate: 42.5,
    avgSessionDuration: 195,
  },
  topPages: [
    {
      path: "/",
      title: "Homepage",
      sessions: 1560,
      bounceRate: 35.2,
      avgDuration: 125,
      projectName: "Pixel Studio",
      projectColor: "#E63946",
      platformName: "pixelstudio.app",
    },
    {
      path: "/editor",
      title: "Image Editor",
      sessions: 890,
      bounceRate: 28.1,
      avgDuration: 220,
      projectName: "Pixel Studio",
      projectColor: "#E63946",
      platformName: "pixelstudio.app",
    },
    {
      path: "/gallery",
      title: "Gallery",
      sessions: 670,
      bounceRate: 22.5,
      avgDuration: 310,
      projectName: "Pixel Studio",
      projectColor: "#E63946",
      platformName: "pixelstudio.app",
    },
  ],
  referrers: [
    { name: "google.com", sessions: 1670, bounceRate: 42.1 },
    { name: "twitter.com", sessions: 540, bounceRate: 38.9 },
    { name: "direct", sessions: 950, bounceRate: 40.5 },
  ],
  visitorTrend: generateSparkline(120, 30),
  platformBreakdown: [
    {
      platformId: "pixelstudio-app",
      platformName: "pixelstudio.app",
      projectName: "Pixel Studio",
      projectColor: "#E63946",
      uniqueVisitors: 2100,
      totalSessions: 2900,
      totalPageViews: 7500,
      bounceRate: 38.2,
      avgSessionDuration: 210,
      liveVisitors: 8,
    },
    {
      platformId: "brewfinder-app",
      platformName: "brewfinder.app",
      projectName: "Brew Finder",
      projectColor: "#2A9D8F",
      uniqueVisitors: 1320,
      totalSessions: 1900,
      totalPageViews: 4800,
      bounceRate: 49.1,
      avgSessionDuration: 172,
      liveVisitors: 4,
    },
  ],
};
