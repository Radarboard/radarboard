/**
 * Parse a GitHub URL or shorthand into owner/repo.
 *
 * Accepts:
 *   - https://github.com/user/repo
 *   - github.com/user/repo
 *   - user/repo
 *   - https://github.com/user/repo/tree/main (strips branch path)
 */

export interface GitHubRepo {
  owner: string;
  repo: string;
}

export function parseGitHubUrl(input: string): GitHubRepo | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Full URL: https://github.com/owner/repo[/...]
  const urlMatch = trimmed.match(/^https?:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/);
  if (urlMatch) {
    const [, owner, repo] = urlMatch;
    if (owner && repo) {
      return { owner, repo: cleanRepoName(repo) };
    }
  }

  // github.com/owner/repo
  const domainMatch = trimmed.match(/^github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/);
  if (domainMatch) {
    const [, owner, repo] = domainMatch;
    if (owner && repo) {
      return { owner, repo: cleanRepoName(repo) };
    }
  }

  // owner/repo shorthand
  const shortMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (shortMatch) {
    const [, owner, repo] = shortMatch;
    if (owner && repo) {
      return { owner, repo: cleanRepoName(repo) };
    }
  }

  return null;
}

function cleanRepoName(repo: string): string {
  return repo.replace(/\.git$/, "");
}
