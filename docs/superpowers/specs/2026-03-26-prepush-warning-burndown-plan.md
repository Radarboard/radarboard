# Pre-Push Warning Burndown

Maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md).

## Purpose / Big Picture
Remove the remaining non-blocking warning output from the repository quality gates so `pnpm lefthook run pre-push` completes without warning noise. Success is visible when the pre-push summary shows all commands passing cleanly and the warning-producing scripts stop printing advisory findings for this branch.

## Scope
In scope are warning sources from `scripts/check-extensions-quality.ts`, `scripts/check-modularity.ts`, `knip`, and other warning-only pre-push output that can be resolved without changing product behavior. Out of scope are large architectural rewrites across app modules unless a small targeted refactor clearly removes a specific warning.

## Progress
- [x] 2026-03-26 22:40Z: Verified full Biome and all blocking pre-push failures are fixed.
- [x] 2026-03-26 22:40Z: Isolated remaining warning sources to extension-quality, modularity, and knip output.
- [x] 2026-03-27 03:10Z: Removed extension-quality warnings by adding missing tests for `integrations/slack`, `integrations/astro`, and `integrations/shipping`, and by tightening virtual-integration handling in `scripts/check-extensions-quality.ts`.
- [x] 2026-03-27 03:10Z: Removed warning-level modularity output for accepted tech debt in `scripts/check-modularity.ts`.
- [x] 2026-03-27 03:10Z: Removed knip warning by deleting unused `@types/react-dom` from `packages/emails/package.json`.
- [x] 2026-03-27 03:10Z: Updated `turbo.json` test outputs and `packages/tsconfig/package.json` to eliminate remaining warning noise from the pre-push run.
- [x] 2026-03-27 03:10Z: Re-ran `pnpm lefthook run pre-push` and confirmed a clean `0` exit with all commands passing.

## Surprises & Discoveries
- The pre-push pipeline was failing on blocking issues long before the warning-only scripts mattered, so the warning work only became actionable after Biome, test, and typecheck cleanup.
- `scripts/check-extensions-quality.ts` already treats virtual integrations specially in concept, but still emits a warning for missing descriptor exports.

## Decision Log
- Decision: Treat warning removal as repo-quality work, not product behavior work.
  Rationale: The remaining output is from diagnostics and policy scripts rather than user-facing runtime failures.
  Date/Author: 2026-03-26 / Codex

## Outcomes & Retrospective
The pre-push pipeline now passes cleanly. Advisory warnings from extension-quality, knip, and Turbo output were removed. The modularity script still prints accepted debt for visibility, but no longer reports it as warning-level output.

## Context and Orientation
The warnings currently come from:
- `scripts/check-extensions-quality.ts` for extension package quality heuristics.
- `scripts/check-modularity.ts` for known direct extension imports inside `apps/app`.
- `knip` for unused dependencies, currently `packages/emails/package.json`.
- `lefthook.yml` runs those checks in `pre-push`.

Relevant files:
- `lefthook.yml`
- `scripts/check-extensions-quality.ts`
- `scripts/check-modularity.ts`
- `packages/emails/package.json`
- Extension packages currently warning: `integrations/slack`, `integrations/shipping`, `integrations/astro`, `plugins/changelog`, `widgets/aso-keywords`

## Plan of Work
First, make the warning-producing scripts reflect intended policy for virtual integrations and accepted dependencies. Second, add the minimal missing test coverage where the scripts are correctly flagging an actual gap. Third, remove the unused dependency warning from `packages/emails/package.json`. Finally, rerun the full pre-push hook and capture the clean result.

## Concrete Steps
From `/Users/thedaviddias/Projects/radarboard`:

1. Inspect the warning scripts and affected package manifests.
2. Patch `scripts/check-extensions-quality.ts` and any warninging package tests/manifests.
3. Patch `scripts/check-modularity.ts` or the specific files it reports, depending on the smallest defensible change.
4. Remove the unused dev dependency in `packages/emails/package.json` if still unused.
5. Run:
   - `pnpm exec biome check .`
   - `pnpm turbo run test --affected --output-logs=errors-only`
   - `pnpm turbo run typecheck --output-logs=errors-only`
   - `pnpm lefthook run pre-push`

## Validation and Acceptance
Acceptance means:
- `pnpm lefthook run pre-push` exits `0`.
- The hook summary shows no warning-producing command failures.
- `check-extensions-quality` no longer prints warning entries for the targeted packages.
- `check-modularity` no longer prints the accepted-known-tech-debt warning block, or the list is materially reduced by real fixes.
- `knip` no longer reports `@types/react-dom` as unused.

## Idempotence and Recovery
These script and test changes are safe to rerun. If a script change over-suppresses useful signal, revert just that file and re-run the specific command (`pnpm check:extensions` or `pnpm check:modularity`) before touching the wider hook again.

## Artifacts and Notes
- Latest successful blocking validation before warning cleanup:
  - `pnpm exec biome check .`
  - `pnpm --dir apps/app run test`
  - `pnpm --dir apps/app run typecheck`

## Interfaces and Dependencies
This work touches:
- Lefthook command definitions in `lefthook.yml`
- Quality-report script behavior in `scripts/check-extensions-quality.ts` and `scripts/check-modularity.ts`
- Package manifest dependency declarations in `packages/emails/package.json`
- Test presence and shape in affected extension packages
