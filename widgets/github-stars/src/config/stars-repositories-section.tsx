"use client";

import { GitHubRepoMultiPicker } from "./github-repo-multi-picker";
import type { WidgetGitHubRepoSelection } from "./github-repo-multi-picker-utils";

export function StarsRepositoriesSection({
  isGitHubConnected,
  selectedRepos,
  excludedRepos,
  onChange,
}: {
  isGitHubConnected: boolean;
  selectedRepos: WidgetGitHubRepoSelection[];
  excludedRepos: WidgetGitHubRepoSelection[];
  onChange: (repos: WidgetGitHubRepoSelection[]) => void;
}) {
  return (
    <div>
      <div className="mb-3 font-mono text-muted-foreground text-w-sm uppercase tracking-wider">
        Repositories
      </div>
      <div className="space-y-3 rounded-item border border-border bg-surface-raised p-3">
        <GitHubRepoMultiPicker
          isGitHubConnected={isGitHubConnected}
          selectedRepos={selectedRepos}
          excludedRepos={excludedRepos}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
