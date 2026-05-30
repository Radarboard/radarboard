"use client";

interface CompactActivityChartSegment {
  key: string;
  color: string;
}

interface CompactActivityChartBucket {
  id: string;
  title: string;
  values: Record<string, number>;
}

interface CompactActivityChartProps {
  buckets: CompactActivityChartBucket[];
  segments: CompactActivityChartSegment[];
  heightClassName?: string;
  minBarPercent?: number;
}

function BucketSegments({
  bucket,
  segments,
  total,
}: {
  bucket: CompactActivityChartBucket;
  segments: CompactActivityChartSegment[];
  total: number;
}) {
  return (
    <>
      {segments.map(
        (segment) =>
          (bucket.values[segment.key] ?? 0) > 0 && (
            <div
              key={segment.key}
              className="w-full"
              style={{
                height: `${((bucket.values[segment.key] ?? 0) / total) * 100}%`,
                backgroundColor: segment.color,
                minHeight: 2,
              }}
            />
          )
      )}
    </>
  );
}

export function CompactActivityChart({
  buckets,
  segments,
  heightClassName = "h-12",
  minBarPercent = 6,
}: CompactActivityChartProps) {
  const maxTotal = Math.max(
    ...buckets.map((bucket) =>
      segments.reduce((sum, segment) => sum + (bucket.values[segment.key] ?? 0), 0)
    ),
    1
  );

  return (
    <div className={`flex items-end gap-0.5 ${heightClassName}`}>
      {buckets.map((bucket) => {
        const total = segments.reduce((sum, segment) => sum + (bucket.values[segment.key] ?? 0), 0);
        const pct = (total / maxTotal) * 100;

        return (
          <div
            key={bucket.id}
            className="flex flex-1 flex-col justify-end overflow-hidden rounded-t-sm"
            style={{ height: `${Math.max(pct, minBarPercent)}%` }}
            title={bucket.title}
          >
            <BucketSegments bucket={bucket} segments={segments} total={total || 1} />
          </div>
        );
      })}
    </div>
  );
}
