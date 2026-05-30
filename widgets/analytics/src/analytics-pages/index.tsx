import type { TopPage } from "@radarboard/types/analytics";
import { ScrollArea } from "@radarboard/ui/scroll-area";
import { formatNumber } from "@radarboard/utils/format-number";

interface AnalyticsPagesProps {
  pages: TopPage[];
}

export function AnalyticsPages({ pages }: AnalyticsPagesProps) {
  return (
    <ScrollArea className="h-full">
      <table className="w-full text-w-sm">
        <thead>
          <tr className="border-[var(--color-widget-border)] border-b">
            <th className="px-3 py-1.5 text-left font-mono font-normal text-muted-foreground uppercase tracking-wider">
              Page
            </th>
            <th className="px-3 py-1.5 text-right font-mono font-normal text-muted-foreground uppercase tracking-wider">
              Sessions
            </th>
            <th className="px-3 py-1.5 text-right font-mono font-normal text-muted-foreground uppercase tracking-wider">
              Bounce
            </th>
            <th className="px-3 py-1.5 text-right font-mono font-normal text-muted-foreground uppercase tracking-wider">
              Avg Time
            </th>
          </tr>
        </thead>
        <tbody>
          {pages.map((page) => (
            <tr
              key={page.path}
              className="border-[var(--color-widget-border)] border-b transition-colors hover:bg-[var(--color-muted)]"
            >
              <td className="max-w-[200px] truncate px-3 py-1.5 text-foreground">{page.path}</td>
              <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">
                {formatNumber(page.sessions)}
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">
                {(page.bounceRate ?? 0).toFixed(1)}%
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">
                {Math.round(page.avgDuration ?? 0)}s
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  );
}
