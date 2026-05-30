"use client";

import { useEffectiveLocale } from "@radarboard/hooks/use-effective-locale";
import { useEffectiveTimeZone } from "@radarboard/hooks/use-effective-timezone";
import type { GitHubSponsor } from "@radarboard/types/github-sponsors";
import {
  DetailLink,
  DetailRow,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@radarboard/ui/app-dialog";
import { Badge } from "@radarboard/ui/badge";
import { formatCurrency } from "@radarboard/utils/format-currency";
import { formatDateTime } from "@radarboard/utils/format-date-time";
import { Building2, User } from "lucide-react";

interface SponsorDetailProps {
  sponsor: GitHubSponsor;
}

export function SponsorDetail({ sponsor }: SponsorDetailProps) {
  const effectiveLocale = useEffectiveLocale();
  const effectiveTimezone = useEffectiveTimeZone();
  const isOrg = sponsor.type === "ORGANIZATION";
  const sinceDate = sponsor.since ? new Date(sponsor.since) : null;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Sponsor Detail</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <div className="mb-4 flex items-center gap-3">
          {sponsor.avatarUrl ? (
            <span
              role="img"
              aria-label={`${sponsor.name ?? sponsor.login} avatar`}
              className="h-10 w-10 rounded-item bg-center bg-cover bg-secondary bg-no-repeat"
              style={{ backgroundImage: `url("${sponsor.avatarUrl}")` }}
            />
          ) : null}
          {!sponsor.avatarUrl && isOrg ? <Building2 className="h-10 w-10 text-dim" /> : null}
          {!sponsor.avatarUrl && !isOrg ? <User className="h-10 w-10 text-dim" /> : null}
          <div>
            <p className="font-bold font-mono text-foreground text-w-lg">
              {sponsor.name ?? sponsor.login}
            </p>
            <span className="font-mono text-dim text-w-sm">@{sponsor.login}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <DetailRow label="Type">
            <Badge variant="default">{isOrg ? "Organization" : "Individual"}</Badge>
          </DetailRow>
          {sponsor.tier ? (
            <>
              <DetailRow label="Tier">
                <Badge variant="success">{sponsor.tier.name}</Badge>
              </DetailRow>
              <DetailRow label="Monthly">
                <span className="text-success">
                  {formatCurrency(sponsor.tier.monthlyPriceInCents / 100, "USD")}
                </span>
              </DetailRow>
            </>
          ) : null}
          {sponsor.isOneTime ? (
            <DetailRow label="Type">
              <Badge variant="default">One-time</Badge>
            </DetailRow>
          ) : null}
          {sinceDate ? (
            <DetailRow label="Sponsor Since">
              {formatDateTime(sinceDate, {
                locale: effectiveLocale,
                timeZone: effectiveTimezone,
              })}
            </DetailRow>
          ) : null}
        </div>
      </DialogBody>
      <DialogFooter>
        <DetailLink href={sponsor.url}>View on GitHub</DetailLink>
      </DialogFooter>
    </>
  );
}
