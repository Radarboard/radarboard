"use client";

import { formatCurrency } from "@radarboard/utils/format-currency";
import { type ComponentType, type CSSProperties, useMemo } from "react";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  useRechartsModule,
} from "./chart";

type Margin = { top?: number; right?: number; left?: number; bottom?: number };

interface Series {
  name: string;
  color: string;
  dataKey: string;
}

interface MonitorLineChartProps {
  data: Record<string, unknown>[];
  series: Series[];
  height?: number | `${number}%`;
  showXAxis?: boolean;
  showYAxis?: boolean;
  yDomain?: [number, number];
  /** Currency code for default value formatting (default: "USD") */
  currency?: string;
  formatValue?: (value: number) => string;
  /** Per-series tooltip formatting keyed by dataKey. Falls back to formatValue. */
  formatSeriesValue?: Record<string, (value: number) => string>;
  /** Custom Recharts Tooltip `content` render function. When set, overrides the default tooltip. */
  // biome-ignore lint/suspicious/noExplicitAny: Recharts injects tooltip props at runtime
  tooltipContent?: ComponentType<any>;
  /** Overrides default margin; merged after axis-free tight insets when both axes are off. */
  chartMargin?: Partial<Margin>;
}

const DEFAULT_CHART_MARGIN: Margin = { top: 5, right: 10, left: 10, bottom: 5 };

export function MonitorLineChart({
  data,
  series,
  height = 300,
  showXAxis = true,
  showYAxis = false,
  yDomain,
  currency = "USD",
  formatValue = (v) => formatCurrency(v, currency, { compact: true }),
  formatSeriesValue,
  tooltipContent: CustomTooltipContent,
  chartMargin,
}: MonitorLineChartProps) {
  const recharts = useRechartsModule();
  const chartConfig = useMemo<ChartConfig>(
    () =>
      Object.fromEntries(
        series.map((s) => [s.dataKey, { label: s.name, color: s.color }])
      ) as ChartConfig,
    [series]
  );

  const containerStyle: CSSProperties =
    typeof height === "number" ? { height } : { height: "100%" };
  const fillParent = typeof height === "string" && height === "100%";
  const axisFree = !showXAxis && !showYAxis;
  const margin: Margin = {
    ...DEFAULT_CHART_MARGIN,
    ...(axisFree ? { top: 0, right: 0, left: 0, bottom: 0 } : {}),
    ...chartMargin,
  };

  return (
    <ChartContainer
      config={chartConfig}
      measured
      className={fillParent ? "h-full min-h-0 w-full min-w-0 flex-1" : "min-h-0 w-full min-w-0"}
      style={containerStyle}
    >
      {recharts ? (
        <recharts.LineChart data={data} margin={margin}>
          {Boolean(showXAxis) && (
            <recharts.XAxis dataKey="date" tickLine={false} axisLine={false} />
          )}
          {Boolean(showYAxis) && (
            <recharts.YAxis
              width={40}
              domain={yDomain}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => formatValue(v)}
            />
          )}
          {Boolean(!showYAxis && yDomain) && (
            <recharts.YAxis domain={yDomain} hide padding={{ top: 0, bottom: 0 }} />
          )}
          {CustomTooltipContent ? (
            <ChartTooltip content={<CustomTooltipContent />} />
          ) : (
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name, item) => {
                    const fn = formatSeriesValue?.[String(name)];
                    let text: string;
                    if (fn) {
                      const rawKey = `_raw_${String(item.dataKey)}`;
                      const raw = item.payload?.[rawKey];
                      text = fn(typeof raw === "number" ? raw : Number(value));
                    } else {
                      text = formatValue(Number(value));
                    }
                    return <span className="text-foreground tabular-nums">{text}</span>;
                  }}
                />
              }
            />
          )}
          {series.map((s) => (
            <recharts.Line
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.name}
              stroke={`var(--color-${s.dataKey}, ${s.color})`}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </recharts.LineChart>
      ) : null}
    </ChartContainer>
  );
}
