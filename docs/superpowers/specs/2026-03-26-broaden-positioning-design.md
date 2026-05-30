# Broaden Radarboard Positioning

## Problem

Radarboard currently reads too much like a developer-only product in key marketing and onboarding surfaces. That narrows the perceived audience even though the product is open source, free, and useful for a wider set of people connecting API-driven services.

## Decision

Position Radarboard around the shared job first: connecting the services people use and showing the signals that matter in one dashboard.

Name concrete audiences immediately after that core job:

- Indie hackers
- Open-source maintainers
- Creators
- Teams

Avoid framing Radarboard as a "developer dashboard" or as a product only for "software teams."

## Copy Direction

- Hero copy should be job-first, not identity-first.
- Supporting copy should mention concrete audiences and mixed workflows.
- Product examples can stay technical where accurate, but surrounding framing should cover broader use cases such as audience, revenue, launches, sponsorship, and operations.
- In-app onboarding should match the broader positioning so first-run product language is consistent with the marketing site.

## Scope

- Update shared marketing copy in `apps/marketing/data/site.ts`
- Update homepage support copy in `apps/marketing/app/page.tsx`
- Broaden supporting marketing components that still imply software teams only
- Update onboarding welcome copy in `apps/app`
- Update user-facing widget metadata that still says "developer"
- Add a repo guardrail in `AGENTS.md`
