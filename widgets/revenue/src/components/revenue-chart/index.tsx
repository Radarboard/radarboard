"use client";

import { MonitorLineChart } from "@radarboard/charts/line-chart";
import type { RevenueSeries } from "@radarboard/types/revenue";

interface RevenueChartProps {
  series: RevenueSeries[];
  height?: number;
  currency?: string;
}

export function RevenueChart({ series, height = 280, currency }: RevenueChartProps) {
  if (series.length === 0) return null;

  // Merge all series data into a single dataset keyed by date
  const dateMap = new Map<string, Record<string, unknown>>();
  for (const s of series) {
    for (const point of s.data) {
      const existing = dateMap.get(point.date) ?? { date: point.date };
      existing[s.projectName] = point.value;
      dateMap.set(point.date, existing);
    }
  }

  const chartData = Array.from(dateMap.values()).sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  );

  const chartSeries = series.map((s) => ({
    name: s.projectName,
    color: s.projectColor,
    dataKey: s.projectName,
  }));

  return (
    <div className="px-3 pb-3">
      <div className="mb-3 flex flex-wrap gap-3">
        {series.map((s) => (
          <div key={s.projectName} className="flex items-center gap-1.5">
            <span
              className="inline-block h-1.5 w-3 rounded-item"
              style={{ backgroundColor: s.projectColor }}
            />
            <span className="font-mono text-muted-foreground text-w-sm">{s.projectName}</span>
          </div>
        ))}
      </div>
      <MonitorLineChart
        data={chartData}
        series={chartSeries}
        height={height}
        showXAxis
        showYAxis
        currency={currency}
      />
    </div>
  );
}
