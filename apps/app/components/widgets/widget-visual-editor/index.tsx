"use client";

import { useDashboard } from "@radarboard/hooks/use-dashboard";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@radarboard/ui/select";
import { cn } from "@radarboard/utils/cn";
import type { DataSource, WidgetTemplateConfig } from "@radarboard/widget-engine/templates";
import type { WidgetDescriptor } from "@radarboard/widget-engine/widgets/registry";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildTemplateRecipe,
  createTemplateSection,
  type EditableSectionType,
  getTemplateRecipeBuckets,
  getTemplateSectionBindings,
  getTemplateSectionKey,
  getTemplateSectionLabel,
  resolveTemplateConfig,
  resolveTemplateRecipeModel,
  type TemplateRecipeKind,
  type TemplateSectionBucket,
  updateTemplateSectionBinding,
} from "@/lib/template-editor";
import { RecipeDiagram } from "../recipe-diagram";
import {
  bucketLabel,
  DEFAULT_SECTION_TYPES,
  normalizeRecipeModel,
  RECIPE_OPTIONS,
  SECTION_TYPE_OPTIONS,
} from "../widget-visual-editor-model";
import { WidgetVisualEditorPreview } from "../widget-visual-editor-preview";

interface WidgetVisualEditorProps {
  descriptor: WidgetDescriptor;
  config: unknown;
  onConfigReplace: (config: Record<string, unknown>) => void;
  previewOverrides?: Record<string, unknown>;
}

interface SectionCardProps {
  bucket: TemplateSectionBucket;
  section: WidgetTemplateConfig["sections"][number];
  isExpanded: boolean;
  dataSourceIds: string[];
  defaultSourceId: string;
  onToggleExpanded: () => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onUpdateBinding: (bindingId: string, nextSource: DataSource) => void;
  onUpdateSection: (
    updater: (
      section: WidgetTemplateConfig["sections"][number]
    ) => WidgetTemplateConfig["sections"][number]
  ) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

function isTemplateConfig(config: unknown): config is WidgetTemplateConfig {
  if (!config || typeof config !== "object") return false;
  const candidate = config as Partial<WidgetTemplateConfig>;
  return Array.isArray(candidate.dataSources) && Array.isArray(candidate.sections);
}

function SectionBindingFields({
  bindings,
  dataSourceIds,
  onUpdateBinding,
}: {
  bindings: ReturnType<typeof getTemplateSectionBindings>;
  dataSourceIds: string[];
  onUpdateBinding: (bindingId: string, nextSource: DataSource) => void;
}) {
  return bindings.map((binding) => (
    <div
      key={binding.id}
      className="grid gap-2 md:grid-cols-[140px_120px_minmax(0,1fr)] md:items-center"
    >
      <span className="font-mono text-dim text-w-sm uppercase tracking-wider">{binding.label}</span>
      <Select
        value={binding.source.sourceId}
        onValueChange={(v) =>
          onUpdateBinding(binding.id, {
            ...binding.source,
            sourceId: v,
          })
        }
      >
        <SelectTrigger className="h-7 font-mono text-w-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {dataSourceIds.map((sourceId) => (
            <SelectItem key={sourceId} value={sourceId}>
              {sourceId}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="text"
        value={binding.source.field}
        onChange={(event) =>
          onUpdateBinding(binding.id, {
            ...binding.source,
            field: event.target.value,
          })
        }
        className="h-7 font-mono text-w-sm"
      />
    </div>
  ));
}

function SelectionSettingsFields({
  section,
  onUpdateSection,
}: {
  section: Extract<
    WidgetTemplateConfig["sections"][number],
    { type: "list" } | { type: "row-list" } | { type: "table" }
  >;
  onUpdateSection: (
    updater: (
      section: WidgetTemplateConfig["sections"][number]
    ) => WidgetTemplateConfig["sections"][number]
  ) => void;
}) {
  if (!section.selection) return null;

  const updateSelection = (key: "selectionId" | "keyField" | "detailRendererId", value: string) =>
    onUpdateSection((current) => {
      if (current.type !== "list" && current.type !== "row-list" && current.type !== "table") {
        return current;
      }
      if (!current.selection) return current;
      return {
        ...current,
        selection: {
          ...current.selection,
          [key]: value,
        },
      };
    });

  return (
    <>
      <div className="grid gap-2 md:grid-cols-[140px_minmax(0,1fr)] md:items-center">
        <span className="font-mono text-dim text-w-sm uppercase tracking-wider">Selection ID</span>
        <Input
          type="text"
          value={section.selection.selectionId}
          onChange={(event) => updateSelection("selectionId", event.target.value)}
          className="h-7 font-mono text-w-sm"
        />
      </div>
      <div className="grid gap-2 md:grid-cols-[140px_minmax(0,1fr)] md:items-center">
        <span className="font-mono text-dim text-w-sm uppercase tracking-wider">Key Field</span>
        <Input
          type="text"
          value={section.selection.keyField}
          onChange={(event) => updateSelection("keyField", event.target.value)}
          className="h-7 font-mono text-w-sm"
        />
      </div>
      <div className="grid gap-2 md:grid-cols-[140px_minmax(0,1fr)] md:items-center">
        <span className="font-mono text-dim text-w-sm uppercase tracking-wider">
          Detail Renderer
        </span>
        <Input
          type="text"
          value={section.selection.detailRendererId}
          onChange={(event) => updateSelection("detailRendererId", event.target.value)}
          className="h-7 font-mono text-w-sm"
        />
      </div>
    </>
  );
}

function ChartSettingsFields({
  section,
  onUpdateSection,
}: {
  section: Extract<WidgetTemplateConfig["sections"][number], { type: "chart" }>;
  onUpdateSection: (
    updater: (
      section: WidgetTemplateConfig["sections"][number]
    ) => WidgetTemplateConfig["sections"][number]
  ) => void;
}) {
  return (
    <>
      <div className="grid gap-2 md:grid-cols-[140px_minmax(0,1fr)] md:items-center">
        <span className="font-mono text-dim text-w-sm uppercase tracking-wider">X Key</span>
        <Input
          type="text"
          value={section.xKey ?? ""}
          onChange={(event) =>
            onUpdateSection((current) =>
              current.type === "chart" ? { ...current, xKey: event.target.value } : current
            )
          }
          className="h-7 font-mono text-w-sm"
        />
      </div>
      <div className="grid gap-2 md:grid-cols-[140px_minmax(0,1fr)] md:items-center">
        <span className="font-mono text-dim text-w-sm uppercase tracking-wider">Y Key</span>
        <Input
          type="text"
          value={section.yKey ?? ""}
          onChange={(event) =>
            onUpdateSection((current) =>
              current.type === "chart" ? { ...current, yKey: event.target.value } : current
            )
          }
          className="h-7 font-mono text-w-sm"
        />
      </div>
    </>
  );
}

function KpiSettingsFields({
  section,
  defaultSourceId,
  onUpdateSection,
}: {
  section: Extract<WidgetTemplateConfig["sections"][number], { type: "kpi-row" }>;
  defaultSourceId: string;
  onUpdateSection: (
    updater: (
      section: WidgetTemplateConfig["sections"][number]
    ) => WidgetTemplateConfig["sections"][number]
  ) => void;
}) {
  return (
    <>
      <div className="grid gap-2 md:grid-cols-[140px_160px] md:items-center">
        <span className="font-mono text-dim text-w-sm uppercase tracking-wider">Columns</span>
        <Select
          value={String(section.columns)}
          onValueChange={(v) =>
            onUpdateSection((current) =>
              current.type === "kpi-row"
                ? {
                    ...current,
                    columns: Number(v) as 1 | 2 | 3 | 4 | 5 | 6,
                  }
                : current
            )
          }
        >
          <SelectTrigger className="h-7 font-mono text-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5, 6].map((columns) => (
              <SelectItem key={columns} value={String(columns)}>
                {columns}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        {section.metrics.map((metric, index) => (
          <div
            key={`${metric.label}:${metric.source.sourceId}:${metric.source.field}`}
            className="grid gap-2 rounded-item border border-secondary bg-background/50 p-2 md:grid-cols-[120px_minmax(0,1fr)_auto] md:items-center"
          >
            <span className="font-mono text-dim text-w-sm uppercase tracking-wider">
              Metric {index + 1}
            </span>
            <Input
              type="text"
              value={metric.label}
              onChange={(event) =>
                onUpdateSection((current) =>
                  current.type === "kpi-row"
                    ? {
                        ...current,
                        metrics: current.metrics.map((currentMetric, metricIndex) =>
                          metricIndex === index
                            ? { ...currentMetric, label: event.target.value }
                            : currentMetric
                        ),
                      }
                    : current
                )
              }
              className="h-7 font-mono text-w-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onUpdateSection((current) =>
                  current.type === "kpi-row"
                    ? {
                        ...current,
                        metrics:
                          current.metrics.length > 1
                            ? current.metrics.filter((_, metricIndex) => metricIndex !== index)
                            : current.metrics,
                      }
                    : current
                )
              }
              disabled={section.metrics.length === 1}
              className="uppercase-none h-7 border-border px-2 font-mono text-dim text-w-sm hover:text-foreground-secondary"
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onUpdateSection((current) =>
              current.type === "kpi-row"
                ? {
                    ...current,
                    metrics: [
                      ...current.metrics,
                      {
                        label: `Metric ${current.metrics.length + 1}`,
                        source: { sourceId: defaultSourceId, field: "value", format: "number" },
                      },
                    ],
                  }
                : current
            )
          }
          className="uppercase-none inline-flex h-7 items-center gap-1 border-border px-2 font-mono text-dim text-w-sm hover:text-foreground-secondary"
        >
          <Plus className="icon-xs" />
          Add Metric
        </Button>
      </div>
    </>
  );
}

function TableSettingsFields({
  section,
  onUpdateSection,
}: {
  section: Extract<WidgetTemplateConfig["sections"][number], { type: "table" }>;
  onUpdateSection: (
    updater: (
      section: WidgetTemplateConfig["sections"][number]
    ) => WidgetTemplateConfig["sections"][number]
  ) => void;
}) {
  return (
    <div className="space-y-2">
      {section.columns.map((column, index) => (
        <div
          key={column.key}
          className="grid gap-2 rounded-item border border-secondary bg-background/50 p-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center"
        >
          <Input
            type="text"
            value={column.header}
            onChange={(event) =>
              onUpdateSection((current) =>
                current.type === "table"
                  ? {
                      ...current,
                      columns: current.columns.map((currentColumn, columnIndex) =>
                        columnIndex === index
                          ? { ...currentColumn, header: event.target.value }
                          : currentColumn
                      ),
                    }
                  : current
              )
            }
            className="h-7 font-mono text-w-sm"
          />
          <Input
            type="text"
            value={column.key}
            onChange={(event) =>
              onUpdateSection((current) =>
                current.type === "table"
                  ? {
                      ...current,
                      columns: current.columns.map((currentColumn, columnIndex) =>
                        columnIndex === index
                          ? { ...currentColumn, key: event.target.value }
                          : currentColumn
                      ),
                    }
                  : current
              )
            }
            className="h-7 font-mono text-w-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onUpdateSection((current) =>
                current.type === "table"
                  ? {
                      ...current,
                      columns:
                        current.columns.length > 1
                          ? current.columns.filter((_, columnIndex) => columnIndex !== index)
                          : current.columns,
                    }
                  : current
              )
            }
            disabled={section.columns.length === 1}
            className="uppercase-none h-7 border-border px-2 font-mono text-dim text-w-sm hover:text-foreground-secondary"
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onUpdateSection((current) =>
            current.type === "table"
              ? {
                  ...current,
                  columns: [
                    ...current.columns,
                    {
                      key: `field${current.columns.length + 1}`,
                      header: `Column ${current.columns.length + 1}`,
                    },
                  ],
                }
              : current
          )
        }
        className="uppercase-none inline-flex h-7 items-center gap-1 border-border px-2 font-mono text-dim text-w-sm hover:text-foreground-secondary"
      >
        <Plus className="icon-xs" />
        Add Column
      </Button>
    </div>
  );
}

function AlertSettingsFields({
  section,
  onUpdateSection,
}: {
  section: Extract<WidgetTemplateConfig["sections"][number], { type: "alert" }>;
  onUpdateSection: (
    updater: (
      section: WidgetTemplateConfig["sections"][number]
    ) => WidgetTemplateConfig["sections"][number]
  ) => void;
}) {
  return (
    <>
      <div className="grid gap-2 md:grid-cols-[140px_160px] md:items-center">
        <span className="font-mono text-dim text-w-sm uppercase tracking-wider">Severity</span>
        <Select
          value={section.severity}
          onValueChange={(v) =>
            onUpdateSection((current) =>
              current.type === "alert"
                ? {
                    ...current,
                    severity: v as "error" | "warning" | "info" | "success" | "setup",
                  }
                : current
            )
          }
        >
          <SelectTrigger className="h-7 font-mono text-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["error", "warning", "info", "success", "setup"].map((severity) => (
              <SelectItem key={severity} value={severity}>
                {severity}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2 md:grid-cols-[140px_minmax(0,1fr)] md:items-center">
        <span className="font-mono text-dim text-w-sm uppercase tracking-wider">Message</span>
        <Input
          type="text"
          value={section.message}
          onChange={(event) =>
            onUpdateSection((current) =>
              current.type === "alert" ? { ...current, message: event.target.value } : current
            )
          }
          className="h-7 font-mono text-w-sm"
        />
      </div>
      {section.condition ? (
        <>
          <div className="grid gap-2 md:grid-cols-[140px_160px] md:items-center">
            <span className="font-mono text-dim text-w-sm uppercase tracking-wider">Operator</span>
            <Select
              value={section.condition.operator}
              onValueChange={(v) =>
                onUpdateSection((current) =>
                  current.type === "alert" && current.condition
                    ? {
                        ...current,
                        condition: {
                          ...current.condition,
                          operator: v as "lt" | "gt" | "eq" | "neq" | "lte" | "gte",
                        },
                      }
                    : current
                )
              }
            >
              <SelectTrigger className="h-7 font-mono text-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["lt", "gt", "eq", "neq", "lte", "gte"].map((operator) => (
                  <SelectItem key={operator} value={operator}>
                    {operator}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 md:grid-cols-[140px_minmax(0,1fr)] md:items-center">
            <span className="font-mono text-dim text-w-sm uppercase tracking-wider">
              Condition Value
            </span>
            <Input
              type="text"
              value={String(section.condition.value)}
              onChange={(event) =>
                onUpdateSection((current) =>
                  current.type === "alert" && current.condition
                    ? {
                        ...current,
                        condition: {
                          ...current.condition,
                          value: event.target.value,
                        },
                      }
                    : current
                )
              }
              className="h-7 font-mono text-w-sm"
            />
          </div>
        </>
      ) : null}
    </>
  );
}

function TabsSettingsFields({
  section,
  defaultSourceId,
  onUpdateSection,
}: {
  section: Extract<WidgetTemplateConfig["sections"][number], { type: "tabs" }>;
  defaultSourceId: string;
  onUpdateSection: (
    updater: (
      section: WidgetTemplateConfig["sections"][number]
    ) => WidgetTemplateConfig["sections"][number]
  ) => void;
}) {
  return (
    <div className="space-y-2">
      {section.tabs.map((tab, index) => (
        <div
          key={tab.id}
          className="grid gap-2 rounded-item border border-secondary bg-background/50 p-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center"
        >
          <Input
            type="text"
            value={tab.label}
            onChange={(event) =>
              onUpdateSection((current) =>
                current.type === "tabs"
                  ? {
                      ...current,
                      tabs: current.tabs.map((currentTab, tabIndex) =>
                        tabIndex === index
                          ? { ...currentTab, label: event.target.value }
                          : currentTab
                      ),
                    }
                  : current
              )
            }
            className="h-7 font-mono text-w-sm"
          />
          <Input
            type="text"
            value={tab.id}
            onChange={(event) =>
              onUpdateSection((current) =>
                current.type === "tabs"
                  ? {
                      ...current,
                      tabs: current.tabs.map((currentTab, tabIndex) =>
                        tabIndex === index ? { ...currentTab, id: event.target.value } : currentTab
                      ),
                    }
                  : current
              )
            }
            className="h-7 font-mono text-w-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onUpdateSection((current) =>
                current.type === "tabs"
                  ? {
                      ...current,
                      tabs:
                        current.tabs.length > 1
                          ? current.tabs.filter((_, tabIndex) => tabIndex !== index)
                          : current.tabs,
                    }
                  : current
              )
            }
            disabled={section.tabs.length === 1}
            className="uppercase-none h-7 border-border px-2 font-mono text-dim text-w-sm hover:text-foreground-secondary"
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onUpdateSection((current) =>
            current.type === "tabs"
              ? {
                  ...current,
                  tabs: [
                    ...current.tabs,
                    {
                      id: `tab-${current.tabs.length + 1}`,
                      label: `Tab ${current.tabs.length + 1}`,
                      sections: [createTemplateSection("list", defaultSourceId)],
                    },
                  ],
                }
              : current
          )
        }
        className="uppercase-none inline-flex h-7 items-center gap-1 border-border px-2 font-mono text-dim text-w-sm hover:text-foreground-secondary"
      >
        <Plus className="icon-xs" />
        Add Tab
      </Button>
    </div>
  );
}

function SectionSettingsFields({
  section,
  defaultSourceId,
  onUpdateSection,
}: {
  section: WidgetTemplateConfig["sections"][number];
  defaultSourceId: string;
  onUpdateSection: (
    updater: (
      section: WidgetTemplateConfig["sections"][number]
    ) => WidgetTemplateConfig["sections"][number]
  ) => void;
}) {
  if (section.type === "kpi-row") {
    return (
      <KpiSettingsFields
        section={section}
        defaultSourceId={defaultSourceId}
        onUpdateSection={onUpdateSection}
      />
    );
  }

  if (section.type === "headline-stat") {
    return (
      <div className="grid gap-2 md:grid-cols-[140px_minmax(0,1fr)] md:items-center">
        <span className="font-mono text-dim text-w-sm uppercase tracking-wider">Label</span>
        <Input
          type="text"
          value={section.label}
          onChange={(event) =>
            onUpdateSection((current) =>
              current.type === "headline-stat" ? { ...current, label: event.target.value } : current
            )
          }
          className="h-7 font-mono text-w-sm"
        />
      </div>
    );
  }

  if (section.type === "list") {
    return (
      <div className="grid gap-2 md:grid-cols-[140px_160px] md:items-center">
        <span className="font-mono text-dim text-w-sm uppercase tracking-wider">Layout</span>
        <Select
          value={section.layout ?? "stacked"}
          onValueChange={(v) =>
            onUpdateSection((current) =>
              current.type === "list"
                ? {
                    ...current,
                    layout: v as "stacked" | "inline",
                  }
                : current
            )
          }
        >
          <SelectTrigger className="h-7 font-mono text-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="stacked">stacked</SelectItem>
            <SelectItem value="inline">inline</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (section.type === "row-list" && section.hrefSource) {
    return (
      <div className="grid gap-2 md:grid-cols-[140px_160px] md:items-center">
        <span className="font-mono text-dim text-w-sm uppercase tracking-wider">Link Target</span>
        <Select
          value={section.hrefTarget ?? "_blank"}
          onValueChange={(v) =>
            onUpdateSection((current) =>
              current.type === "list" || current.type === "row-list"
                ? {
                    ...current,
                    hrefTarget: v as "_blank" | "_self" | "_parent" | "_top",
                  }
                : current
            )
          }
        >
          <SelectTrigger className="h-7 font-mono text-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_blank">_blank</SelectItem>
            <SelectItem value="_self">_self</SelectItem>
            <SelectItem value="_parent">_parent</SelectItem>
            <SelectItem value="_top">_top</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  if ((section.type === "row-list" || section.type === "table") && section.selection) {
    return <SelectionSettingsFields section={section} onUpdateSection={onUpdateSection} />;
  }

  if (section.type === "stream-list") {
    return <StreamListSettingsFields section={section} onUpdateSection={onUpdateSection} />;
  }

  if (section.type === "chart") {
    return <ChartSettingsFields section={section} onUpdateSection={onUpdateSection} />;
  }

  if (section.type === "table") {
    return <TableSettingsFields section={section} onUpdateSection={onUpdateSection} />;
  }

  if (section.type === "alert") {
    return <AlertSettingsFields section={section} onUpdateSection={onUpdateSection} />;
  }

  if (section.type === "tabs") {
    return (
      <TabsSettingsFields
        section={section}
        defaultSourceId={defaultSourceId}
        onUpdateSection={onUpdateSection}
      />
    );
  }

  return null;
}

function StreamListSettingsFields({
  section,
  onUpdateSection,
}: {
  section: Extract<WidgetTemplateConfig["sections"][number], { type: "stream-list" }>;
  onUpdateSection: (
    updater: (
      section: WidgetTemplateConfig["sections"][number]
    ) => WidgetTemplateConfig["sections"][number]
  ) => void;
}) {
  return (
    <>
      <div className="grid gap-2 md:grid-cols-[140px_160px] md:items-center">
        <span className="font-mono text-dim text-w-sm uppercase tracking-wider">Variant</span>
        <Select
          value={section.variant ?? "compact"}
          onValueChange={(v) =>
            onUpdateSection((current) =>
              current.type === "stream-list"
                ? {
                    ...current,
                    variant: v as "compact" | "expanded",
                  }
                : current
            )
          }
        >
          <SelectTrigger className="h-7 font-mono text-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="compact">compact</SelectItem>
            <SelectItem value="expanded">expanded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2 md:grid-cols-[140px_160px] md:items-center">
        <span className="font-mono text-dim text-w-sm uppercase tracking-wider">Default Level</span>
        <Select
          value={section.defaultLevel ?? "debug"}
          onValueChange={(v) =>
            onUpdateSection((current) =>
              current.type === "stream-list"
                ? {
                    ...current,
                    defaultLevel: v as "all" | "debug" | "info" | "warn" | "error",
                  }
                : current
            )
          }
        >
          <SelectTrigger className="h-7 font-mono text-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">all</SelectItem>
            <SelectItem value="debug">debug</SelectItem>
            <SelectItem value="info">info</SelectItem>
            <SelectItem value="warn">warn</SelectItem>
            <SelectItem value="error">error</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

function EditableSectionCard({
  bucket,
  section,
  isExpanded,
  dataSourceIds,
  defaultSourceId,
  onToggleExpanded,
  onMove,
  onRemove,
  onUpdateBinding,
  onUpdateSection,
  canMoveUp,
  canMoveDown,
}: SectionCardProps) {
  const sectionKey = `${bucket}:${getTemplateSectionKey(section)}`;
  const bindings = getTemplateSectionBindings(section);

  return (
    <div key={sectionKey} className="rounded-item border border-border bg-background px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={onToggleExpanded}
          className="uppercase-none flex h-auto min-w-0 flex-1 items-center justify-start gap-2 p-0 text-left font-normal hover:bg-transparent"
        >
          <span className="font-mono text-foreground-secondary text-w-sm">
            {getTemplateSectionLabel(section)}
          </span>
          {bindings.length > 0 ? (
            <span className="font-mono text-dim text-w-sm">{bindings.length} bindings</span>
          ) : null}
        </Button>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onMove(-1)}
            disabled={!canMoveUp}
            className="icon-lg uppercase-none border-border text-dim transition-colors hover:text-foreground-secondary disabled:opacity-30"
          >
            <ChevronUp className="icon-xs" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onMove(1)}
            disabled={!canMoveDown}
            className="icon-lg uppercase-none border-border text-dim transition-colors hover:text-foreground-secondary disabled:opacity-30"
          >
            <ChevronDown className="icon-xs" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onRemove}
            className="icon-lg uppercase-none border-border text-dim transition-colors hover:text-destructive"
          >
            <Trash2 className="icon-xs" />
          </Button>
        </div>
      </div>

      {isExpanded && bindings.length > 0 ? (
        <div className="mt-3 space-y-2 border-border border-t pt-3">
          <SectionBindingFields
            bindings={bindings}
            dataSourceIds={dataSourceIds}
            onUpdateBinding={onUpdateBinding}
          />
          <SectionSettingsFields
            section={section}
            defaultSourceId={defaultSourceId}
            onUpdateSection={onUpdateSection}
          />
        </div>
      ) : null}
    </div>
  );
}

function VisualEditorHeader({
  editingScope,
  onScopeChange,
}: {
  editingScope: "compact" | "expanded";
  onScopeChange: (scope: "compact" | "expanded") => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-border border-b p-4">
      <div>
        <div className="font-mono text-dim text-w-sm uppercase tracking-wider">Visual Editor</div>
        <p className="mt-1 text-muted-foreground text-w-base">
          Edit the template recipe and preview it live.
        </p>
      </div>
      <div className="flex items-center gap-1 rounded-item border border-border bg-surface-raised p-1">
        {(["compact", "expanded"] as const).map((scope) => (
          <Button
            key={scope}
            type="button"
            variant="ghost"
            onClick={() => onScopeChange(scope)}
            className={cn(
              "h-auto px-2 py-1 font-mono font-normal text-w-sm uppercase tracking-wider transition-colors",
              editingScope === scope
                ? "bg-secondary text-foreground"
                : "text-dim hover:text-foreground-secondary"
            )}
          >
            {scope}
          </Button>
        ))}
      </div>
    </div>
  );
}

function RecipeControlsSection({
  onUpdateRecipeLabel,
  railWidth,
  recipeKind,
}: {
  onUpdateRecipeLabel: (kind: TemplateRecipeKind, nextRailWidth?: number) => void;
  railWidth: number | undefined;
  recipeKind: TemplateRecipeKind;
}) {
  const activeOption = RECIPE_OPTIONS.find((option) => option.kind === recipeKind);
  return (
    <div className="space-y-3 rounded-item border border-border bg-surface-raised p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono text-dim text-w-sm uppercase tracking-wider">Layout Recipe</div>
        <span className="text-dim text-w-sm">Not sure? Start with Summary + List.</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {RECIPE_OPTIONS.map((option) => {
          const isActive = recipeKind === option.kind;
          return (
            <Button
              key={option.kind}
              type="button"
              variant="outline"
              title={option.description}
              onClick={() => onUpdateRecipeLabel(option.kind)}
              className={cn(
                "uppercase-none relative flex h-auto flex-col items-center gap-1.5 px-2 py-2 font-mono text-w-sm transition-colors",
                isActive
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-border text-dim hover:border-foreground/20 hover:text-foreground-secondary"
              )}
            >
              <RecipeDiagram
                orientation={option.orientation}
                regions={option.regions}
                active={isActive}
              />
              <span className="text-center leading-tight">{option.label}</span>
              {option.recommended ? (
                <span className="absolute top-1 right-1 rounded-[2px] bg-accent/20 px-1 text-accent text-w-xs uppercase">
                  ★
                </span>
              ) : null}
            </Button>
          );
        })}
      </div>
      {activeOption ? (
        <p className="text-muted-foreground text-w-sm">{activeOption.description}</p>
      ) : null}
      {recipeKind === "rail_content" || recipeKind === "rail_list" ? (
        <div className="space-y-2 pt-1">
          <span className="font-mono text-dim text-w-sm">Rail width</span>
          <div className="flex flex-wrap items-center gap-2">
            {[176, 192, 224, 256].map((width) => (
              <Button
                key={width}
                type="button"
                variant={(railWidth ?? 192) === width ? "default" : "outline"}
                onClick={() => onUpdateRecipeLabel(recipeKind, width)}
                className={cn(
                  "uppercase-none h-auto px-2 py-1 font-mono text-w-sm transition-colors",
                  (railWidth ?? 192) === width
                    ? "border-accent/30 bg-accent/20 text-accent"
                    : "border-border text-dim hover:text-foreground-secondary"
                )}
              >
                {width}px
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SectionCompositionPanel({
  dataSourceIds,
  defaultSourceId,
  expandedSectionKey,
  onAddSection,
  onMoveSection,
  onRemoveSection,
  onToggleExpanded,
  onUpdateBucketType,
  onUpdateSection,
  onUpdateSectionBinding,
  recipeBuckets,
  recipeModel,
  sectionTypeByBucket,
}: {
  dataSourceIds: string[];
  defaultSourceId: string;
  expandedSectionKey: string | null;
  onAddSection: (bucket: TemplateSectionBucket) => void;
  onMoveSection: (bucket: TemplateSectionBucket, index: number, direction: -1 | 1) => void;
  onRemoveSection: (bucket: TemplateSectionBucket, index: number) => void;
  onToggleExpanded: (sectionKey: string) => void;
  onUpdateBucketType: (bucket: TemplateSectionBucket, type: EditableSectionType) => void;
  onUpdateSection: (
    bucket: TemplateSectionBucket,
    index: number,
    updater: (
      section: WidgetTemplateConfig["sections"][number]
    ) => WidgetTemplateConfig["sections"][number]
  ) => void;
  onUpdateSectionBinding: (
    bucket: TemplateSectionBucket,
    index: number,
    bindingId: string,
    nextSource: DataSource
  ) => void;
  recipeBuckets: TemplateSectionBucket[];
  recipeModel: ReturnType<typeof resolveTemplateRecipeModel>;
  sectionTypeByBucket: Record<TemplateSectionBucket, EditableSectionType>;
}) {
  if (!recipeModel) return null;

  return (
    <div className="space-y-3 rounded-item border border-border bg-surface-raised p-3">
      <div className="font-mono text-dim text-w-sm uppercase tracking-wider">
        Section Composition
      </div>
      <div className="space-y-3">
        {recipeBuckets.map((bucket) => {
          const sections = recipeModel[bucket];
          return (
            <div key={bucket} className="rounded-item border border-border bg-surface p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-foreground-secondary text-w-sm uppercase tracking-wider">
                  {bucketLabel(bucket)}
                </span>
                <div className="flex items-center gap-2">
                  <Select
                    value={sectionTypeByBucket[bucket]}
                    onValueChange={(value) =>
                      onUpdateBucketType(bucket, value as EditableSectionType)
                    }
                  >
                    <SelectTrigger className="h-7 min-w-[100px] font-mono text-w-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SECTION_TYPE_OPTIONS.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onAddSection(bucket)}
                    className="uppercase-none inline-flex h-7 items-center gap-1 border-border px-2 font-mono text-dim text-w-sm hover:text-foreground-secondary"
                  >
                    <Plus className="icon-xs" />
                    Add
                  </Button>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {sections.length === 0 ? (
                  <div className="rounded-item border border-border border-dashed px-3 py-2 font-mono text-dim text-w-sm">
                    No sections yet.
                  </div>
                ) : (
                  sections.map((section, index) => {
                    const sectionKey = `${bucket}:${getTemplateSectionKey(section)}`;
                    return (
                      <EditableSectionCard
                        key={sectionKey}
                        bucket={bucket}
                        section={section}
                        isExpanded={expandedSectionKey === sectionKey}
                        dataSourceIds={dataSourceIds}
                        defaultSourceId={defaultSourceId}
                        onToggleExpanded={() => onToggleExpanded(sectionKey)}
                        onMove={(direction) => onMoveSection(bucket, index, direction)}
                        onRemove={() => onRemoveSection(bucket, index)}
                        onUpdateBinding={(bindingId, nextSource) =>
                          onUpdateSectionBinding(bucket, index, bindingId, nextSource)
                        }
                        onUpdateSection={(updater) => onUpdateSection(bucket, index, updater)}
                        canMoveUp={index > 0}
                        canMoveDown={index < sections.length - 1}
                      />
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function useTemplateRecipeEditor({
  activeProjectSlug,
  activeTemplateConfig,
  baseConfig,
  defaultSourceId,
  editingScope,
  editorBinding,
  onConfigReplace,
  projects,
  recipeModel,
  sectionTypeByBucket,
}: {
  activeProjectSlug: string | null;
  activeTemplateConfig: WidgetTemplateConfig | null;
  baseConfig: Record<string, unknown>;
  defaultSourceId: string;
  editingScope: "compact" | "expanded";
  editorBinding: WidgetDescriptor["visualEditor"];
  onConfigReplace: (config: Record<string, unknown>) => void;
  projects: ReturnType<typeof useDashboard>["projects"];
  recipeModel: ReturnType<typeof resolveTemplateRecipeModel>;
  sectionTypeByBucket: Record<TemplateSectionBucket, EditableSectionType>;
}) {
  const replaceRecipeModel = useCallback(
    (nextModel: NonNullable<typeof recipeModel>) => {
      if (!activeTemplateConfig) return;
      const nextSections = buildTemplateRecipe(nextModel);
      const nextTemplateConfig: WidgetTemplateConfig =
        editingScope === "expanded"
          ? {
              ...activeTemplateConfig,
              expandedRecipe: nextModel,
              expandedSections: nextSections,
            }
          : {
              ...activeTemplateConfig,
              recipe: nextModel,
              sections: nextSections,
            };

      if (editorBinding?.kind === "template") {
        onConfigReplace(
          editorBinding.setConfig({
            config: baseConfig,
            editorConfig: resolveTemplateConfig(nextTemplateConfig),
            context: {
              projectSlug: activeProjectSlug,
              projects,
              config: baseConfig,
            },
          }) as Record<string, unknown>
        );
        return;
      }

      onConfigReplace(
        resolveTemplateConfig(nextTemplateConfig) as unknown as Record<string, unknown>
      );
    },
    [
      activeProjectSlug,
      activeTemplateConfig,
      baseConfig,
      editingScope,
      editorBinding,
      onConfigReplace,
      projects,
    ]
  );

  const updateRecipeLabel = useCallback(
    (nextKind: TemplateRecipeKind, nextRailWidth?: number) => {
      if (!recipeModel) return;
      const normalizedKind = nextKind === "content_only" ? "content_only" : nextKind;
      const sharedSummary = recipeModel.summary.length > 0 ? recipeModel.summary : recipeModel.rail;
      const sharedRail = recipeModel.rail.length > 0 ? recipeModel.rail : recipeModel.summary;
      const nextModel = {
        ...recipeModel,
        kind: normalizedKind as TemplateRecipeKind,
        summary:
          normalizedKind === "summary_only" ||
          normalizedKind === "summary_content" ||
          normalizedKind === "summary_list" ||
          normalizedKind === "summary_chart_list"
            ? sharedSummary
            : recipeModel.summary,
        content:
          normalizedKind === "content_only"
            ? recipeModel.content.length > 0
              ? recipeModel.content
              : [createTemplateSection("list", defaultSourceId)]
            : recipeModel.content,
        rail:
          normalizedKind === "rail_content" || normalizedKind === "rail_list"
            ? sharedRail
            : recipeModel.rail,
        railWidth: nextRailWidth ?? recipeModel.railWidth,
      };
      replaceRecipeModel(normalizeRecipeModel(nextModel, normalizedKind, defaultSourceId));
    },
    [defaultSourceId, recipeModel, replaceRecipeModel]
  );

  const updateBucket = useCallback(
    (
      bucket: TemplateSectionBucket,
      updater: (
        sections: NonNullable<typeof recipeModel>[TemplateSectionBucket]
      ) => NonNullable<typeof recipeModel>[TemplateSectionBucket]
    ) => {
      if (!recipeModel) return;
      replaceRecipeModel({
        ...recipeModel,
        [bucket]: updater(recipeModel[bucket]),
      });
    },
    [recipeModel, replaceRecipeModel]
  );

  const moveSection = useCallback(
    (bucket: TemplateSectionBucket, index: number, direction: -1 | 1) => {
      updateBucket(bucket, (sections) => {
        const next = [...sections];
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= next.length) return next;
        const [section] = next.splice(index, 1);
        if (!section) return next;
        next.splice(targetIndex, 0, section);
        return next;
      });
    },
    [updateBucket]
  );

  const removeSection = useCallback(
    (bucket: TemplateSectionBucket, index: number) => {
      updateBucket(bucket, (sections) =>
        sections.filter((_, sectionIndex) => sectionIndex !== index)
      );
    },
    [updateBucket]
  );

  const addSection = useCallback(
    (bucket: TemplateSectionBucket) => {
      updateBucket(bucket, (sections) => [
        ...sections,
        createTemplateSection(sectionTypeByBucket[bucket], defaultSourceId),
      ]);
    },
    [defaultSourceId, sectionTypeByBucket, updateBucket]
  );

  const updateSectionBinding = useCallback(
    (bucket: TemplateSectionBucket, index: number, bindingId: string, nextSource: DataSource) => {
      updateBucket(bucket, (sections) =>
        sections.map((section, sectionIndex) =>
          sectionIndex === index
            ? updateTemplateSectionBinding(section, bindingId, nextSource)
            : section
        )
      );
    },
    [updateBucket]
  );

  const updateSection = useCallback(
    (
      bucket: TemplateSectionBucket,
      index: number,
      updater: (
        section: WidgetTemplateConfig["sections"][number]
      ) => WidgetTemplateConfig["sections"][number]
    ) => {
      updateBucket(bucket, (sections) =>
        sections.map((section, sectionIndex) =>
          sectionIndex === index ? updater(section) : section
        )
      );
    },
    [updateBucket]
  );

  return {
    addSection,
    moveSection,
    removeSection,
    updateRecipeLabel,
    updateSection,
    updateSectionBinding,
  };
}

export function WidgetVisualEditor({
  descriptor,
  config,
  onConfigReplace,
  previewOverrides,
}: WidgetVisualEditorProps) {
  const { activeProjectSlug, projects } = useDashboard();
  const [editorState, setEditorState] = useState<{
    appliedPreviewConfig: WidgetTemplateConfig | null;
    appliedWidgetConfig: Record<string, unknown> | null;
    editingScope: "compact" | "expanded";
    expandedSectionKey: string | null;
    sectionTypeByBucket: Record<TemplateSectionBucket, EditableSectionType>;
  }>({
    appliedPreviewConfig: null,
    appliedWidgetConfig: null,
    editingScope: "compact",
    expandedSectionKey: null,
    sectionTypeByBucket: DEFAULT_SECTION_TYPES,
  });
  const {
    appliedPreviewConfig,
    appliedWidgetConfig,
    editingScope,
    expandedSectionKey,
    sectionTypeByBucket,
  } = editorState;
  const baseConfig = useMemo(
    () =>
      ({
        ...((config && typeof config === "object" ? config : {}) as Record<string, unknown>),
        ...(previewOverrides ?? {}),
      }) as Record<string, unknown>,
    [config, previewOverrides]
  );
  const editorBinding = descriptor.visualEditor;
  const templateConfig = useMemo(() => {
    if (editorBinding?.kind === "template") {
      const editorConfig = editorBinding.getConfig({
        projectSlug: activeProjectSlug,
        projects,
        config: baseConfig,
      });
      return isTemplateConfig(editorConfig) ? resolveTemplateConfig(editorConfig) : null;
    }

    return isTemplateConfig(baseConfig) ? resolveTemplateConfig(baseConfig) : null;
  }, [activeProjectSlug, baseConfig, editorBinding, projects]);
  const recipe = useMemo(
    () => (templateConfig ? resolveTemplateRecipeModel(templateConfig, editingScope) : null),
    [editingScope, templateConfig]
  );
  const previewConfig = useMemo(() => {
    if (!templateConfig) return null;
    if (editorBinding?.kind === "template") {
      return {
        ...baseConfig,
        ...resolveTemplateConfig(templateConfig),
      } as WidgetTemplateConfig;
    }
    return resolveTemplateConfig(templateConfig);
  }, [baseConfig, editorBinding, templateConfig]);
  useEffect(() => {
    setEditorState((current) => ({
      ...current,
      appliedPreviewConfig: previewConfig,
      appliedWidgetConfig: baseConfig,
    }));
  }, [baseConfig, previewConfig]);
  const previewConfigKey = useMemo(
    () => (previewConfig ? JSON.stringify(previewConfig) : null),
    [previewConfig]
  );
  const appliedPreviewConfigKey = useMemo(
    () => (appliedPreviewConfig ? JSON.stringify(appliedPreviewConfig) : null),
    [appliedPreviewConfig]
  );
  const baseConfigKey = useMemo(() => JSON.stringify(baseConfig), [baseConfig]);
  const appliedWidgetConfigKey = useMemo(
    () => (appliedWidgetConfig ? JSON.stringify(appliedWidgetConfig) : null),
    [appliedWidgetConfig]
  );
  const previewDirty =
    descriptor.id === "npm-downloads"
      ? appliedWidgetConfigKey !== null && baseConfigKey !== appliedWidgetConfigKey
      : previewConfigKey !== null &&
        appliedPreviewConfigKey !== null &&
        previewConfigKey !== appliedPreviewConfigKey;

  const recipeModel = recipe;
  const activeTemplateConfig: WidgetTemplateConfig | null = templateConfig;
  const defaultSourceId = activeTemplateConfig?.dataSources[0]?.id ?? "source";
  const dataSourceIds = activeTemplateConfig?.dataSources.map((source) => source.id) ?? [];
  const recipeBuckets = recipeModel ? getTemplateRecipeBuckets(recipeModel.kind) : [];
  const {
    addSection,
    moveSection,
    removeSection,
    updateRecipeLabel,
    updateSection,
    updateSectionBinding,
  } = useTemplateRecipeEditor({
    activeProjectSlug,
    activeTemplateConfig,
    baseConfig,
    defaultSourceId,
    editingScope,
    editorBinding,
    onConfigReplace,
    projects,
    recipeModel,
    sectionTypeByBucket,
  });

  if (!templateConfig) {
    return null;
  }

  if (!recipe || !recipeModel) {
    return (
      <div className="space-y-3 rounded-item border border-border bg-surface p-4">
        <div className="font-mono text-muted-foreground text-w-sm uppercase tracking-wider">
          Visual Editor
        </div>
        <p className="text-muted-foreground text-w-base">
          This template uses a custom layout shape the visual editor does not support yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[560px] flex-col rounded-item border border-border bg-surface">
      <VisualEditorHeader
        editingScope={editingScope}
        onScopeChange={(scope) =>
          setEditorState((current) => ({ ...current, editingScope: scope }))
        }
      />

      <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <RecipeControlsSection
          recipeKind={recipeModel.kind}
          railWidth={recipeModel.railWidth}
          onUpdateRecipeLabel={updateRecipeLabel}
        />

        <SectionCompositionPanel
          dataSourceIds={dataSourceIds}
          defaultSourceId={defaultSourceId}
          expandedSectionKey={expandedSectionKey}
          recipeBuckets={recipeBuckets}
          recipeModel={recipeModel}
          sectionTypeByBucket={sectionTypeByBucket}
          onAddSection={addSection}
          onMoveSection={moveSection}
          onRemoveSection={removeSection}
          onToggleExpanded={(sectionKey) =>
            setEditorState((current) => ({
              ...current,
              expandedSectionKey: current.expandedSectionKey === sectionKey ? null : sectionKey,
            }))
          }
          onUpdateBucketType={(bucket, type) =>
            setEditorState((current) => ({
              ...current,
              sectionTypeByBucket: {
                ...current.sectionTypeByBucket,
                [bucket]: type,
              },
            }))
          }
          onUpdateSection={updateSection}
          onUpdateSectionBinding={updateSectionBinding}
        />

        <WidgetVisualEditorPreview
          descriptor={descriptor}
          activeProjectSlug={activeProjectSlug}
          previewDirty={previewDirty}
          appliedPreviewConfig={appliedPreviewConfig as Record<string, unknown> | null}
          appliedPreviewConfigKey={appliedPreviewConfigKey}
          appliedWidgetConfig={appliedWidgetConfig}
          appliedWidgetConfigKey={appliedWidgetConfigKey}
          baseConfig={baseConfig}
          onApplyPreview={() => {
            if (descriptor.id === "npm-downloads") {
              setEditorState((current) => ({ ...current, appliedWidgetConfig: baseConfig }));
            } else if (previewConfig) {
              setEditorState((current) => ({
                ...current,
                appliedPreviewConfig: previewConfig,
              }));
            }
          }}
        />
      </div>
    </div>
  );
}
