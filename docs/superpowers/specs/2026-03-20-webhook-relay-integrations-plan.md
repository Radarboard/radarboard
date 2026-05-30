# Rework Webhook Relay UX Inside Settings Integrations

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md). It is written so a new contributor can resume the work using only this file and the current repository state.

## Purpose / Big Picture

The integrations settings screen currently mixes discovery, connection state, and webhook relay configuration in one place. After this change, the integrations catalog should stay focused on discovery and connection status, while webhook setup becomes contextual: a shared relay modal manages the relay base URL, and each webhook-capable integration exposes its exact derived endpoint and signing secret inside its own detail modal. The result is observable when the old page-level relay card is gone, the header exposes a `Webhook Relay` action, and supported integration modals show webhook setup in a responsive two-column layout.

## Scope

In scope:
- Remove the old page-level `Webhook Relay` card from the integrations catalog.
- Add a shared relay action in the integrations header.
- Convert the relay UI into a dedicated modal.
- Expand relevant integration detail modals into a responsive two-column layout.
- Show derived webhook endpoints and per-service signing secret controls inside supported integration modals.
- Keep relay deployment configuration separate from dashboard-stored runtime secrets.
- Add focused validation for the new relay and modal behavior.

Out of scope:
- New settings sub-navigation or a larger information architecture change.
- Deployment automation for relay environment variables.
- Changes to non-webhook integrations beyond layout plumbing they share with the same modal component.
- Reworking unrelated settings pages.

## Progress

- [ ] 2026-03-26 00:00Z: Create a compliant ExecPlan from the approved webhook relay design.
- [ ] Implement Milestone 1: header action and shared relay modal.
- [ ] Implement Milestone 2: responsive two-column integration modal layout.
- [ ] Implement Milestone 3: per-integration webhook setup cards and secret management.
- [ ] Implement Milestone 4: test the relay modal, webhook-capable integrations, and responsive behavior.
- [ ] Implement Milestone 5: document outcomes and any residual gaps.

## Surprises & Discoveries

- Observation: The approved design sharply separates relay base URL management from per-provider webhook setup.
  Evidence: The design explicitly states that the shared relay modal should not list every endpoint and should keep deployment env configuration out of the dashboard UI.

- Observation: This work is mostly a UI and state-flow refactor, but it still has a meaningful secrets-handling surface because signing secrets are stored in the credentials repository.
  Evidence: The design requires reveal, copy, generate, regenerate, and manual save behavior for keys like `webhook_secret::<id>`.

## Decision Log

- Decision: Keep this plan scoped to settings UX and stored credentials, not relay deployment automation.
  Rationale: The approved design treats dashboard-managed secrets and deployment-managed env vars as separate concerns.
  Date/Author: 2026-03-26 / Codex

- Decision: Use the integrations page and modal layout itself as the main acceptance surface, rather than inventing new infrastructure tests first.
  Rationale: The user-visible behavior is the point of this change, and the validation should reflect that directly.
  Date/Author: 2026-03-26 / Codex

## Outcomes & Retrospective

No implementation work has been completed from this plan yet. When work progresses, this section must summarize what shipped, what diverged from the original intent, and which follow-up tasks remain.

## Context and Orientation

This initiative lives in the app settings UI under `apps/app/components/settings/`. The design doc at [2026-03-20-webhook-relay-integrations-design.md](/Users/thedaviddias/Projects/radarboard/docs/superpowers/specs/2026-03-20-webhook-relay-integrations-design.md) already establishes the product direction: the integrations page should focus on discovery and connection state, while webhook setup belongs inside the relevant integration modals.

There are three main areas involved:

- `apps/app/components/settings/settings-catalog-header/index.tsx`
  This controls the header row for settings catalog views. It needs to support an additional action button on the integrations screen without disrupting the current title, description, status, category, and search pattern.

- `apps/app/components/settings/settings-integrations/index.tsx`
  This is the main orchestration layer for the integrations settings page and its detail modals. It will absorb most of the change: removing the old relay card, opening the shared relay modal, widening integration modals, and conditionally rendering webhook setup cards for supported services.

- `apps/app/components/settings/settings-webhook-relay/index.tsx`
  This currently represents or supports the relay configuration UI. It needs to become dialog-friendly rather than living as a page-level catalog card.

In this context, “webhook-capable integrations” means services backed by the relay where the dashboard should derive the final endpoint from the shared relay base URL and `/api/webhooks/<integration>`. The design currently names GitHub, Vercel, Sentry, Linear, and BetterStack as supported integrations. “Signing secret” refers to the provider-facing secret stored in the credentials repository under a key like `webhook_secret::github`, not the deployment env var used by the relay service itself.

## Plan of Work

Start by refactoring the integrations header and shared relay UI. The old page-level relay card must disappear before the new modal-based interaction feels coherent. This first step should keep the integrations catalog visually stable while moving relay configuration behind a header action.

Next, rework the integration detail modal layout so supported services can accommodate webhook setup without cramming it into the existing single-column arrangement. The two-column structure should only expand on larger viewports and must collapse cleanly on narrow screens without introducing horizontal overflow.

Once the layout exists, add the webhook setup card for supported integrations. The card should derive the endpoint at render time from the relay base URL, show a useful empty state when the relay URL is missing, and expose the signing secret controls in the same place where the user configures the provider webhook.

Finish by tightening validation: test the removal of the old relay card, the new header action, the empty-state and configured-state behavior of webhook-capable integration modals, and the responsive layout behavior. Update this plan’s living sections as implementation proceeds.

## Milestones

## Milestone 1: Header Action And Shared Relay Modal

At the end of this milestone, the integrations page should no longer render the old `Webhook Relay` catalog card. Instead, the integrations header should expose a secondary `Webhook Relay` action that opens a dedicated relay modal responsible only for the shared relay base URL and short guidance.

Implementation guidance:
- Update `apps/app/components/settings/settings-catalog-header/index.tsx` to support an optional secondary action for the integrations screen.
- Update `apps/app/components/settings/settings-integrations/index.tsx` to remove the old relay card and open a relay dialog from the new header action.
- Update or replace `apps/app/components/settings/settings-webhook-relay/index.tsx` so it behaves like a dialog body rather than a catalog card.

Acceptance:
- The old page-level relay card is gone.
- The integrations header opens the relay modal.
- The relay modal manages only the global relay base URL and concise guidance.

## Milestone 2: Responsive Two-Column Integration Modals

At the end of this milestone, integration detail modals should expand into a responsive two-column layout on wider screens and collapse back to one column on smaller screens. Credential setup should remain easy to scan and all scrollable surfaces must avoid horizontal overflow.

Implementation guidance:
- Update `apps/app/components/settings/settings-integrations/index.tsx` to widen supported integration modals.
- Use a responsive two-column arrangement with auth/config in the left column and webhook/notifications in the right column on larger viewports.
- Ensure modal scroll containers use `scrollbar-thin` and do not create horizontal scrolling.

Acceptance:
- Supported integration modals render as two columns on wider screens.
- The same modals collapse safely on smaller screens.
- Modal content remains readable and does not overflow horizontally.

## Milestone 3: Per-Integration Webhook Setup Cards

At the end of this milestone, each supported webhook integration should show its derived endpoint and signing secret controls inside its own detail modal, while non-webhook integrations show no such card.

Implementation guidance:
- In `apps/app/components/settings/settings-integrations/index.tsx`, conditionally render a `Webhook setup` card for GitHub, Vercel, Sentry, Linear, and BetterStack.
- Derive the endpoint from the saved relay base URL and `/api/webhooks/<integration>`.
- Show an empty state with a CTA back to the shared relay modal if the relay URL is missing or invalid.
- Store signing secrets using credentials keys like `webhook_secret::<id>`.
- Support reveal, hide, copy, generate, regenerate, and manual save behavior.
- Ensure regeneration creates a draft value first and warns the user that rotation invalidates the provider-side webhook until updated.

Acceptance:
- Supported integrations show the derived endpoint when the relay URL exists.
- Supported integrations show a relay CTA when the relay URL is missing.
- Signing secrets can be created, revealed, copied, and rotated.
- Non-webhook integrations do not render the webhook setup card.

## Milestone 4: Validation And Cleanup

At the end of this milestone, the touched settings code should pass tests and static checks, and this plan should reflect the final state of the work.

Implementation guidance:
- Add or update focused tests under `apps/app/components/settings/*.test.tsx`.
- Confirm the relay URL remains stored under the existing project integrations system key.
- Confirm per-service endpoints are derived rather than stored.
- Update the living sections in this plan with implementation outcomes.

Acceptance:
- The integrations page and affected settings tests pass.
- The touched settings files pass lint and typecheck.
- The plan records the final implementation state and any follow-up items.

## Concrete Steps

Run commands from the repository root unless another directory is specified.

For focused UI checks while iterating:

    cd /Users/thedaviddias/Projects/radarboard
    pnpm --filter @radarboard/app exec biome check apps/app/components/settings
    pnpm --filter @radarboard/app exec tsc --noEmit

For app-level tests once the behavior is wired:

    cd /Users/thedaviddias/Projects/radarboard/apps/app
    pnpm vitest run --reporter=verbose components/settings

If the actual package scripts or file globs differ in the working tree, update this section in the plan before proceeding so the next contributor does not need to rediscover the correct commands.

## Validation and Acceptance

Validation is complete only when all of the following are true:

- The integrations page no longer renders the old relay card.
- The header action opens the shared relay modal.
- Webhook-capable integration modals show the derived endpoint when the relay URL exists.
- Webhook-capable integration modals show a relay CTA when the relay URL is missing or invalid.
- Non-webhook integrations do not render a webhook setup card.
- The modal layout is responsive and does not introduce horizontal scrolling.
- Signing secret generation and regeneration behave as described and require explicit save before persisting.
- The touched settings tests, lint checks, and typechecks pass.

Manual verification should include:

    1. Open Settings > Integrations.
    2. Confirm the old relay card is not present.
    3. Click the header action and verify the relay modal opens.
    4. Open a supported integration with and without a configured relay URL.
    5. Verify the empty-state and configured-state webhook card behavior.
    6. Generate or rotate a signing secret and verify copy/reveal/save behavior.
    7. Resize the modal and verify the layout collapses cleanly on narrow viewports.

## Idempotence and Recovery

Most of this work is UI composition and is safe to repeat. Modal layout refactors, header action wiring, and derived endpoint rendering can be retried after each lint/test pass. The riskiest part is secrets-handling UX, where a poor draft/save flow could accidentally rotate a secret sooner than intended.

Recovery guidance:
- Treat regeneration as a draft-only action until the user explicitly saves.
- Keep the existing relay URL storage path untouched until the new modal is confirmed working.
- Land layout and modal-shell changes before secret-management refinements so regressions are easier to isolate.
- If supported integrations need separate quirks, hide the webhook card for the problematic service temporarily rather than breaking the whole modal flow.

## Artifacts and Notes

Primary source files for this work:
- [2026-03-20-webhook-relay-integrations-design.md](/Users/thedaviddias/Projects/radarboard/docs/superpowers/specs/2026-03-20-webhook-relay-integrations-design.md)
- `apps/app/components/settings/settings-catalog-header/index.tsx`
- `apps/app/components/settings/settings-integrations/index.tsx`
- `apps/app/components/settings/settings-webhook-relay/index.tsx`
- `apps/app/components/settings/*.test.tsx`

The key architectural boundary in this change is that relay deployment env vars remain a separate deployment concern. The dashboard manages user-facing relay URL and provider signing secret configuration, but it does not automate relay service deployment.

## Interfaces and Dependencies

Internal dependencies:
- The settings catalog header must support an optional secondary action.
- The integrations settings screen must support opening the relay modal and rendering wider detail modals.
- The webhook relay settings component must be usable as modal content.
- Credential storage must continue to support service-scoped secrets using keys like `webhook_secret::<id>`.

User-visible interfaces that must exist by the end:
- A shared relay modal reachable from the integrations header.
- A responsive integration detail modal layout with webhook setup on supported services.
- A webhook setup card that derives endpoints instead of storing them directly.

Revision note: 2026-03-26. Created this ExecPlan from the approved webhook relay design to test the `PLANS.md` standard against integration-oriented settings work.
