"use client";

import { CompactActivityChart } from "../../../components/compact-activity-chart";
import { useResolvedData, useResolvedSourceState } from "../../data-resolver";
import type { ActivityChartSectionConfig } from "../../types";

type ActivityBucketRecord = {
  id?: string;
  title?: string;
  values?: Record<string, number>;
};

function toActivityBuckets(input: unknown): ActivityBucketRecord[] {
  if (!Array.isArray(input)) return [];
  return input.filter((item): item is ActivityBucketRecord => !!item && typeof item === "object");
}

export function ActivityChartSection({ config }: { config: ActivityChartSectionConfig }) {
  const sourceState = useResolvedSourceState(config.source.sourceId);
  const resolved = useResolvedData(config.source, { disableItemContext: true });
  const buckets = toActivityBuckets(resolved);

  if (sourceState.loading && buckets.length === 0) {
    return <div className="mx-3 my-3 h-16 animate-pulse bg-surface-raised" />;
  }

  if (buckets.length === 0) {
    return (
      <div className="flex min-h-[96px] items-center justify-center px-3 font-mono text-dim text-w-sm">
        No data
      </div>
    );
  }

  return (
    <div className="border-border border-b px-3 py-2.5">
      <CompactActivityChart
        buckets={buckets.map((bucket, index) => ({
          id: bucket.id ?? `bucket-${index}`,
          title: bucket.title ?? "Activity",
          values: bucket.values ?? {},
        }))}
        segments={config.segments}
        heightClassName={config.heightClassName}
        minBarPercent={config.minBarPercent}
      />
    </div>
  );
}
