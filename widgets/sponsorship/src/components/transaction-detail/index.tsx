"use client";

import { useEffectiveLocale } from "@radarboard/hooks/use-effective-locale";
import { useEffectiveTimeZone } from "@radarboard/hooks/use-effective-timezone";
import type { OpenCollectiveTransaction } from "@radarboard/types/open-collective";
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

interface TransactionDetailProps {
  transaction: OpenCollectiveTransaction;
}

export function TransactionDetail({ transaction: tx }: TransactionDetailProps) {
  const effectiveLocale = useEffectiveLocale();
  const effectiveTimezone = useEffectiveTimeZone();
  const isCredit = tx.type === "CREDIT";
  const date = new Date(tx.createdAt);

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          <Badge variant={isCredit ? "success" : "destructive"} className="mr-2">
            {isCredit ? "Contribution" : "Expense"}
          </Badge>
          Transaction Detail
        </DialogTitle>
      </DialogHeader>
      <DialogBody>
        <div className="flex flex-col gap-1">
          <DetailRow label="Description">
            {tx.description || (isCredit ? "Contribution" : "Expense")}
          </DetailRow>
          <DetailRow label="Amount">
            <span className={isCredit ? "text-success" : "text-destructive"}>
              {isCredit ? "+" : "-"}
              {formatCurrency(tx.amount / 100, tx.currency)}
            </span>
          </DetailRow>
          <DetailRow label="Net (after fees)">
            <span className={isCredit ? "text-success" : "text-destructive"}>
              {isCredit ? "+" : "-"}
              {formatCurrency(tx.netAmount / 100, tx.currency)}
            </span>
          </DetailRow>
          <DetailRow label="From">
            <span className="flex items-center gap-1.5">
              {tx.fromAccount.imageUrl ? (
                <span
                  role="img"
                  aria-label={`${tx.fromAccount.name} avatar`}
                  className="icon-sm inline-block rounded-item bg-center bg-cover bg-no-repeat"
                  style={{ backgroundImage: `url("${tx.fromAccount.imageUrl}")` }}
                />
              ) : null}
              {tx.fromAccount.name}
            </span>
          </DetailRow>
          <DetailRow label="To">{tx.toAccount.name}</DetailRow>
          <DetailRow label="Date">
            {formatDateTime(date, {
              locale: effectiveLocale,
              timeZone: effectiveTimezone,
            })}
          </DetailRow>
        </div>
      </DialogBody>
      <DialogFooter>
        {tx.fromAccount.slug ? (
          <DetailLink href={`https://opencollective.com/${tx.fromAccount.slug}`}>
            View {tx.fromAccount.name} on OC
          </DetailLink>
        ) : null}
      </DialogFooter>
    </>
  );
}
