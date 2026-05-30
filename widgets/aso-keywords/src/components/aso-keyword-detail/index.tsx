import type { AsoKeyword } from "@radarboard/types/aso-keywords";
import { DetailRow, DialogBody, DialogHeader, DialogTitle } from "@radarboard/ui/app-dialog";
import { Badge } from "@radarboard/ui/badge";
import { formatTimeAgo } from "@radarboard/utils/format-time-ago";

interface AsoKeywordDetailProps {
  keyword: AsoKeyword;
}

function formatRank(rank: number): string {
  return rank >= 1000 ? "Unranked" : `#${rank}`;
}

function formatChange(change: number): string {
  if (change > 0) return `+${change}`;
  if (change < 0) return `-${Math.abs(change)}`;
  return "0";
}

function opportunityScore(kw: AsoKeyword): number | null {
  if (kw.currentRanking >= 1000) return null;
  const popFactor = kw.popularity / 100;
  const easyFactor = 1 - kw.difficulty / 100;
  const rankFactor = Math.max(0, 1 - kw.currentRanking / 100);
  return Math.round(popFactor * easyFactor * rankFactor * 100);
}

function countryFlag(code: string): string {
  return Array.from(code.toUpperCase())
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

export function AsoKeywordDetail({ keyword }: AsoKeywordDetailProps) {
  const opp = opportunityScore(keyword);

  return (
    <>
      <DialogHeader>
        <DialogTitle>ASO Keyword Detail</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <div className="mb-4">
          <p className="font-bold font-mono text-foreground text-w-lg">{keyword.keyword}</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="default">
              {countryFlag(keyword.store)} {keyword.store.toUpperCase()}
            </Badge>
            <span className="font-mono text-dim text-w-sm">
              Updated {formatTimeAgo(keyword.lastUpdate)} ago
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <DetailRow label="Current Rank">{formatRank(keyword.currentRanking)}</DetailRow>
          <DetailRow label="Previous Rank">{formatRank(keyword.previousRanking)}</DetailRow>
          <DetailRow label="Ranking Change">{formatChange(keyword.rankingChange)}</DetailRow>
          <DetailRow label="Popularity">{String(keyword.popularity)}</DetailRow>
          <DetailRow label="Difficulty">{String(keyword.difficulty)}</DetailRow>
          <DetailRow label="Opportunity">{opp !== null ? String(opp) : "—"}</DetailRow>
          <DetailRow label="Competing Apps">{String(keyword.appsCount)}</DetailRow>
        </div>
      </DialogBody>
    </>
  );
}
