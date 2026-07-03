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

const SPONSORSHIP_NOT_CONFIGURED_STATE = {
  configured: false,
  setupMessage: "Connect GitHub Sponsors or Open Collective to enable sponsorship data.",
  ctaLabel: "Configure sponsorship",
};

function getProjectRequiredState(projectSlug: string | null) {
  if (!projectSlug) {
    return {
      configured: false,
      setupMessage:
        "Select a project to view sponsorship data. Sponsorship currently needs an Open Collective slug or GitHub owner on a project.",
      ctaLabel: "Open Project Settings",
      ctaTarget: "intent:sponsorship-project",
    };
  }

  return {
    configured: false,
    setupMessage:
      "This project has no sponsorship source. Add an Open Collective slug or GitHub owner in Project Settings.",
    ctaLabel: "Open Project Settings",
    ctaTarget: "intent:sponsorship-project",
  };
}

function resolveCtaTarget(target: string | null, fallback: string) {
  if (!target || target.startsWith("/")) return fallback;
  return target;
}

function resolveProviderSetupMessage(message: string, providerName: string) {
  if (message === `Add the ${providerName} integration to enable this data source.`) {
    return `${providerName} credentials can be connected, but this build does not have a registered ${providerName} data source. Enable the provider integration before this widget can fetch sponsorship data.`;
  }

  return message;
}

function getProviderSetupState(
  openCollective: ReturnType<typeof useOpenCollective>,
  githubSponsors: ReturnType<typeof useGitHubSponsors>,
  openCollectiveSlug: string | null,
  githubLogin: string | null
) {
  if (openCollectiveSlug && !openCollective.configured && openCollective.setupMessage) {
    return {
      configured: false,
      setupMessage: resolveProviderSetupMessage(openCollective.setupMessage, "Open Collective"),
      ctaLabel: openCollective.ctaLabel ?? "Configure Open Collective",
      ctaTarget: resolveCtaTarget(openCollective.ctaTarget, "opencollective"),
    };
  }

  if (githubLogin && !githubSponsors.configured && githubSponsors.setupMessage) {
    return {
      configured: false,
      setupMessage: resolveProviderSetupMessage(githubSponsors.setupMessage, "GitHub Sponsors"),
      ctaLabel: githubSponsors.ctaLabel ?? "Configure GitHub Sponsors",
      ctaTarget: resolveCtaTarget(githubSponsors.ctaTarget, "github"),
    };
  }

  return SPONSORSHIP_NOT_CONFIGURED_STATE;
}

function SponsorshipResolver({ projectSlug, onState }: DataSourceResolverProps) {
  const { projects, timeRange, preferences } = useDashboard();
  const isDemoMode = preferences?.demoMode === true;
  const openCollectiveSlug =
    resolveOcSlug(projects, projectSlug) ?? (isDemoMode ? "front-end-checklist" : null);
  const githubLogin = resolveGitHubLogin(projects, projectSlug);
  const openCollective = useOpenCollective(openCollectiveSlug, timeRange, isDemoMode);
  const githubSponsors = useGitHubSponsors(
    githubLogin,
    Boolean(githubLogin) || isDemoMode,
    isDemoMode
  );

  const fetchedAt = useMemo(() => {
    if (openCollective.fetchedAt && githubSponsors.fetchedAt) {
      return Math.min(openCollective.fetchedAt, githubSponsors.fetchedAt);
    }

    return openCollective.fetchedAt ?? githubSponsors.fetchedAt ?? null;
  }, [openCollective.fetchedAt, githubSponsors.fetchedAt]);

  const refetch = useCallback(async () => {
    await Promise.all([openCollective.refetch(), githubSponsors.refetch()]);
  }, [openCollective.refetch, githubSponsors.refetch]);

  const data = useMemo(() => {
    if (!openCollectiveSlug && !githubLogin && !isDemoMode) {
      return getProjectRequiredState(projectSlug);
    }

    if (
      !openCollective.loading &&
      !githubSponsors.loading &&
      openCollective.data == null &&
      githubSponsors.data == null
    ) {
      return getProviderSetupState(openCollective, githubSponsors, openCollectiveSlug, githubLogin);
    }

    return computeSponsorshipSummary(openCollective.data, githubSponsors.data);
  }, [
    projectSlug,
    isDemoMode,
    openCollectiveSlug,
    githubLogin,
    openCollective,
    githubSponsors,
    openCollective.data,
    openCollective.loading,
    githubSponsors.data,
    githubSponsors.loading,
  ]);
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
