"use client";

import { useId, useMemo } from "react";
import { type ChartConfig, ChartContainer, useRechartsModule } from "./chart";

const SPARK_KEY = "value";

interface SparklineProps {
  data: { value: number }[];
  color?: string;
  height?: number;
  positive?: boolean;
  /** Show tooltip and active dot on hover. Default: true. */
  interactive?: boolean;
}

function CustomTooltip({
  active,
  payload,
  strokeColor,
}: {
  active?: boolean;
  payload?: { value: number }[];
  strokeColor: string;
}) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value ?? 0;
  return (
    <div className="rounded-item border border-border bg-surface-raised px-2 py-1 font-mono text-w-sm shadow-lg">
      <span style={{ color: strokeColor }}>
        {value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}

export function Sparkline({
  data,
  color,
  height = 40,
  positive = true,
  interactive = true,
}: SparklineProps) {
  const recharts = useRechartsModule();
  const strokeColor = color ?? (positive ? "#4ade80" : "#e05555");
  const reactId = useId();
  const gradId = `spark-${reactId.replace(/:/g, "")}`;

  const chartConfig = useMemo<ChartConfig>(
    () =>
      ({
        [SPARK_KEY]: { label: "Value", color: strokeColor },
      }) as ChartConfig,
    [strokeColor]
  );

  return (
    <ChartContainer config={chartConfig} className="min-h-0" style={{ height }}>
      {recharts ? (
        <recharts.AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={`var(--color-${SPARK_KEY}, ${strokeColor})`}
                stopOpacity={0.3}
              />
              <stop
                offset="100%"
                stopColor={`var(--color-${SPARK_KEY}, ${strokeColor})`}
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          {Boolean(interactive) && (
            <recharts.Tooltip
              content={<CustomTooltip strokeColor={strokeColor} />}
              cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
            />
          )}
          <recharts.Area
            type="monotone"
            dataKey={SPARK_KEY}
            stroke={`var(--color-${SPARK_KEY}, ${strokeColor})`}
            strokeWidth={1.5}
            fill={`url(#${gradId})`}
            dot={false}
            activeDot={
              interactive
                ? { r: 3, fill: strokeColor, stroke: "var(--color-surface)", strokeWidth: 1.5 }
                : false
            }
            isAnimationActive={false}
          />
        </recharts.AreaChart>
      ) : null}
    </ChartContainer>
  );
}
