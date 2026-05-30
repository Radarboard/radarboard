/**
 * AI Action: Install skills from GitHub repos.
 *
 * Supports the skills.sh ecosystem format:
 * - Single skill: `npx skills add owner/repo --skill skill-name`
 * - Multi-skill repo: list available skills, user picks one
 * - Direct URL: any raw markdown with SKILL.md frontmatter
 *
 * SKILL.md format:
 * ```markdown
 * ---
 * name: skill-name
 * description: One-line description
 * ---
 * Instructions content...
 * ```
 */

export interface ParsedSkill {
  id: string;
  name: string;
  description: string;
  instructions: string;
}

export interface SkillRepoInfo {
  owner: string;
  repo: string;
  skillName?: string;
}

export interface AvailableSkill {
  name: string;
  path: string;
}

// ---------------------------------------------------------------------------
// Command parsing
// ---------------------------------------------------------------------------

/**
 * Parse a `npx skills add` command or GitHub URL into repo info.
 *
 * Supported formats:
 * - `npx skills add owner/repo --skill skill-name`
 * - `npx skills add https://github.com/owner/repo --skill skill-name`
 * - `https://github.com/owner/repo`
 * - `owner/repo`
 */
export function parseSkillsCommand(input: string): SkillRepoInfo | null {
  const trimmed = input.trim();

  // Extract --skill flag
  let skillName: string | undefined;
  const skillMatch = trimmed.match(/--skill\s+([^\s]+)/);
  if (skillMatch) {
    skillName = skillMatch[1];
  }

  // Remove npx skills add prefix
  const repoStr = trimmed
    .replace(/^npx\s+skills?\s+add\s+/i, "")
    .replace(/--skill\s+[^\s]+/, "")
    .replace(/-[gyq]\s*/g, "")
    .trim();

  // Handle full GitHub URL
  const ghMatch = repoStr.match(/github\.com\/([^/]+)\/([^/\s]+)/);
  if (ghMatch) {
    const [, owner, repo] = ghMatch;
    if (owner && repo) {
      return { owner, repo: repo.replace(/\.git$/, ""), skillName };
    }
  }

  // Handle owner/repo format
  const slashMatch = repoStr.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (slashMatch) {
    const [, owner, repo] = slashMatch;
    if (owner && repo) {
      return { owner, repo, skillName };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// SKILL.md parsing
// ---------------------------------------------------------------------------

/**
 * Parse a skill definition from markdown with YAML frontmatter.
 */
export function parseSkillMarkdown(content: string): ParsedSkill | null {
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!fmMatch) return null;

  const frontmatter = fmMatch[1] ?? "";
  const body = fmMatch[2]?.trim();

  const fields: Record<string, string> = {};
  for (const line of frontmatter.split("\n")) {
    const match = line.match(/^(\w+)\s*:\s*(.+)$/);
    if (match) {
      const [, key, value] = match;
      if (key && value) {
        fields[key] = value.trim().replace(/^["']|["']$/g, "");
      }
    }
  }

  const name = fields.name;
  const description = fields.description ?? "";
  if (!name || !body) return null;

  const id = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return { id, name, description, instructions: body };
}

// ---------------------------------------------------------------------------
// GitHub API helpers
// ---------------------------------------------------------------------------

const SKILL_SEARCH_DIRS = ["skills", ".claude/skills", ".agents/skills"];

/**
 * List available skills in a GitHub repo by scanning known directories.
 * Uses the GitHub API tree endpoint to find SKILL.md files.
 */
export async function listRepoSkills(owner: string, repo: string): Promise<AvailableSkill[]> {
  const skills: AvailableSkill[] = [];

  for (const dir of SKILL_SEARCH_DIRS) {
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${dir}`, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!res.ok) continue;

      const items = (await res.json()) as Array<{ name: string; type: string; path: string }>;
      for (const item of items) {
        if (item.type === "dir") {
          // Check if this directory has a SKILL.md
          const skillRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${item.path}/SKILL.md`,
            { headers: { Accept: "application/vnd.github+json" } }
          );
          if (skillRes.ok) {
            skills.push({ name: item.name, path: `${item.path}/SKILL.md` });
          }
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }

  return skills;
}

/**
 * Fetch a specific SKILL.md from a GitHub repo.
 */
export async function fetchSkillFromRepo(
  owner: string,
  repo: string,
  skillName: string
): Promise<ParsedSkill | null> {
  // Try multiple possible locations
  const paths = [
    `skills/${skillName}/SKILL.md`,
    `.claude/skills/${skillName}/SKILL.md`,
    `.agents/skills/${skillName}/SKILL.md`,
    `${skillName}/SKILL.md`,
  ];

  for (const path of paths) {
    try {
      const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`);
      if (!res.ok) continue;

      const content = await res.text();
      return parseSkillMarkdown(content);
    } catch {
      // Try the next candidate path.
    }
  }

  return null;
}

/**
 * Fetch and parse a skill from any URL (backward compat).
 */
export async function fetchSkillFromUrl(url: string): Promise<ParsedSkill | null> {
  let fetchUrl = url;
  if (fetchUrl.includes("github.com") && !fetchUrl.includes("raw.githubusercontent.com")) {
    fetchUrl = fetchUrl.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/");
  }

  const response = await fetch(fetchUrl, {
    headers: { Accept: "text/plain, text/markdown" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch skill: HTTP ${response.status}`);
  }

  const content = await response.text();
  return parseSkillMarkdown(content);
}
