"use client";

import { cn } from "@radarboard/utils/cn";
import {
  type ComponentProps,
  type CSSProperties,
  cloneElement,
  createContext,
  forwardRef,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const THEMES = { light: "", dark: ".dark" } as const;
type RechartsModule = typeof import("recharts");

type ChartConfigItem = {
  label?: ReactNode;
  icon?: React.ComponentType;
} & (
  | { color?: string; theme?: never }
  | { color?: never; theme: Record<keyof typeof THEMES, string> }
);

export type ChartConfig = Record<string, ChartConfigItem>;

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = createContext<ChartContextProps | null>(null);

export function useRechartsModule() {
  const [module, setModule] = useState<RechartsModule | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("recharts")
      .then((loaded) => {
        if (!cancelled) {
          setModule(loaded);
        }
      })
      .catch(() => {
        /* fire-and-forget */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return module;
}

export function useChart() {
  const context = useContext(ChartContext);
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }
  return context;
}

/** ResizeObserver → numeric `width` / `height` on a single Recharts chart child (reliable in flex layouts). */
function ChartMeasuredViewport({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ height: 0, width: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) {
        return;
      }
      const width = Math.max(1, Math.round(cr.width));
      const height = Math.max(1, Math.round(cr.height));
      setBox((prev) => (prev.width === width && prev.height === height ? prev : { height, width }));
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, []);

  const ready = box.width > 0 && box.height > 0 && isValidElement(children);

  return (
    <div ref={ref} className="h-full min-h-0 w-full min-w-0 flex-1">
      {ready
        ? cloneElement(children as ReactElement<{ height?: number; width?: number }>, {
            height: box.height,
            width: box.width,
          })
        : null}
    </div>
  );
}

const ChartContainer = forwardRef<
  HTMLDivElement,
  ComponentProps<"div"> & {
    config: ChartConfig;
    children: ReactNode;
    /**
     * When true, skips `ResponsiveContainer` and injects observed pixel `width`/`height` into the
     * child chart (must be a single Recharts element). Fixes flex/grid dashboards where % sizing
     * measures short (top-aligned chart, side gutters).
     */
    measured?: boolean;
  }
>(({ id, className, children, config, measured = false, ...props }, ref) => {
  const uniqueId = useId();
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`;
  const recharts = useRechartsModule();
  const ResponsiveContainerComponent = recharts?.ResponsiveContainer ?? null;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border",
          "[&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted/50 [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          "flex min-h-0 w-full flex-col text-w-xs [&_.recharts-responsive-container]:h-full [&_.recharts-responsive-container]:min-h-0 [&_.recharts-responsive-container]:w-full [&_.recharts-responsive-container]:min-w-0 [&_.recharts-wrapper]:h-full [&_.recharts-wrapper]:w-full",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        {measured ? (
          <ChartMeasuredViewport>{children}</ChartMeasuredViewport>
        ) : (
          <div className="h-full min-h-0 w-full min-w-0 flex-1">
            {ResponsiveContainerComponent ? (
              <ResponsiveContainerComponent
                height="100%"
                initialDimension={{ height: 1, width: 1 }}
                minHeight={0}
                minWidth={0}
                width="100%"
              >
                {children}
              </ResponsiveContainerComponent>
            ) : null}
          </div>
        )}
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = "ChartContainer";

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(([, item]) =>
    Boolean(item?.theme ?? item?.color)
  );

  if (!colorConfig.length) {
    return null;
  }

  return (
    <style>
      {Object.entries(THEMES)
        .map(
          ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color = itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ?? itemConfig.color;
    return color ? `  --color-${key}: ${color};` : null;
  })
  .filter(Boolean)
  .join("\n")}
}
`
        )
        .join("\n")}
    </style>
  );
}

function ChartTooltip(props: Record<string, unknown>) {
  const recharts = useRechartsModule();
  const TooltipComponent = recharts?.Tooltip ?? null;

  return TooltipComponent ? <TooltipComponent {...props} /> : null;
}

export type TooltipPayloadItem = {
  type?: string;
  color?: string;
  name?: string;
  dataKey?: string | number;
  value?: number | string;
  payload?: Record<string, unknown>;
  fill?: string;
};

type ChartTooltipContentProps = ComponentProps<"div"> & {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  labelFormatter?: (label: unknown, payload: unknown) => ReactNode;
  labelClassName?: string;
  formatter?: (
    value: number | string | undefined,
    name: string | undefined,
    item: TooltipPayloadItem,
    index: number,
    fullPayload: TooltipPayloadItem[]
  ) => ReactNode;
  color?: string;
  hideLabel?: boolean;
  hideIndicator?: boolean;
  indicator?: "line" | "dot" | "dashed";
  nameKey?: string;
  labelKey?: string;
};

function TooltipIndicator({
  indicator,
  hideIndicator,
  indicatorColor,
}: {
  indicator: "line" | "dot" | "dashed";
  hideIndicator: boolean;
  indicatorColor?: string;
}) {
  if (hideIndicator) return null;
  return (
    <div
      className={cn("shrink-0 rounded-item border-border bg-border", {
        "my-0.5 h-3 w-0 border-2 border-dashed bg-transparent": indicator === "dashed",
        "my-0.5 h-3 w-1": indicator === "line",
        "size-2": indicator === "dot",
      })}
      style={
        {
          backgroundColor: indicator === "dot" ? indicatorColor : undefined,
          borderColor: indicator !== "dot" ? indicatorColor : undefined,
        } as CSSProperties
      }
    />
  );
}

function TooltipPayloadRowDefault({
  item,
  itemConfig,
  hideIndicator,
  indicator,
  indicatorColor,
  nestLabel,
  tooltipLabel,
}: {
  item: TooltipPayloadItem;
  itemConfig?: ChartConfigItem;
  hideIndicator: boolean;
  indicator: "line" | "dot" | "dashed";
  indicatorColor?: string;
  nestLabel: boolean;
  tooltipLabel: ReactNode;
}) {
  return (
    <>
      {itemConfig?.icon ? (
        <itemConfig.icon />
      ) : (
        <TooltipIndicator
          hideIndicator={hideIndicator}
          indicator={indicator}
          indicatorColor={indicatorColor}
        />
      )}
      <div
        className={cn(
          "flex flex-1 justify-between gap-2 leading-none",
          nestLabel ? "items-end" : "items-center"
        )}
      >
        <div className="grid gap-1.5">
          {nestLabel ? tooltipLabel : null}
          <span className="text-muted-foreground">{itemConfig?.label ?? item.name}</span>
        </div>
        {item.value !== undefined && item.value !== null ? (
          <span className="font-mono text-foreground tabular-nums">
            {typeof item.value === "number" ? item.value.toLocaleString() : String(item.value)}
          </span>
        ) : null}
      </div>
    </>
  );
}

function TooltipPayloadRow({
  item,
  index,
  fullPayload,
  config,
  formatter,
  color,
  nameKey,
  hideIndicator,
  indicator,
  nestLabel,
  tooltipLabel,
}: {
  item: TooltipPayloadItem;
  index: number;
  fullPayload: TooltipPayloadItem[];
  config: ChartConfig;
  formatter?: ChartTooltipContentProps["formatter"];
  color?: string;
  nameKey?: string;
  hideIndicator: boolean;
  indicator: "line" | "dot" | "dashed";
  nestLabel: boolean;
  tooltipLabel: ReactNode;
}) {
  const key = `${nameKey ?? item.name ?? item.dataKey ?? "value"}`;
  const itemConfig = getPayloadConfigFromPayload(config, item, key);
  const fillFromPayload = item.payload?.fill;
  const indicatorColor =
    color ?? (typeof fillFromPayload === "string" ? fillFromPayload : undefined) ?? item.color;
  const formatted =
    formatter && item.value !== undefined && item.name
      ? formatter(item.value, item.name, item, index, fullPayload)
      : null;

  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
        indicator === "dot" && "items-center"
      )}
    >
      {formatted ?? (
        <TooltipPayloadRowDefault
          hideIndicator={hideIndicator}
          indicator={indicator}
          indicatorColor={indicatorColor}
          item={item}
          itemConfig={itemConfig}
          nestLabel={nestLabel}
          tooltipLabel={tooltipLabel}
        />
      )}
    </div>
  );
}

const ChartTooltipContent = forwardRef<HTMLDivElement, ChartTooltipContentProps>(
  (
    {
      active,
      payload,
      className,
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      labelClassName,
      formatter,
      color,
      nameKey,
      labelKey,
    },
    ref
  ) => {
    const { config } = useChart();

    const tooltipLabel = useMemo(() => {
      if (hideLabel || !payload?.length) {
        return null;
      }

      const [item] = payload;
      const key = `${labelKey ?? item?.dataKey ?? item?.name ?? "value"}`;
      const itemConfig = getPayloadConfigFromPayload(config, item, key);
      const value =
        !labelKey && typeof label === "string"
          ? (config[label]?.label ?? label)
          : itemConfig?.label;

      if (labelFormatter) {
        return (
          <div className={cn("font-medium", labelClassName)}>{labelFormatter(value, payload)}</div>
        );
      }

      if (!value) {
        return null;
      }

      return <div className={cn("font-medium", labelClassName)}>{value}</div>;
    }, [label, labelFormatter, payload, hideLabel, labelClassName, config, labelKey]);

    if (!active || !payload?.length) {
      return null;
    }

    const nestLabel = payload.length === 1 && indicator !== "dot";
    const filtered = payload.filter((item) => item.type !== "none");

    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-32 items-start gap-1.5 rounded-item border border-border bg-surface-raised px-2.5 py-1.5 font-mono text-w-xs shadow-md",
          className
        )}
      >
        {!nestLabel ? tooltipLabel : null}
        <div className="grid gap-1.5">
          {filtered.map((item, index) => (
            <TooltipPayloadRow
              key={`row-${String(item.dataKey)}-${String(item.name)}-${String(item.value)}`}
              color={color}
              config={config}
              formatter={formatter}
              fullPayload={payload}
              hideIndicator={hideIndicator}
              index={index}
              indicator={indicator}
              item={item}
              nameKey={nameKey}
              nestLabel={nestLabel}
              tooltipLabel={tooltipLabel}
            />
          ))}
        </div>
      </div>
    );
  }
);
ChartTooltipContent.displayName = "ChartTooltipContent";

function ChartLegend(props: Record<string, unknown>) {
  const recharts = useRechartsModule();
  const LegendComponent = recharts?.Legend ?? null;

  return LegendComponent ? <LegendComponent {...props} /> : null;
}

type LegendPayloadItem = TooltipPayloadItem & { value?: string | number };

const ChartLegendContent = forwardRef<
  HTMLDivElement,
  ComponentProps<"div"> & {
    payload?: LegendPayloadItem[];
    verticalAlign?: "top" | "middle" | "bottom";
    hideIcon?: boolean;
    nameKey?: string;
  }
>(({ className, hideIcon = false, payload, verticalAlign = "bottom", nameKey }, ref) => {
  const { config } = useChart();

  if (!payload || payload.length === 0) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-center gap-4",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className
      )}
    >
      {payload.map((item) => {
        const key = `${nameKey ?? item.dataKey ?? "value"}`;
        const itemConfig = getPayloadConfigFromPayload(config, item, key);
        const legendKey = `lg-${String(item.dataKey)}-${String(item.value)}-${String(item.color)}`;

        return (
          <div
            key={legendKey}
            className={cn(
              "flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"
            )}
          >
            {itemConfig?.icon && !hideIcon ? (
              <itemConfig.icon />
            ) : (
              <div
                className="size-2 shrink-0 rounded-item"
                style={{
                  backgroundColor: item.color,
                }}
              />
            )}
            <span className="text-muted-foreground">{itemConfig?.label}</span>
          </div>
        );
      })}
    </div>
  );
});
ChartLegendContent.displayName = "ChartLegendContent";

function getPayloadConfigFromPayload(config: ChartConfig, payload: unknown, key: string) {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const payloadPayload =
    "payload" in payload &&
    typeof (payload as { payload?: unknown }).payload === "object" &&
    (payload as { payload?: unknown }).payload !== null
      ? ((payload as { payload: Record<string, unknown> }).payload as Record<string, unknown>)
      : undefined;

  let configLabelKey: string = key;

  if (key in payload && typeof (payload as Record<string, unknown>)[key] === "string") {
    configLabelKey = (payload as Record<string, unknown>)[key] as string;
  } else if (payloadPayload && key in payloadPayload && typeof payloadPayload[key] === "string") {
    configLabelKey = payloadPayload[key] as string;
  }

  return configLabelKey in config ? config[configLabelKey] : config[key];
}

export {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
};
