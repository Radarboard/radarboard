import { cn } from "@radarboard/utils/cn";
import {
  type HTMLAttributes,
  type ReactElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export interface ContributionData {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface ContributionGraphProps extends HTMLAttributes<HTMLDivElement> {
  data: ContributionData[];
  days?: number;
  blockSize?: number;
  blockGap?: number;
  /** When true, blocks auto-size to fill the container width. Defaults to true. */
  responsive?: boolean;
  onRenderBlock?: (block: ReactElement, data: ContributionData) => ReactElement;
}

export function ContributionGraph({
  data,
  days = 365,
  blockSize: blockSizeProp = 12,
  blockGap: blockGapProp = 4,
  responsive = true,
  onRenderBlock,
  className,
  ...props
}: ContributionGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [measuredBlockSize, setMeasuredBlockSize] = useState<number | null>(null);

  const dataMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of data) {
      map.set(d.date, d.count);
    }
    return map;
  }, [data]);
  const { weeks } = useMemo(() => {
    const currentNow = new Date();
    const currentStartDate = new Date(currentNow);
    currentStartDate.setDate(currentNow.getDate() - days);

    const maxCount = Math.max(1, ...data.map((d) => d.count));
    const getLevel = (count: number) => {
      if (count === 0) return 0;
      if (count < maxCount * 0.25) return 1;
      if (count < maxCount * 0.5) return 2;
      if (count < maxCount * 0.75) return 3;
      return 4;
    };

    const calendarDays: Array<{
      date: string;
      count: number;
      level: number;
      inRange: boolean;
    }> = [];
    const currentDate = new Date(currentStartDate);

    while (currentDate.getDay() !== 0) {
      currentDate.setDate(currentDate.getDate() - 1);
    }

    while (currentDate <= currentNow || currentDate.getDay() !== 0) {
      if (currentDate > currentNow && currentDate.getDay() === 0) break;

      const isoDate = new Date(currentDate.getTime() - currentDate.getTimezoneOffset() * 60000)
        .toISOString()
        .split("T")[0] as string;

      const count = dataMap.get(isoDate) || 0;
      calendarDays.push({
        date: isoDate,
        count,
        level: getLevel(count),
        inRange: currentDate >= currentStartDate && currentDate <= currentNow,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    const nextWeeks: (typeof calendarDays)[] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      nextWeeks.push(calendarDays.slice(i, i + 7));
    }

    return {
      weeks: nextWeeks,
      now: currentNow,
      startDate: currentStartDate,
    };
  }, [data, dataMap, days]);

  const numWeeks = weeks.length;
  const blockGap = blockGapProp;

  // Responsive: measure container and derive block size
  useEffect(() => {
    if (!responsive) return;
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        // blockSize = (width - (numWeeks - 1) * gap) / numWeeks
        // Also account for 7 rows: height = 7 * blockSize + 6 * gap
        const horizontalSize = Math.floor((width - (numWeeks - 1) * blockGap) / numWeeks);
        setMeasuredBlockSize(Math.max(2, horizontalSize));
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [responsive, numWeeks, blockGap]);

  const blockSize = responsive && measuredBlockSize !== null ? measuredBlockSize : blockSizeProp;

  const getLevelClass = (level: number) => {
    switch (level) {
      case 0:
        return "bg-secondary";
      case 1:
        return "bg-success opacity-30";
      case 2:
        return "bg-success opacity-50";
      case 3:
        return "bg-success opacity-80";
      case 4:
        return "bg-success";
      default:
        return "bg-secondary";
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)} {...props}>
      <div
        ref={containerRef}
        className={cn("flex pb-2", !responsive && "scrollbar-none overflow-x-auto")}
        style={{ gap: blockGap }}
      >
        {weeks.map((week) => (
          <div key={week[0]?.date} className="flex flex-col" style={{ gap: blockGap }}>
            {week.map((day) => {
              const block = (
                <div
                  key={day.date}
                  className={cn(
                    "rounded-none transition-colors",
                    getLevelClass(day.level),
                    !day.inRange && "pointer-events-none opacity-0"
                  )}
                  style={{
                    width: blockSize,
                    height: blockSize,
                  }}
                />
              );

              return day.inRange && onRenderBlock ? onRenderBlock(block, day) : block;
            })}
          </div>
        ))}
      </div>

      <div className="mt-1 flex items-center justify-end gap-2 text-dim text-w-xs">
        <span>Less</span>
        <div className="flex items-center" style={{ gap: blockGap }}>
          {[0, 1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={cn("rounded-none", getLevelClass(level))}
              style={{ width: blockSize, height: blockSize }}
            />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  );
}
