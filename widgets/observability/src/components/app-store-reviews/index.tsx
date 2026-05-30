"use client";

import type { AppStoreOverview } from "@radarboard/types/app-store-connect";
import { Badge } from "@radarboard/ui/badge";
import { InfoRow } from "@radarboard/ui/info-row";
import { ScrollArea } from "@radarboard/ui/scroll-area";
import { cn } from "@radarboard/utils/cn";

// --- Star Rating ---

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-w-sm tracking-wider">
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={`star-${rating}-${star}`}
          className={star <= rating ? "text-warning" : "text-[#333]"}
        >
          &#9733;
        </span>
      ))}
    </span>
  );
}

// --- Time Ago ---

function formatTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function riskTone(risk: AppStoreOverview["releaseRisk"]) {
  if (risk === "high") return "text-destructive";
  if (risk === "elevated") return "text-warning";
  return "text-success";
}

// --- App Store Reviews Widget ---

interface AppStoreReviewsProps {
  data: AppStoreOverview;
}

export function AppStoreReviews({ data }: AppStoreReviewsProps) {
  return (
    <div className="flex h-full min-w-0 overflow-x-hidden">
      {/* Left: summary */}
      <div className="flex w-48 shrink-0 flex-col border-border border-r">
        <div className="border-border border-b p-3">
          <span className="font-mono text-dim text-w-sm uppercase tracking-wider">Rating</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={cn(
                "font-bold font-mono text-w-2xl",
                (() => {
                  if (data.averageRating >= 4.5) return "text-success";
                  if (data.averageRating >= 4.0) return "text-foreground";
                  if (data.averageRating >= 3.0) return "text-warning";
                  return "text-destructive";
                })()
              )}
            >
              {data.averageRating.toFixed(1)}
            </span>
            <Stars rating={Math.round(data.averageRating)} />
          </div>
          <span className="mt-0.5 block font-mono text-dim text-w-sm">
            {data.totalReviews} review{data.totalReviews !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex flex-col gap-2 p-3">
          <div>
            <span className="font-mono text-dim text-w-sm uppercase tracking-wider">Pressure</span>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="default" className={riskTone(data.releaseRisk)}>
                {data.releaseRisk}
              </Badge>
              <span className="font-mono text-dim text-w-sm">
                {data.recentNegativeReviews} low · {data.recentPositiveReviews} positive
              </span>
            </div>
          </div>
          {data.reviewSummary ? (
            <div>
              <span className="font-mono text-dim text-w-sm uppercase tracking-wider">Summary</span>
              <p className="mt-1 line-clamp-4 text-muted-foreground text-w-sm">
                {data.reviewSummary.text}
              </p>
              <span className="mt-1 block font-mono text-dim text-w-sm">
                {data.reviewSummary.territory} · {formatTimeAgo(data.reviewSummary.createdAt)}
              </span>
            </div>
          ) : null}
          <div>
            <span className="font-mono text-dim text-w-sm uppercase tracking-wider">App</span>
            <p className="mt-0.5 text-foreground-secondary text-w-base">{data.appName}</p>
          </div>
          {data.latestVersion ? (
            <div>
              <span className="font-mono text-dim text-w-sm uppercase tracking-wider">Version</span>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="font-mono text-foreground-secondary text-w-base">
                  {data.latestVersion}
                </span>
                {data.latestVersionState ? (
                  <Badge variant="default">{data.latestVersionState}</Badge>
                ) : null}
              </div>
              {data.latestVersionCreatedAt ? (
                <span className="mt-0.5 block font-mono text-dim text-w-sm">
                  opened {formatTimeAgo(data.latestVersionCreatedAt)} ago
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Right: review list */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {data.recentReviews.length === 0 ? (
            <div className="px-3 py-4 text-center font-mono text-dim text-w-base">
              No reviews yet
            </div>
          ) : (
            data.recentReviews.map((review) => (
              <InfoRow
                key={review.id}
                density="compact"
                className="py-1.5"
                subtitleClassName="mt-0.5"
                leading={<Stars rating={review.rating} />}
                title={review.title?.trim() || review.reviewer}
                subtitle={
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <span className="truncate font-mono text-dim text-w-sm">
                      {review.reviewer} · {review.territory}
                    </span>
                    <span className="shrink-0 font-mono text-dim text-w-sm">
                      {formatTimeAgo(review.createdAt)}
                    </span>
                  </div>
                }
                meta={
                  review.body ? (
                    <p className="line-clamp-1 text-dim text-w-sm">{review.body}</p>
                  ) : undefined
                }
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
