"use client";

import type { GitHubSponsor, GitHubSponsorTier } from "@radarboard/types/github-sponsors";
import { Dialog } from "@radarboard/ui/app-dialog";
import { Badge } from "@radarboard/ui/badge";
import { Button } from "@radarboard/ui/button";
import { ScrollArea } from "@radarboard/ui/scroll-area";
import { formatCurrency } from "@radarboard/utils/format-currency";
import { useSelectedItem } from "@radarboard/widget-engine/hooks/use-selected-item";
import { WidgetModalDialogContent } from "@radarboard/widget-engine/widget-modal";
import { Building2, User } from "lucide-react";
import { useMemo } from "react";
import { SponsorDetail } from "../sponsor-detail";

// --- Sponsors List ---

interface SponsorsListProps {
  sponsors: GitHubSponsor[];
  selectedId?: string | null;
  onSelectedIdChange?: (id: string | null) => void;
  widgetId?: string;
}

export function GitHubSponsorsList({
  sponsors,
  selectedId,
  onSelectedIdChange,
  widgetId = "sponsorship",
}: SponsorsListProps) {
  const sponsorMap = useMemo(() => new Map(sponsors.map((s) => [s.login, s])), [sponsors]);

  const selected = useSelectedItem(selectedId, sponsorMap);

  const handleSelect = (sponsor: GitHubSponsor) => {
    onSelectedIdChange?.(sponsor.login);
  };

  const handleClose = () => {
    onSelectedIdChange?.(null);
  };

  if (sponsors.length === 0) {
    return (
      <div className="px-3 py-4 text-center font-mono text-dim text-w-base">No sponsors yet</div>
    );
  }

  return (
    <>
      <ScrollArea className="h-full">
        <div className="flex flex-col">
          {sponsors.map((sponsor) => {
            const isOrg = sponsor.type === "ORGANIZATION";
            return (
              <Button
                key={sponsor.login}
                type="button"
                variant="ghost"
                spacing="none"
                uppercase={false}
                rounded="none"
                onClick={() => handleSelect(sponsor)}
                className="flex w-full cursor-pointer items-center justify-start gap-2 border-border border-b px-3 py-2 text-left transition-colors hover:bg-surface-raised"
              >
                {sponsor.avatarUrl ? (
                  <span
                    role="img"
                    aria-label={`${sponsor.name ?? sponsor.login} avatar`}
                    className="icon-base shrink-0 rounded-item bg-center bg-cover bg-secondary bg-no-repeat"
                    style={{ backgroundImage: `url("${sponsor.avatarUrl}")` }}
                  />
                ) : null}
                {!sponsor.avatarUrl && isOrg ? (
                  <Building2 className="icon-base shrink-0 text-dim" />
                ) : null}
                {!sponsor.avatarUrl && !isOrg ? (
                  <User className="icon-base shrink-0 text-dim" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-foreground-secondary text-w-base">
                    {sponsor.name ?? sponsor.login}
                  </p>
                  {sponsor.tier ? (
                    <Badge variant="default" className="mt-0.5">
                      {sponsor.tier.name}
                    </Badge>
                  ) : null}
                </div>
                {sponsor.tier ? (
                  <span className="shrink-0 font-mono text-success text-w-base">
                    {formatCurrency(sponsor.tier.monthlyPriceInCents / 100, "USD")}
                    <span className="text-dim">/mo</span>
                  </span>
                ) : null}
              </Button>
            );
          })}
        </div>
      </ScrollArea>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) handleClose();
        }}
      >
        <WidgetModalDialogContent
          widgetId={widgetId}
          modalId="sponsorship.sponsor"
          defaultSize="sm"
        >
          {selected ? <SponsorDetail sponsor={selected} /> : null}
        </WidgetModalDialogContent>
      </Dialog>
    </>
  );
}

// --- Tiers List ---

interface TiersListProps {
  tiers: GitHubSponsorTier[];
}

export function GitHubTiersList({ tiers }: TiersListProps) {
  if (tiers.length === 0) {
    return (
      <div className="px-3 py-4 text-center font-mono text-dim text-w-base">
        No tiers configured
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col">
        {tiers.map((tier) => (
          <div key={tier.id} className="flex items-start gap-2 border-border border-b px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground-secondary text-w-base">{tier.name}</p>
                {tier.isOneTime ? (
                  <Badge variant="default" className="text-w-sm">
                    One-time
                  </Badge>
                ) : null}
              </div>
              {tier.description ? (
                <p className="mt-0.5 line-clamp-2 text-dim text-w-sm">{tier.description}</p>
              ) : null}
            </div>
            <div className="shrink-0 text-right">
              <span className="font-mono text-success text-w-base">
                {formatCurrency(tier.monthlyPriceInCents / 100, "USD")}
              </span>
              {tier.sponsorCount > 0 ? (
                <div className="font-mono text-dim text-w-sm">
                  {tier.sponsorCount} sponsor{tier.sponsorCount !== 1 ? "s" : ""}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
