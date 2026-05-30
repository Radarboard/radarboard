import type { DataPoint } from "./dashboard";

export interface RevenueKPI {
  value: number;
  previousValue: number;
  currency: string;
  sparklineData: DataPoint[];
}

export interface LastPayment {
  amount: number;
  currency: string;
  country: string;
  countryCode: string;
  projectName: string;
  projectColor: string;
  timeAgo: string;
}

export interface RevenueSeries {
  projectName: string;
  projectColor: string;
  data: DataPoint[];
}

/** Per-project breakdown for a single revenue KPI (populated in "All" view) */
export interface RevenueKPIBreakdown {
  projectName: string;
  projectColor: string;
  value: number;
}

export interface RevenueOverview {
  grossRevenue: RevenueKPI;
  mrr: RevenueKPI;
  netRevenue: RevenueKPI;
  lastPayment: LastPayment;
  /** Per-project breakdown for each KPI (populated in "All" view) */
  breakdown?: {
    grossRevenue: RevenueKPIBreakdown[];
    mrr: RevenueKPIBreakdown[];
    netRevenue: RevenueKPIBreakdown[];
  };
}
