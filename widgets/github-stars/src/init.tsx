"use client";
import {
  registerTemplateDetailRenderer,
  type TemplateDetailRendererProps,
} from "@radarboard/widget-sdk/detail-renderer-registry";
import { GitHubStarsRepoDetail } from "./components/github-stars-repo-detail";
import type { GitHubRepoData } from "./types";

function GitHubStarsRepoDetailRenderer({
  item,
  projectSlug,
}: TemplateDetailRendererProps<GitHubRepoData>) {
  return <GitHubStarsRepoDetail repo={item} projectSlug={projectSlug} />;
}

export function initializeStarsWidget() {
  registerTemplateDetailRenderer("github.stars-repo", GitHubStarsRepoDetailRenderer);
}

export const initializeGithubStarsWidget = initializeStarsWidget;
