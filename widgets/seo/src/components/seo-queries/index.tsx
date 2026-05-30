"use client";

import type { SearchQuery, SeoOverview } from "@radarboard/types/seo";
import { Dialog } from "@radarboard/ui/app-dialog";
import { ScrollArea } from "@radarboard/ui/scroll-area";
import { formatNumber } from "@radarboard/utils/format-number";
import { useSelectedItem } from "@radarboard/widget-engine/hooks/use-selected-item";
import { InlineListHeader, InlineListRow } from "@radarboard/widget-engine/inline-list-layout";
import { SummaryMetricCell } from "@radarboard/widget-engine/summary-metric-cell";
import { WidgetModalDialogContent } from "@radarboard/widget-engine/widget-modal";
import { useMemo } from "react";
import { SeoQueryDetail } from "../seo-query-detail";

interface SeoQueriesProps {
  data: SeoOverview;
  selectedId?: string | null;
  onSelectedIdChange?: (id: string | null) => void;
  widgetId?: string;
}

function getSeoQueryKey(q: SearchQuery): string {
  return `${q.query}::${q.siteUrl ?? "default"}`;
}

export function SeoQueries({
  data,
  selectedId,
  onSelectedIdChange,
  widgetId = "seo",
}: SeoQueriesProps) {
  const hasAttribution = data.queries.some((q) => q.projectName);

  const queryMap = useMemo(
    () => new Map(data.queries.map((q) => [getSeoQueryKey(q), q])),
    [data.queries]
  );

  const selected = useSelectedItem(selectedId, queryMap);

  const handleSelect = (query: SearchQuery) => {
    onSelectedIdChange?.(getSeoQueryKey(query));
  };

  const handleClose = () => {
    onSelectedIdChange?.(null);
  };

  return (
    <>
      <div className="flex h-full flex-col">
        {/* Summary metrics */}
        <div className="grid grid-cols-4 gap-0 border-border border-b">
          <SummaryMetricCell label="Clicks" value={formatNumber(data.totalClicks)} />
          <SummaryMetricCell
            label="Impressions"
            value={formatNumber(data.totalImpressions, { compact: true })}
          />
          <SummaryMetricCell label="CTR" value={`${data.avgCtr.toFixed(1)}%`} />
          <SummaryMetricCell label="Position" value={data.avgPosition.toFixed(1)} />
        </div>

        {/* Queries table */}
        <ScrollArea className="flex-1">
          <div className="flex flex-col">
            <InlineListHeader
              gridTemplateColumns="minmax(0,1fr) 70px 70px 60px"
              columns={[
                { key: "query", label: "Query" },
                { key: "clicks", label: "Clicks", align: "right" },
                { key: "impr", label: "Impr", align: "right" },
                { key: "pos", label: "Pos", align: "right" },
              ]}
            />
            <div className="divide-y divide-[#222]">
              {data.queries.map((query) => (
                <InlineListRow
                  key={`${query.query}-${query.siteUrl ?? "default"}`}
                  gridTemplateColumns="minmax(0,1fr) 70px 70px 60px"
                  onClick={() => handleSelect(query)}
                  cells={[
                    {
                      key: "query",
                      content: (
                        <div className="flex max-w-[180px] items-center gap-1.5 truncate">
                          {Boolean(hasAttribution) && query.projectColor && (
                            <span
                              className="inline-block h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: query.projectColor }}
                            />
                          )}
                          <span className="truncate">{query.query}</span>
                        </div>
                      ),
                    },
                    {
                      key: "clicks",
                      align: "right",
                      content: (
                        <span className="font-mono text-dim text-w-sm">
                          {formatNumber(query.clicks)}
                        </span>
                      ),
                    },
                    {
                      key: "impr",
                      align: "right",
                      content: (
                        <span className="font-mono text-dim text-w-sm">
                          {formatNumber(query.impressions)}
                        </span>
                      ),
                    },
                    {
                      key: "pos",
                      align: "right",
                      content: (
                        <span className="font-mono text-dim text-w-sm">
                          {query.position.toFixed(1)}
                        </span>
                      ),
                    },
                  ]}
                />
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) handleClose();
        }}
      >
        <WidgetModalDialogContent widgetId={widgetId} modalId="seo.query">
          {selected && (
            <SeoQueryDetail
              query={selected}
              siteAvgCtr={data.avgCtr}
              siteAvgPosition={data.avgPosition}
            />
          )}
        </WidgetModalDialogContent>
      </Dialog>
    </>
  );
}
