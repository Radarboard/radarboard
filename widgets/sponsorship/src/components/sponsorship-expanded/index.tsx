"use client";

import { useDashboard } from "@radarboard/hooks/use-dashboard";
import { ScrollArea } from "@radarboard/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@radarboard/ui/tabs";
import { resolveGitHubLogin, resolveOcSlug } from "@radarboard/utils/project-helpers";
import type { WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { domAnimation, LazyMotion, m } from "motion/react";
import { useCallback } from "react";
import type { GitHubSponsorsOverviewData } from "../../hooks/use-github-sponsors";
import { useGitHubSponsors } from "../../hooks/use-github-sponsors";
import type { OpenCollectiveOverviewData } from "../../hooks/use-open-collective";
import { useOpenCollective } from "../../hooks/use-open-collective";
import { GitHubSponsorsList, GitHubTiersList } from "../github-sponsors";
import { OpenCollectiveMembers, OpenCollectiveTransactions } from "../open-collective";
import { computeUnifiedKPIs, UnifiedKPIs } from "../sponsorship-compact";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parsePrefixedId(selectedDetailId: string | null | undefined, prefix: string) {
  if (selectedDetailId?.startsWith(`${prefix}:`)) return selectedDetailId.slice(prefix.length + 1);
  return null;
}

function usePrefixedIdChange(
  prefix: string,
  onSelectedDetailIdChange: ((id: string | null) => void) | undefined
) {
  return useCallback(
    (id: string | null) => {
      onSelectedDetailIdChange?.(id ? `${prefix}:${id}` : null);
    },
    [onSelectedDetailIdChange, prefix]
  );
}

// ---------------------------------------------------------------------------
// Expanded Tab Components
// ---------------------------------------------------------------------------

function ExpandedTabSponsors({
  widgetId,
  ghData,
  selectedDetailId,
  onSelectedDetailIdChange,
}: {
  widgetId?: string;
  ghData: GitHubSponsorsOverviewData;
  selectedDetailId: string | null | undefined;
  onSelectedDetailIdChange: ((id: string | null) => void) | undefined;
}) {
  const selectedId = parsePrefixedId(selectedDetailId, "ghsponsor");
  const handleChange = usePrefixedIdChange("ghsponsor", onSelectedDetailIdChange);
  return (
    <GitHubSponsorsList
      widgetId={widgetId}
      sponsors={ghData.sponsors}
      selectedId={selectedId}
      onSelectedIdChange={handleChange}
    />
  );
}

function ExpandedTabBackers({
  widgetId,
  ocData,
  selectedDetailId,
  onSelectedDetailIdChange,
}: {
  widgetId?: string;
  ocData: OpenCollectiveOverviewData;
  selectedDetailId: string | null | undefined;
  onSelectedDetailIdChange: ((id: string | null) => void) | undefined;
}) {
  const selectedId = parsePrefixedId(selectedDetailId, "member");
  const handleChange = usePrefixedIdChange("member", onSelectedDetailIdChange);
  return (
    <OpenCollectiveMembers
      widgetId={widgetId}
      members={ocData.topMembers}
      selectedId={selectedId}
      onSelectedIdChange={handleChange}
    />
  );
}

function ExpandedTabTransactions({
  widgetId,
  ocData,
  selectedDetailId,
  onSelectedDetailIdChange,
}: {
  widgetId?: string;
  ocData: OpenCollectiveOverviewData;
  selectedDetailId: string | null | undefined;
  onSelectedDetailIdChange: ((id: string | null) => void) | undefined;
}) {
  const selectedId = parsePrefixedId(selectedDetailId, "txn");
  const handleChange = usePrefixedIdChange("txn", onSelectedDetailIdChange);
  return (
    <OpenCollectiveTransactions
      widgetId={widgetId}
      transactions={ocData.recentTransactions}
      selectedId={selectedId}
      onSelectedIdChange={handleChange}
    />
  );
}

// ---------------------------------------------------------------------------
// Expanded Tabs
// ---------------------------------------------------------------------------

interface ExpandedTabsProps {
  widgetId?: string;
  ocData: OpenCollectiveOverviewData | null;
  ghData: GitHubSponsorsOverviewData | null;
  selectedDetailId: string | null | undefined;
  onSelectedDetailIdChange: ((id: string | null) => void) | undefined;
}

function ExpandedTabs({
  widgetId,
  ocData,
  ghData,
  selectedDetailId,
  onSelectedDetailIdChange,
}: ExpandedTabsProps) {
  const showTiersTab = ghData && ghData.tiers.length > 0;
  const defaultTab = ghData ? "sponsors" : "backers";

  return (
    <Tabs defaultValue={defaultTab} className="flex min-h-0 flex-1 flex-col">
      <TabsList>
        {ghData ? (
          <TabsTrigger value="sponsors">Sponsors ({ghData.sponsors.length})</TabsTrigger>
        ) : null}
        {ocData ? (
          <TabsTrigger value="backers">Backers ({ocData.topMembers.length})</TabsTrigger>
        ) : null}
        {ocData ? (
          <TabsTrigger value="transactions">Txns ({ocData.recentTransactions.length})</TabsTrigger>
        ) : null}
        {showTiersTab ? (
          <TabsTrigger value="tiers">Tiers ({ghData.tiers.length})</TabsTrigger>
        ) : null}
      </TabsList>

      {ghData ? (
        <TabsContent value="sponsors" className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <ExpandedTabSponsors
              widgetId={widgetId}
              ghData={ghData}
              selectedDetailId={selectedDetailId}
              onSelectedDetailIdChange={onSelectedDetailIdChange}
            />
          </ScrollArea>
        </TabsContent>
      ) : null}
      {ocData ? (
        <TabsContent value="backers" className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <ExpandedTabBackers
              widgetId={widgetId}
              ocData={ocData}
              selectedDetailId={selectedDetailId}
              onSelectedDetailIdChange={onSelectedDetailIdChange}
            />
          </ScrollArea>
        </TabsContent>
      ) : null}
      {ocData ? (
        <TabsContent value="transactions" className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <ExpandedTabTransactions
              widgetId={widgetId}
              ocData={ocData}
              selectedDetailId={selectedDetailId}
              onSelectedDetailIdChange={onSelectedDetailIdChange}
            />
          </ScrollArea>
        </TabsContent>
      ) : null}
      {showTiersTab ? (
        <TabsContent value="tiers" className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <GitHubTiersList tiers={ghData.tiers} />
          </ScrollArea>
        </TabsContent>
      ) : null}
    </Tabs>
  );
}

// ---------------------------------------------------------------------------
// Expanded View
// ---------------------------------------------------------------------------

export function SponsorshipExpanded({
  widgetId,
  projectSlug,
  selectedDetailId,
  onSelectedDetailIdChange,
}: WidgetRenderProps) {
  const { projects, timeRange } = useDashboard();
  const ocSlug = resolveOcSlug(projects, projectSlug);
  const ghLogin = resolveGitHubLogin(projects, projectSlug);

  const { data: ocData } = useOpenCollective(ocSlug, timeRange);
  const { data: ghData } = useGitHubSponsors(ghLogin);

  const kpis = computeUnifiedKPIs(ocData, ghData);

  if (!kpis.hasOC && !kpis.hasGH) {
    return (
      <div className="flex h-full items-center justify-center font-mono text-dim text-w-base">
        No sponsorship data available
      </div>
    );
  }

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex h-full flex-col"
      >
        <div className="shrink-0 border-border border-b">
          <UnifiedKPIs {...kpis} />
        </div>
        <ExpandedTabs
          widgetId={widgetId}
          ocData={ocData}
          ghData={ghData}
          selectedDetailId={selectedDetailId}
          onSelectedDetailIdChange={onSelectedDetailIdChange}
        />
      </m.div>
    </LazyMotion>
  );
}
