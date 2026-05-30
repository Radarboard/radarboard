"use client";

import { PluginListHeader } from "@radarboard/plugin-sdk/components/list-header";
import type { PluginRenderProps } from "@radarboard/plugin-sdk/types";
import { API_ROUTES } from "@radarboard/types/api-routes";
import { Button } from "@radarboard/ui/button";
import { Database, Download, FileJson, FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { EXPORTABLE_SOURCES, type ExportFormat } from "../types";

export function BackupOverlay(_props: PluginRenderProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("json");
  const [selectedRange, setSelectedRange] = useState("30d");

  return (
    <div className="flex h-full flex-col">
      <PluginListHeader label="Backup & Export" />

      <div className="flex-1 space-y-6 overflow-auto p-4">
        {/* Format & Range */}
        <div className="flex gap-4">
          <div className="space-y-1.5">
            <div className="font-mono text-dim text-w-xs uppercase tracking-widest">Format</div>
            <div className="flex gap-1">
              <FormatButton
                format="json"
                selected={selectedFormat}
                onSelect={setSelectedFormat}
                icon={FileJson}
              />
              <FormatButton
                format="csv"
                selected={selectedFormat}
                onSelect={setSelectedFormat}
                icon={FileSpreadsheet}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="font-mono text-dim text-w-xs uppercase tracking-widest">Range</div>
            <div className="flex gap-1">
              {["7d", "15d", "30d", "3m", "1y"].map((range) => (
                <Button
                  key={range}
                  type="button"
                  onClick={() => setSelectedRange(range)}
                  variant={selectedRange === range ? "secondary" : "ghost"}
                  size="sm"
                  uppercase={false}
                  className={selectedRange === range ? "" : "text-dim hover:text-foreground"}
                >
                  {range}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Sources */}
        <div className="space-y-2">
          <div className="font-mono text-dim text-w-xs uppercase tracking-widest">Sources</div>
          {EXPORTABLE_SOURCES.map((source) => (
            <div
              key={source.id}
              className="flex items-center justify-between rounded-item border border-border p-3"
            >
              <div className="flex items-center gap-3">
                <Database className="h-4 w-4 text-dim" />
                <div>
                  <div className="font-mono text-foreground text-w-sm">{source.name}</div>
                  <div className="text-dim text-w-xs">{source.description}</div>
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                uppercase={false}
                className="gap-1.5"
                onClick={() => {
                  const params = new URLSearchParams({
                    source: source.id,
                    format: selectedFormat,
                    range: selectedRange,
                  });
                  window.open(`${API_ROUTES.backupExport}?${params.toString()}`, "_blank");
                }}
              >
                <Download className="h-3 w-3" />
                Export
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FormatButton({
  format,
  selected,
  onSelect,
  icon: Icon,
}: {
  format: ExportFormat;
  selected: ExportFormat;
  onSelect: (f: ExportFormat) => void;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Button
      type="button"
      onClick={() => onSelect(format)}
      variant={selected === format ? "secondary" : "ghost"}
      uppercase={false}
      className={selected === format ? "gap-1.5" : "gap-1.5 text-dim hover:text-foreground"}
    >
      <Icon className="h-3.5 w-3.5" />
      {format.toUpperCase()}
    </Button>
  );
}
