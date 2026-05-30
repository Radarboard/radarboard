"use client";

import { useMemo } from "react";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  useRechartsModule,
} from "./chart";

interface MonitorAreaChartProps {
  data: Record<string, unknown>[];
  dataKey: string;
  color?: string;
  height?: number;
  showXAxis?: boolean;
  formatValue?: (value: number) => string;
}

export function MonitorAreaChart({
  data,
  dataKey,
  color = "var(--color-chart-1)",
  height = 200,
  showXAxis = true,
  formatValue = (v) => String(v),
}: MonitorAreaChartProps) {
  const recharts = useRechartsModule();
  const chartConfig = useMemo<ChartConfig>(
    () =>
      ({
        [dataKey]: { label: dataKey, color },
      }) as ChartConfig,
    [dataKey, color]
  );

  const gradId = `area-${dataKey.replace(/[^a-zA-Z0-9]/g, "-")}`;

  return (
    <ChartContainer config={chartConfig} className="min-h-0" style={{ height }}>
      {recharts ? (
        <recharts.AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={`var(--color-${dataKey}, ${color})`} stopOpacity={0.3} />
              <stop offset="100%" stopColor={`var(--color-${dataKey}, ${color})`} stopOpacity={0} />
            </linearGradient>
          </defs>
          {Boolean(showXAxis) && (
            <recharts.XAxis dataKey="date" tickLine={false} axisLine={false} />
          )}
          <recharts.YAxis hide />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => (
                  <span className="text-foreground tabular-nums">{formatValue(Number(value))}</span>
                )}
              />
            }
          />
          <recharts.Area
            type="monotone"
            dataKey={dataKey}
            stroke={`var(--color-${dataKey}, ${color})`}
            strokeWidth={1.5}
            fill={`url(#${gradId})`}
            dot={false}
            isAnimationActive={false}
          />
        </recharts.AreaChart>
      ) : null}
    </ChartContainer>
  );
}
