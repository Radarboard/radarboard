"use client";

import { useEffectiveLocale } from "@radarboard/hooks/use-effective-locale";
import { useEffectiveTimeZone } from "@radarboard/hooks/use-effective-timezone";
import type { OpenCollectiveMember } from "@radarboard/types/open-collective";
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

interface MemberDetailProps {
  member: OpenCollectiveMember;
}

export function MemberDetail({ member }: MemberDetailProps) {
  const effectiveLocale = useEffectiveLocale();
  const effectiveTimezone = useEffectiveTimeZone();
  const isOrg = member.account.type === "ORGANIZATION";
  const sinceDate = new Date(member.since);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Backer Detail</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <div className="mb-4 flex items-center gap-3">
          {member.account.imageUrl ? (
            <span
              role="img"
              aria-label={`${member.account.name} avatar`}
              className="h-10 w-10 rounded-item bg-center bg-cover bg-secondary bg-no-repeat"
              style={{ backgroundImage: `url("${member.account.imageUrl}")` }}
            />
          ) : null}
          {!member.account.imageUrl && isOrg && <Building2 className="h-10 w-10 text-dim" />}
          {!member.account.imageUrl && !isOrg && <User className="h-10 w-10 text-dim" />}
          <div>
            <p className="font-bold font-mono text-foreground text-w-lg">{member.account.name}</p>
            <Badge variant="default" className="mt-0.5">
              {isOrg ? "Organization" : "Individual"}
            </Badge>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <DetailRow label="Role">
            <Badge variant="default">{member.role}</Badge>
          </DetailRow>
          {member.tier ? (
            <DetailRow label="Tier">
              <Badge variant="success">{member.tier}</Badge>
            </DetailRow>
          ) : null}
          <DetailRow label="Total Donated">
            <span className="text-success">
              {formatCurrency(member.totalDonated / 100, member.currency)}
            </span>
          </DetailRow>
          <DetailRow label="Member Since">
            {formatDateTime(sinceDate, {
              locale: effectiveLocale,
              timeZone: effectiveTimezone,
            })}
          </DetailRow>
        </div>
      </DialogBody>
      {member.account.slug ? (
        <DialogFooter>
          <DetailLink href={`https://opencollective.com/${member.account.slug}`}>
            View on Open Collective
          </DetailLink>
        </DialogFooter>
      ) : null}
    </>
  );
}
