"use client";

import { Sparkline } from "@radarboard/charts/sparkline";
import type {
  OpenCollectiveMember,
  OpenCollectiveStats,
  OpenCollectiveTransaction,
} from "@radarboard/types/open-collective";
import { Dialog } from "@radarboard/ui/app-dialog";
import { Badge } from "@radarboard/ui/badge";
import { Button } from "@radarboard/ui/button";
import { ScrollArea } from "@radarboard/ui/scroll-area";
import { StatCard } from "@radarboard/ui/stat-card";
import { formatCurrency } from "@radarboard/utils/format-currency";
import { useSelectedItem } from "@radarboard/widget-engine/hooks/use-selected-item";
import { WidgetModalDialogContent } from "@radarboard/widget-engine/widget-modal";
import { ArrowDownLeft, ArrowUpRight, Building2, User } from "lucide-react";
import { useMemo } from "react";
import { MemberDetail } from "../member-detail";
import { TransactionDetail } from "../transaction-detail";

// --- Financial KPIs ---

interface OpenCollectiveKPIsProps {
  stats: OpenCollectiveStats;
}

export function OpenCollectiveKPIs({ stats }: OpenCollectiveKPIsProps) {
  const currency = stats.currency;

  return (
    <div>
      <div className="grid grid-cols-2 gap-px bg-secondary">
        <StatCard
          label="Balance"
          value={formatCurrency(stats.balance / 100, currency)}
          variant="surface"
        />
        <StatCard
          label="Total Raised"
          value={formatCurrency(stats.totalRaised / 100, currency, { compact: true })}
          variant="surface"
        />
        <StatCard
          label="Yearly Budget"
          value={formatCurrency(stats.yearlyBudget / 100, currency, { compact: true })}
          variant="surface"
        />
        <StatCard
          label="Backers"
          value={stats.backersCount.toLocaleString()}
          description={`${stats.contributorsCount} contributors`}
          variant="surface"
        />
      </div>
      {stats.sparklineData.length > 0 ? (
        <div className="border-border border-t px-3 py-2">
          <Sparkline
            data={stats.sparklineData.map((d) => ({ value: d.value / 100 }))}
            positive={true}
            height={32}
          />
        </div>
      ) : null}
    </div>
  );
}

// --- Transactions List ---

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDay < 30) return `${diffDay}d`;
  return `${Math.floor(diffDay / 30)}mo`;
}

interface TransactionsListProps {
  transactions: OpenCollectiveTransaction[];
  selectedId?: string | null;
  onSelectedIdChange?: (id: string | null) => void;
  widgetId?: string;
}

export function OpenCollectiveTransactions({
  transactions,
  selectedId,
  onSelectedIdChange,
  widgetId = "sponsorship",
}: TransactionsListProps) {
  const txMap = useMemo(() => new Map(transactions.map((t) => [t.id, t])), [transactions]);

  const selected = useSelectedItem(selectedId, txMap);

  const handleSelect = (tx: OpenCollectiveTransaction) => {
    onSelectedIdChange?.(tx.id);
  };

  const handleClose = () => {
    onSelectedIdChange?.(null);
  };

  if (transactions.length === 0) {
    return (
      <div className="px-3 py-4 text-center font-mono text-dim text-w-base">
        No recent transactions
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="h-full">
        <div className="flex flex-col">
          {transactions.map((tx) => {
            const isCredit = tx.type === "CREDIT";
            return (
              <Button
                key={tx.id}
                type="button"
                variant="ghost"
                spacing="none"
                uppercase={false}
                rounded="none"
                onClick={() => handleSelect(tx)}
                className="flex w-full cursor-pointer items-start justify-start gap-2 border-border border-b px-3 py-2 text-left transition-colors hover:bg-surface-raised"
              >
                {isCredit ? (
                  <ArrowUpRight className="icon-xs mt-0.5 shrink-0 text-success" />
                ) : (
                  <ArrowDownLeft className="icon-xs mt-0.5 shrink-0 text-destructive" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-foreground-secondary text-w-base">
                    {tx.description || (isCredit ? "Contribution" : "Expense")}
                  </p>
                  <span className="font-mono text-dim text-w-sm">
                    {isCredit ? tx.fromAccount.name : tx.toAccount.name}
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={`font-medium font-mono text-w-base ${isCredit ? "text-success" : "text-destructive"}`}
                  >
                    {isCredit ? "+" : "-"}
                    {formatCurrency(tx.amount / 100, tx.currency)}
                  </span>
                  <div className="font-mono text-dim text-w-sm">{formatTimeAgo(tx.createdAt)}</div>
                </div>
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
          modalId="sponsorship.transaction"
          defaultSize="sm"
        >
          {selected ? <TransactionDetail transaction={selected} /> : null}
        </WidgetModalDialogContent>
      </Dialog>
    </>
  );
}

// --- Members / Contributors List ---

interface MembersListProps {
  members: OpenCollectiveMember[];
  selectedId?: string | null;
  onSelectedIdChange?: (id: string | null) => void;
  widgetId?: string;
}

export function OpenCollectiveMembers({
  members,
  selectedId,
  onSelectedIdChange,
  widgetId = "sponsorship",
}: MembersListProps) {
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const selected = useSelectedItem(selectedId, memberMap);

  const handleSelect = (member: OpenCollectiveMember) => {
    onSelectedIdChange?.(member.id);
  };

  const handleClose = () => {
    onSelectedIdChange?.(null);
  };

  if (members.length === 0) {
    return (
      <div className="px-3 py-4 text-center font-mono text-dim text-w-base">No backers yet</div>
    );
  }

  return (
    <>
      <ScrollArea className="h-full">
        <div className="flex flex-col">
          {members.map((member) => {
            const isOrg = member.account.type === "ORGANIZATION";
            return (
              <Button
                key={member.id}
                type="button"
                variant="ghost"
                spacing="none"
                uppercase={false}
                rounded="none"
                onClick={() => handleSelect(member)}
                className="flex w-full cursor-pointer items-center justify-start gap-2 border-border border-b px-3 py-2 text-left transition-colors hover:bg-surface-raised"
              >
                {member.account.imageUrl ? (
                  <span
                    role="img"
                    aria-label={`${member.account.name} avatar`}
                    className="icon-base shrink-0 rounded-item bg-center bg-cover bg-secondary bg-no-repeat"
                    style={{ backgroundImage: `url("${member.account.imageUrl}")` }}
                  />
                ) : null}
                {!member.account.imageUrl && isOrg ? (
                  <Building2 className="icon-base shrink-0 text-dim" />
                ) : null}
                {!member.account.imageUrl && !isOrg ? (
                  <User className="icon-base shrink-0 text-dim" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-foreground-secondary text-w-base">
                    {member.account.name}
                  </p>
                  {member.tier ? (
                    <Badge variant="default" className="mt-0.5">
                      {member.tier}
                    </Badge>
                  ) : null}
                </div>
                <span className="shrink-0 font-mono text-success text-w-base">
                  {formatCurrency(member.totalDonated / 100, member.currency, { compact: true })}
                </span>
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
        <WidgetModalDialogContent widgetId={widgetId} modalId="sponsorship.member" defaultSize="sm">
          {selected ? <MemberDetail member={selected} /> : null}
        </WidgetModalDialogContent>
      </Dialog>
    </>
  );
}
