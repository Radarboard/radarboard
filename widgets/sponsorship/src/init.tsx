"use client";
import type { GitHubSponsor } from "@radarboard/types/github-sponsors";
import type {
  OpenCollectiveMember,
  OpenCollectiveTransaction,
} from "@radarboard/types/open-collective";
import {
  registerTemplateDetailRenderer,
  type TemplateDetailRendererProps,
} from "@radarboard/widget-sdk/detail-renderer-registry";
import { MemberDetail } from "./components/member-detail";
import { SponsorDetail } from "./components/sponsor-detail";
import { TransactionDetail } from "./components/transaction-detail";

function SponsorDetailRenderer({ item }: TemplateDetailRendererProps<GitHubSponsor>) {
  return <SponsorDetail sponsor={item} />;
}
function MemberDetailRenderer({ item }: TemplateDetailRendererProps<OpenCollectiveMember>) {
  return <MemberDetail member={item} />;
}
function TransactionDetailRenderer({
  item,
}: TemplateDetailRendererProps<OpenCollectiveTransaction>) {
  return <TransactionDetail transaction={item} />;
}

export function initializeSponsorshipWidget() {
  registerTemplateDetailRenderer("sponsorship.sponsor", SponsorDetailRenderer);
  registerTemplateDetailRenderer("sponsorship.member", MemberDetailRenderer);
  registerTemplateDetailRenderer("sponsorship.transaction", TransactionDetailRenderer);
}
