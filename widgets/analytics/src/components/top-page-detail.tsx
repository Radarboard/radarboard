import type { TopPage } from "@radarboard/types/analytics";
import {
  DetailLink,
  DetailRow,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@radarboard/ui/app-dialog";
import { formatNumber } from "@radarboard/utils/format-number";

interface TopPageDetailProps {
  page: TopPage;
}

function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
}

export function TopPageDetail({ page }: TopPageDetailProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Page Detail</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <div className="mb-4">
          <p className="font-bold font-mono text-foreground text-w-lg">{page.path}</p>
          {Boolean(page.title) && (
            <p className="mt-1 font-mono text-dim text-w-base">{page.title}</p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <DetailRow label="Sessions">{formatNumber(page.sessions)}</DetailRow>
          <DetailRow label="Bounce Rate">{(page.bounceRate ?? 0).toFixed(1)}%</DetailRow>
          <DetailRow label="Avg Duration">{formatDuration(page.avgDuration ?? 0)}</DetailRow>
        </div>
      </DialogBody>
      {page.openPanelUrl ? (
        <DialogFooter>
          <DetailLink href={page.openPanelUrl}>Open in OpenPanel</DetailLink>
        </DialogFooter>
      ) : null}
    </>
  );
}
