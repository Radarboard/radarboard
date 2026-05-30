"use client";

import { useDashboard } from "@radarboard/hooks/use-dashboard";
import { resolveGitHubLogin, resolveOcSlug } from "@radarboard/utils/project-helpers";
import {
  type DataSourceResolverProps,
  registerTemplateDataSource,
  reportResolverState,
} from "@radarboard/widget-sdk/data-source-registry";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { GitHubSponsorsOverviewData } from "./hooks/use-github-sponsors";
import { useGitHubSponsors } from "./hooks/use-github-sponsors";
import type { OpenCollectiveOverviewData } from "./hooks/use-open-collective";
import { useOpenCollective } from "./hooks/use-open-collective";

function normalizeCurrencyAmount(valueInCents: number | null | undefined): number | null {
  if (valueInCents == null) return null;
  return valueInCents / 100;
}

function normalizeSponsorshipSponsors(githubData: GitHubSponsorsOverviewData | null) {
  return (githubData?.sponsors ?? []).map((sponsor) => ({
    ...sponsor,
    id: sponsor.login,
    displayName: sponsor.name ?? sponsor.login,
    displayTier: sponsor.tier?.name ?? null,
    monthlyValue: normalizeCurrencyAmount(sponsor.tier?.monthlyPriceInCents ?? null),
    currency: githubData?.stats.currency ?? "USD",
  }));
}

function normalizeSponsorshipTiers(githubData: GitHubSponsorsOverviewData | null) {
  return (githubData?.tiers ?? []).map((tier) => ({
    id: tier.id,
    name: tier.name,
    monthlyValue: normalizeCurrencyAmount(tier.monthlyPriceInCents) ?? 0,
    currency: githubData?.stats.currency ?? "USD",
    sponsorCount: tier.sponsorCount,
  }));
}

function normalizeSponsorshipTransactions(openCollectiveData: OpenCollectiveOverviewData | null) {
  return (openCollectiveData?.recentTransactions ?? []).map((transaction) => ({
    ...transaction,
    id: transaction.id,
    descriptionText:
      transaction.description || (transaction.type === "CREDIT" ? "Contribution" : "Expense"),
    accountName:
      transaction.type === "CREDIT" ? transaction.fromAccount.name : transaction.toAccount.name,
    displayAmount:
      transaction.type === "CREDIT"
        ? (normalizeCurrencyAmount(transaction.amount) ?? 0)
        : -(normalizeCurrencyAmount(transaction.amount) ?? 0),
    status: transaction.type === "CREDIT" ? "success" : "error",
  }));
}

function normalizeSponsorshipMembers(openCollectiveData: OpenCollectiveOverviewData | null) {
  return (openCollectiveData?.topMembers ?? []).map((member) => ({
    ...member,
    id: member.id,
    name: member.account.name,
    displayTier: member.tier ?? member.role,
    donatedValue: normalizeCurrencyAmount(member.totalDonated) ?? 0,
  }));
}

function computeSponsorshipSummary(
  openCollectiveData: OpenCollectiveOverviewData | null,
  githubData: GitHubSponsorsOverviewData | null
) {
  const githubMonthlyIncome = githubData?.stats.monthlyIncome ?? 0;
  const openCollectiveMonthlyIncome = openCollectiveData
    ? Math.round(openCollectiveData.stats.yearlyBudget / 12)
    : 0;
  const sponsors = normalizeSponsorshipSponsors(githubData);
  const tiers = normalizeSponsorshipTiers(githubData);
  const recentTransactions = normalizeSponsorshipTransactions(openCollectiveData);
  const topMembers = normalizeSponsorshipMembers(openCollectiveData);

  return {
    monthlyIncome: (githubMonthlyIncome + openCollectiveMonthlyIncome) / 100,
    totalSponsors:
      (githubData?.stats.sponsorCount ?? 0) + (openCollectiveData?.stats.backersCount ?? 0),
    sourceLabel: (() => {
      if (openCollectiveData != null && githubData != null) return "OC + GitHub";
      if (githubData != null) return "GitHub";
      return "Open Collective";
    })(),
    balance: normalizeCurrencyAmount(openCollectiveData?.stats.balance ?? null),
    currency: githubData?.stats.currency ?? openCollectiveData?.stats.currency ?? "USD",
    sparklineData: (openCollectiveData?.stats.sparklineData ?? []).map((point) => ({
      value: point.value / 100,
    })),
    hasOpenCollective: openCollectiveData != null,
    hasGitHubSponsors: githubData != null,
    isApproximate: openCollectiveData != null && githubData != null,
    limitedAccess: githubData?.limitedAccess ?? false,
    sponsors,
    sponsorsCount: sponsors.length,
    tiers,
    tiersCount: tiers.length,
    goal: githubData?.goal ?? null,
    recentTransactions,
    recentTransactionsCount: recentTransactions.length,
    topMembers,
    topMembersCount: topMembers.length,
  };
}

function SponsorshipResolver({ projectSlug, onState }: DataSourceResolverProps) {
  const { projects, timeRange } = useDashboard();
  const openCollectiveSlug = resolveOcSlug(projects, projectSlug);
  const githubLogin = resolveGitHubLogin(projects, projectSlug);
  const openCollective = useOpenCollective(openCollectiveSlug, timeRange);
  const githubSponsors = useGitHubSponsors(githubLogin);

  const fetchedAt = useMemo(() => {
    if (openCollective.fetchedAt && githubSponsors.fetchedAt) {
      return Math.min(openCollective.fetchedAt, githubSponsors.fetchedAt);
    }

    return openCollective.fetchedAt ?? githubSponsors.fetchedAt ?? null;
  }, [openCollective.fetchedAt, githubSponsors.fetchedAt]);

  const refetch = useCallback(async () => {
    await Promise.all([openCollective.refetch(), githubSponsors.refetch()]);
  }, [openCollective.refetch, githubSponsors.refetch]);

  const data = useMemo(
    () => computeSponsorshipSummary(openCollective.data, githubSponsors.data),
    [openCollective.data, githubSponsors.data]
  );
  const previousDataSnapshot = useRef<string | null>(null);

  useEffect(() => {
    const snapshot = JSON.stringify(data);
    if (snapshot === previousDataSnapshot.current) {
      return;
    }
    previousDataSnapshot.current = snapshot;

    reportResolverState(onState, {
      data,
      fetchedAt,
      refetch,
      loading: openCollective.loading || githubSponsors.loading,
      error: openCollective.error ?? githubSponsors.error ?? null,
    });
  }, [
    fetchedAt,
    refetch,
    openCollective.loading,
    githubSponsors.loading,
    openCollective.error,
    githubSponsors.error,
    onState,
    data,
  ]);

  return null;
}

registerTemplateDataSource("sponsorship", SponsorshipResolver);
