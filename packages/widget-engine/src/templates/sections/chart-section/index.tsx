"use client";

import { MonitorAreaChart } from "@radarboard/charts/area-chart";
import { MonitorBarChart } from "@radarboard/charts/bar-chart";
import { MonitorLineChart } from "@radarboard/charts/line-chart";
import { Sparkline } from "@radarboard/charts/sparkline";
import { formatDate } from "@radarboard/utils/format-date-time";
import { useCallback, useMemo } from "react";
import { useResolvedData, useResolvedSourceState } from "../../data-resolver";
import type { ChartSectionConfig, ChartSeriesConfig } from "../../types";
import { useTemplateFormatting } from "../../use-formatting";

type ChartRecord = Record<string, unknown>;

function toChartRecords(input: unknown): ChartRecord[] {
  if (!Array.isArray(input)) return [];
  return input.filter((item): item is ChartRecord => !!item && typeof item === "object");
}

const DEFAULT_SERIES_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-2)",
  "var(--color-chart-5)",
];

function formatByKind(value: number, format?: ChartSeriesConfig["format"]): string {
  switch (format) {
    case "percent":
      return `${value.toFixed(1)}%`;
    case "decimal":
      return value.toFixed(1);
    case "compact":
      return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(Math.round(value));
    default:
      return String(Math.round(value));
  }
}

function buildSeriesFormatters(
  seriesCfg: ChartSeriesConfig[]
): Record<string, (v: number) => string> {
  const map: Record<string, (v: number) => string> = {};
  for (const s of seriesCfg) {
    const fmt = s.format;
    map[s.name] = (v: number) => formatByKind(v, fmt);
  }
  return map;
}

function computeMinMax(records: ChartRecord[], seriesCfg: ChartSeriesConfig[]) {
  const mins = new Map<string, number>();
  const maxs = new Map<string, number>();
  for (const s of seriesCfg) {
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (const r of records) {
      const v = typeof r[s.dataKey] === "number" ? (r[s.dataKey] as number) : 0;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    mins.set(s.dataKey, lo);
    maxs.set(s.dataKey, hi);
  }
  return { mins, maxs };
}

function normalizeRow(
  r: ChartRecord,
  seriesCfg: ChartSeriesConfig[],
  mins: Map<string, number>,
  maxs: Map<string, number>,
  xKey: string
): ChartRecord {
  const row: ChartRecord = { [xKey]: r[xKey] };
  for (const s of seriesCfg) {
    const raw = typeof r[s.dataKey] === "number" ? (r[s.dataKey] as number) : 0;
    const lo = mins.get(s.dataKey) ?? 0;
    const hi = maxs.get(s.dataKey) ?? 0;
    const range = hi - lo;
    row[s.dataKey] = range > 0 ? ((raw - lo) / range) * 100 : 50;
    row[`_raw_${s.dataKey}`] = raw;
  }
  return row;
}

function buildNormalizedData(records: ChartRecord[], seriesCfg: ChartSeriesConfig[], xKey: string) {
  const { mins, maxs } = computeMinMax(records, seriesCfg);
  const data = records.map((r) => normalizeRow(r, seriesCfg, mins, maxs, xKey));
  return { data, formatSeriesValue: buildSeriesFormatters(seriesCfg) };
}

function buildPassthroughData(
  records: ChartRecord[],
  seriesCfg: ChartSeriesConfig[],
  xKey: string
) {
  const data = records.map((r) => {
    const row: ChartRecord = { [xKey]: r[xKey] };
    for (const s of seriesCfg) {
      row[s.dataKey] = typeof r[s.dataKey] === "number" ? r[s.dataKey] : 0;
    }
    return row;
  });
  return { data, formatSeriesValue: buildSeriesFormatters(seriesCfg) };
}

function MultiSeriesTooltip({
  active,
  payload,
  label,
  seriesCfg,
  allData,
  normalize,
  locale,
}: {
  active?: boolean;
  // biome-ignore lint/suspicious/noExplicitAny: Recharts payload items vary
  payload?: any[];
  label?: string;
  seriesCfg: ChartSeriesConfig[];
  allData: ChartRecord[];
  normalize?: boolean;
  locale: string;
}) {
  if (!active || !payload?.length) return null;

  const currentRow = payload[0]?.payload as ChartRecord | undefined;
  const currentIdx = allData.indexOf(currentRow as ChartRecord);
  const prevRow = currentIdx > 0 ? allData[currentIdx - 1] : undefined;

  return (
    <div className="border border-border bg-surface-raised px-3 py-2 shadow-lg">
      <div className="mb-1.5 font-mono text-dim text-w-xs">
        {typeof label === "string" ? (formatDate(label, { locale }) ?? label) : String(label ?? "")}
      </div>
      <div className="grid grid-cols-[8px_1fr_auto] items-center gap-x-2 gap-y-1">
        {seriesCfg.map((s) => {
          const rawKey = normalize ? `_raw_${s.dataKey}` : s.dataKey;
          const raw = typeof currentRow?.[rawKey] === "number" ? (currentRow[rawKey] as number) : 0;
          const prevRaw =
            prevRow && typeof prevRow[rawKey] === "number" ? (prevRow[rawKey] as number) : null;
          const delta = prevRaw !== null ? raw - prevRaw : null;
          const color =
            s.color ?? DEFAULT_SERIES_COLORS[seriesCfg.indexOf(s) % DEFAULT_SERIES_COLORS.length];

          return (
            <TooltipRow
              key={s.dataKey}
              color={color ?? "var(--color-chart-1)"}
              label={s.name}
              value={formatByKind(raw, s.format)}
              delta={delta}
              deltaFormat={s.format}
            />
          );
        })}
      </div>
    </div>
  );
}

function TooltipRow({
  color,
  label,
  value,
  delta,
  deltaFormat,
}: {
  color: string;
  label: string;
  value: string;
  delta: number | null;
  deltaFormat?: ChartSeriesConfig["format"];
}) {
  return (
    <>
      <div className="size-2 shrink-0" style={{ backgroundColor: color }} />
      <span className="font-mono text-dim text-w-xs">{label}</span>
      <span className="text-right font-mono text-foreground text-w-xs tabular-nums">
        {value}
        {delta !== null && (
          <span className={delta >= 0 ? "ml-1 text-positive" : "ml-1 text-negative"}>
            {delta >= 0 ? "+" : ""}
            {formatByKind(delta, deltaFormat)}
          </span>
        )}
      </span>
    </>
  );
}

function MultiSeriesLineChart({
  config,
  records,
  height,
  xKey,
}: {
  config: ChartSectionConfig;
  records: ChartRecord[];
  height: number | "100%";
  xKey: string;
}) {
  const { locale } = useTemplateFormatting();
  const seriesCfg = config.series ?? [];

  const result = useMemo(
    () =>
      config.normalize
        ? buildNormalizedData(records, seriesCfg, xKey)
        : buildPassthroughData(records, seriesCfg, xKey),
    [config.normalize, records, seriesCfg, xKey]
  );

  const lineSeries = seriesCfg.map((s, i) => ({
    name: s.name,
    dataKey: s.dataKey,
    color:
      s.color ?? DEFAULT_SERIES_COLORS[i % DEFAULT_SERIES_COLORS.length] ?? "var(--color-chart-1)",
  }));

  const TooltipContent = useCallback(
    // biome-ignore lint/suspicious/noExplicitAny: Recharts tooltip props
    (props: any) => (
      <MultiSeriesTooltip
        {...props}
        seriesCfg={seriesCfg}
        allData={result.data}
        locale={locale}
        normalize={config.normalize}
      />
    ),
    [seriesCfg, result.data, config.normalize, locale]
  );

  return (
    <MonitorLineChart
      data={result.data}
      series={lineSeries}
      height={height}
      showXAxis={false}
      showYAxis={false}
      yDomain={config.normalize ? [0, 100] : undefined}
      tooltipContent={TooltipContent}
    />
  );
}

function SingleSeriesChart({
  config,
  records,
  height,
  xKey,
  yKey,
}: {
  config: ChartSectionConfig;
  records: ChartRecord[];
  height: number;
  xKey: string;
  yKey: string;
}) {
  const cartesianData = records.map((record) => ({
    date: record[xKey],
    [yKey]: typeof record[yKey] === "number" ? record[yKey] : 0,
  }));

  const barData = records.map((record) => ({
    name: String(record[xKey] ?? "—"),
    value: typeof record[yKey] === "number" ? record[yKey] : 0,
  }));

  const sparklineData = records.map((record) => ({
    value: typeof record[yKey] === "number" ? record[yKey] : 0,
  }));

  return (
    <div className="border-border border-t p-3">
      {config.variant === "area" && (
        <MonitorAreaChart
          data={cartesianData}
          dataKey={yKey}
          color={config.color}
          height={height}
        />
      )}

      {config.variant === "line" && (
        <MonitorLineChart
          data={cartesianData}
          series={[{ name: yKey, color: config.color ?? "#5b8af5", dataKey: yKey }]}
          height={height}
        />
      )}

      {config.variant === "bar" && (
        <MonitorBarChart data={barData} color={config.color} height={height} />
      )}

      {config.variant === "sparkline" && (
        <div className="h-10">
          <Sparkline data={sparklineData} color={config.color} height={height} />
        </div>
      )}
    </div>
  );
}

function MultiSeriesChartWrapper({
  config,
  records,
  height,
  xKey,
}: {
  config: ChartSectionConfig;
  records: ChartRecord[];
  height: number;
  xKey: string;
}) {
  const chartHeight = config.fillHeight ? ("100%" as const) : height;
  return (
    <div
      className={
        config.fillHeight
          ? "flex min-h-[120px] min-w-0 flex-1 flex-col overflow-hidden border-border border-t px-2 py-4"
          : "border-border border-t p-3"
      }
    >
      {config.fillHeight ? (
        <MultiSeriesLineChart config={config} records={records} height={chartHeight} xKey={xKey} />
      ) : (
        <MultiSeriesLineChart config={config} records={records} height={chartHeight} xKey={xKey} />
      )}
    </div>
  );
}

export function ChartSection({ config }: { config: ChartSectionConfig }) {
  const sourceState = useResolvedSourceState(config.source.sourceId);
  const resolved = useResolvedData(config.source, { disableItemContext: true });
  const records = toChartRecords(resolved);
  const height = config.height ?? (config.variant === "sparkline" ? 40 : 180);
  const xKey = config.xKey ?? (config.variant === "bar" ? "name" : "date");
  const yKey = config.yKey ?? "value";
  const isMultiSeries = config.variant === "line" && config.series && config.series.length > 0;

  if (sourceState.loading && records.length === 0) {
    return <div className="mx-3 my-3 h-24 animate-pulse bg-surface-raised" />;
  }

  if (records.length === 0) {
    return (
      <div className="flex min-h-widget-sm items-center justify-center px-3 font-mono text-dim text-w-sm">
        No data
      </div>
    );
  }

  if (isMultiSeries) {
    return (
      <MultiSeriesChartWrapper config={config} records={records} height={height} xKey={xKey} />
    );
  }

  return (
    <SingleSeriesChart config={config} records={records} height={height} xKey={xKey} yKey={yKey} />
  );
}
