"use client";

import { Button } from "@radarboard/ui/button";
import { NativeSelect } from "@radarboard/ui/select";
import { cn } from "@radarboard/utils/cn";
import {
  Range as RadixSliderRange,
  Root as RadixSliderRoot,
  Thumb as RadixSliderThumb,
  Track as RadixSliderTrack,
} from "@radix-ui/react-slider";
import { useMemo } from "react";
import { useResolvedData } from "../../data-resolver";
import { type TemplateFilterState, useTemplateFilterState } from "../../filter-state";
import type { FilterBarControlConfig, FilterBarSectionConfig } from "../../types";

function createDefaultFilterState(controls: FilterBarControlConfig[]): TemplateFilterState {
  return Object.fromEntries(
    controls.map((control) => {
      if (control.type === "select") return [control.id, ""];
      if (control.type === "toggle") return [control.id, false];
      return [control.id, { min: control.min, max: control.max, enabled: false }];
    })
  );
}

function formatRangeValue(value: number, format?: "number" | "rank") {
  if (format === "rank") return value >= 1000 ? "any" : `#${value}`;
  return String(value);
}

export function FilterBarSection({ config }: { config: FilterBarSectionConfig }) {
  const defaultState = useMemo(() => createDefaultFilterState(config.controls), [config.controls]);
  const { state, updateState, resetState } = useTemplateFilterState(
    config.stateId,
    defaultState,
    config.persistKey
  );

  const activeCount = Object.values(state).reduce((count, value) => {
    if (typeof value === "boolean") return count + (value ? 1 : 0);
    if (typeof value === "string") return count + (value ? 1 : 0);
    return count + (value.enabled ? 1 : 0);
  }, 0);

  return (
    <div className="shrink-0 border-border border-b bg-surface px-4 py-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-dim text-w-base uppercase tracking-wider">Filters</span>
          {activeCount > 0 ? (
            <span className="rounded-item bg-accent/20 px-1.5 py-0.5 font-mono text-accent text-w-sm">
              {activeCount} active
            </span>
          ) : null}
        </div>
        {activeCount > 0 ? (
          <Button
            type="button"
            variant="ghost-link"
            spacing="none"
            uppercase={false}
            onClick={resetState}
            className="font-mono text-dim text-w-sm hover:text-muted-foreground"
          >
            reset all
          </Button>
        ) : null}
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {config.controls.map((control) => {
          if (control.type === "select") {
            return (
              <FilterBarSelectControl
                key={control.id}
                control={control}
                value={typeof state[control.id] === "string" ? (state[control.id] as string) : ""}
                onChange={(value) =>
                  updateState((current) => ({
                    ...current,
                    [control.id]: value,
                  }))
                }
              />
            );
          }

          if (control.type === "toggle") {
            return (
              <FilterBarToggleControl
                key={control.id}
                control={control}
                active={Boolean(state[control.id])}
                onToggle={() =>
                  updateState((current) => ({
                    ...current,
                    [control.id]: !current[control.id],
                  }))
                }
              />
            );
          }

          const value =
            typeof state[control.id] === "object" && state[control.id] !== null
              ? (state[control.id] as { min: number; max: number; enabled: boolean })
              : { min: control.min, max: control.max, enabled: false };

          return (
            <FilterBarRangeControl
              key={control.id}
              control={control}
              value={value}
              onChange={(next) =>
                updateState((current) => ({
                  ...current,
                  [control.id]: next,
                }))
              }
            />
          );
        })}
      </div>
    </div>
  );
}

function FilterBarSelectControl({
  control,
  value,
  onChange,
}: {
  control: Extract<FilterBarControlConfig, { type: "select" }>;
  value: string;
  onChange: (value: string) => void;
}) {
  const resolvedOptions = useResolvedData(control.optionsSource, { disableItemContext: true });
  const options = Array.isArray(resolvedOptions)
    ? resolvedOptions.map((item) =>
        typeof item === "string"
          ? { value: item, label: item.toUpperCase() }
          : {
              value: String((item as { value?: unknown }).value ?? ""),
              label: String(
                (item as { label?: unknown }).label ?? (item as { value?: unknown }).value ?? ""
              ),
            }
      )
    : (control.options ?? []);

  return (
    <div className="space-y-2">
      <div className="font-mono text-dim text-w-base uppercase tracking-wider">{control.label}</div>
      <NativeSelect
        value={value}
        onChange={(event) => onChange(event.target.value)}
        variant="surface"
        size="lg"
        className={cn("font-mono text-[#d0d0d0] text-w-sm uppercase tracking-wider", "w-full")}
      >
        <option value="">{control.allLabel ?? "All"}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

function FilterBarToggleControl({
  control,
  active,
  onToggle,
}: {
  control: Extract<FilterBarControlConfig, { type: "toggle" }>;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <Button
        type="button"
        variant="ghost"
        uppercase={false}
        onClick={onToggle}
        aria-pressed={active}
        className={cn(
          "rounded-item border px-2.5 py-1 font-mono text-w-base transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b8af5]",
          active
            ? "font-medium text-[#f0f0f0]"
            : "border-border bg-[#181818] text-dim hover:border-[#555] hover:text-[#bbb]"
        )}
        style={
          active
            ? {
                backgroundColor: `${control.accentColor}22`,
                borderColor: `${control.accentColor}66`,
              }
            : undefined
        }
      >
        {control.label}
      </Button>
    </div>
  );
}

function FilterBarRangeControl({
  control,
  value,
  onChange,
}: {
  control: Extract<FilterBarControlConfig, { type: "range" }>;
  value: { min: number; max: number; enabled: boolean };
  onChange: (value: { min: number; max: number; enabled: boolean }) => void;
}) {
  const isActive = value.enabled;
  const displayMin = formatRangeValue(value.min, control.format);
  const displayMax = formatRangeValue(value.max, control.format);
  const minLabel = control.format === "rank" ? "#1" : String(control.min);
  const maxLabel = control.format === "rank" ? "any" : String(control.max);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          uppercase={false}
          onClick={() => onChange({ ...value, enabled: !value.enabled })}
          aria-pressed={isActive}
          className={cn(
            "rounded-item border px-2.5 py-1 font-mono text-w-base uppercase tracking-wide transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b8af5]",
            isActive
              ? "font-medium text-[#f0f0f0]"
              : "border-border bg-[#181818] text-dim hover:border-[#555] hover:text-[#bbb]"
          )}
          style={
            isActive
              ? {
                  backgroundColor: `${control.accentColor}22`,
                  borderColor: `${control.accentColor}66`,
                  color: "#f0f0f0",
                }
              : undefined
          }
        >
          {control.label}
        </Button>

        <span className="font-mono text-foreground-secondary text-w-base tabular-nums">
          {displayMin} – {displayMax}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <RadixSliderRoot
          min={control.min}
          max={control.max}
          step={control.step}
          value={[value.min, value.max]}
          onValueChange={(values) => {
            const [min, max] = values;
            if (min == null || max == null) return;
            onChange({ min, max, enabled: true });
          }}
          className="relative col-span-2 flex h-5 w-full touch-none select-none items-center"
          aria-label={control.label}
        >
          <RadixSliderTrack className="relative h-[3px] w-full grow rounded-full bg-secondary">
            <RadixSliderRange
              className="absolute h-full rounded-full"
              style={{ backgroundColor: isActive ? control.accentColor : "#383838" }}
            />
          </RadixSliderTrack>
          <RadixSliderThumb
            className={cn(
              "icon-sm block rounded-full border-2 shadow transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b8af5]",
              "cursor-grab active:cursor-grabbing"
            )}
            style={{
              backgroundColor: isActive ? "#e8e8e8" : "#555",
              borderColor: isActive ? control.accentColor : "#444",
            }}
          />
          <RadixSliderThumb
            className={cn(
              "icon-sm block rounded-full border-2 shadow transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b8af5]",
              "cursor-grab active:cursor-grabbing"
            )}
            style={{
              backgroundColor: isActive ? "#e8e8e8" : "#555",
              borderColor: isActive ? control.accentColor : "#444",
            }}
          />
        </RadixSliderRoot>
      </div>

      <div className="flex justify-between">
        <span className="font-mono text-[#5f5f5f] text-w-sm uppercase tracking-wider">
          {minLabel}
        </span>
        <span className="font-mono text-[#5f5f5f] text-w-sm uppercase tracking-wider">
          {maxLabel}
        </span>
      </div>
    </div>
  );
}
