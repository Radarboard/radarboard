# Community Extensions Repository Blueprint

## Context

At 50 extensions in-repo, the monorepo model works well. Based on research of
Backstage (200+ community plugins in a separate repo), Home Assistant (2,800+
integrations + HACS), and Raycast (1,500+ in a single repo), we should plan the
split before hitting ~100 extensions.

## When to split

Trigger the split when **any** of these conditions are met:

- Extension count exceeds 100
- PR review time for extension contributions exceeds 48 hours consistently
- CI time for extension tests exceeds 10 minutes
- More than 3 community contributors are actively submitting extensions

## Proposed structure

```
radarboard/community-extensions/
  integrations/
    notion/
    jira/
    ...
  plugins/
    pomodoro/
    kanban/
    ...
  widgets/
    weather/
    ci-builds/
    ...
  radarboard.community.config.ts   # mirrors radarboard.config.ts structure
  scripts/
    validate-all.ts                # runs conformance + quality checks
    generate-catalog.ts            # produces catalog.json for the main app
  .github/
    workflows/
      ci.yml                       # lint, typecheck, test, quality checks
      publish-catalog.yml           # on merge → update catalog in main repo
  package.json                      # workspace root with SDK deps
  pnpm-workspace.yaml
```

## Governance model

### Tiers

| Tier | Location | Review | Testing | SLA |
|------|----------|--------|---------|-----|
| **Official** | `radarboard/radarboard` | Core team | Every release | Bug fixes within 1 week |
| **Community** | `radarboard/community-extensions` | Core team review, community PR | CI on every PR | Best effort |
| **Experimental** | `radarboard/community-extensions` | Automated checks only | CI on every PR | None |

### Promotion path

1. **Experimental** → **Community**: Pass all conformance tests, 1 core team review
2. **Community** → **Official**: 3+ months stable, >10 users, core team adopts maintenance

### Deprecation

Extensions with no commits in 6 months get a `deprecated` label. After 12 months,
moved to an `_archive/` directory (still installable but hidden from catalog).

## Integration with main repo

The community repo publishes a `catalog.json` artifact. The main app fetches this
at build time (or on-demand in the catalog UI) to show community extensions
alongside official ones. Installation uses the existing GitHub URL installer.

## SDK versioning contract

Community extensions pin to a **minor version range** of the SDK:

```json
{
  "@radarboard/widget-sdk": "^0.1.0"
}
```

The `test:extensions` CI in the community repo runs against the **latest** SDK
from the main repo's `main` branch. Breaking changes trigger automated issues.

## Migration plan

1. Create `radarboard/community-extensions` repo with template structure
2. Move first batch of "community-tier" extensions (if any exist)
3. Update `create-radarboard-extension` CLI to offer "community" target
4. Update extension installer to handle community repo URLs
5. Update catalog UI to show community extensions with tier badge
6. Document the contribution flow in CONTRIBUTING.md

## Not yet needed

- npm publishing (extensions install from GitHub, not npm)
- Dynamic runtime loading (static compilation is faster and safer)
- Extension review board (core team reviews are sufficient until 200+)
