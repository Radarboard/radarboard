import type { RevenueOverview, RevenueSeries } from "@radarboard/types/revenue";
import { generateSparkline } from "./helpers";

// --- Revenue ---
export const MOCK_REVENUE: RevenueOverview = {
  grossRevenue: {
    value: 4250,
    previousValue: 3800,
    currency: "USD",
    sparklineData: generateSparkline(150),
  },
  mrr: {
    value: 3890,
    previousValue: 3620,
    currency: "USD",
    sparklineData: generateSparkline(130),
  },
  netRevenue: {
    value: 3200,
    previousValue: 2950,
    currency: "USD",
    sparklineData: generateSparkline(110),
  },
  lastPayment: {
    amount: 4.99,
    currency: "USD",
    country: "United States",
    countryCode: "US",
    projectName: "Pixel Studio",
    projectColor: "#E63946",
    timeAgo: "2h ago",
  },
};

// --- Revenue Over Time ---
export const MOCK_REVENUE_SERIES: RevenueSeries[] = [
  {
    projectName: "Pixel Studio",
    projectColor: "#E63946",
    data: [
      { date: "2025-07", value: 2000 },
      { date: "2025-08", value: 2160 },
      { date: "2025-09", value: 2330 },
      { date: "2025-10", value: 2520 },
      { date: "2025-11", value: 2720 },
      { date: "2025-12", value: 2940 },
      { date: "2026-01", value: 3170 },
      { date: "2026-02", value: 3420 },
      { date: "2026-03", value: 3690 },
    ],
  },
];
