"use client";

import { useMemo } from "react";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  useRechartsModule,
} from "./chart";

const BAR_VALUE_KEY = "value";

interface MonitorBarChartProps {
  data: { name: string; value: number }[];
  color?: string;
  height?: number;
  layout?: "horizontal" | "vertical";
}

export function MonitorBarChart({
  data,
  color = "var(--color-chart-1)",
  height = 200,
  layout = "horizontal",
}: MonitorBarChartProps) {
  const recharts = useRechartsModule();
  const chartConfig = useMemo<ChartConfig>(
    () =>
      ({
        [BAR_VALUE_KEY]: { label: "Value", color },
      }) as ChartConfig,
    [color]
  );

  return (
    <ChartContainer config={chartConfig} className="min-h-0" style={{ height }}>
      {recharts ? (
        <recharts.BarChart
          data={data}
          layout={layout}
          margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
        >
          {layout === "vertical" ? (
            <>
              <recharts.XAxis type="number" hide />
              <recharts.YAxis
                dataKey="name"
                type="category"
                tickLine={false}
                axisLine={false}
                width={80}
              />
            </>
          ) : (
            <>
              <recharts.XAxis dataKey="name" tickLine={false} axisLine={false} />
              <recharts.YAxis hide />
            </>
          )}
          <ChartTooltip
            cursor={{ fill: "var(--color-muted)", opacity: 0.3 }}
            content={
              <ChartTooltipContent
                formatter={(value) => (
                  <span className="text-foreground tabular-nums">
                    {Number(value).toLocaleString()}
                  </span>
                )}
              />
            }
          />
          <recharts.Bar
            dataKey={BAR_VALUE_KEY}
            fill={`var(--color-${BAR_VALUE_KEY}, ${color})`}
            radius={0}
            isAnimationActive={false}
          />
        </recharts.BarChart>
      ) : null}
    </ChartContainer>
  );
}
