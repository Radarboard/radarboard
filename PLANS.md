# Radarboard ExecPlan Standard

This file defines the standard for execution plans in Radarboard.

An execution plan is called an `ExecPlan` in this repository. An ExecPlan is a self-contained, living document that a new contributor or stateless coding agent can follow to deliver a working, observable outcome without relying on prior chat history or undocumented repo knowledge.

## How To Use ExecPlans
- Use an ExecPlan for multi-hour or multi-session work.
- Use an ExecPlan for cross-package or cross-app changes.
- Use an ExecPlan for significant refactors, migrations, infrastructure changes, or work with sequencing dependencies.
- Do not create an ExecPlan for small, local, low-risk tasks such as minor copy edits, small bug fixes, or isolated lint cleanup.

When authoring an ExecPlan:
- Follow this file closely.
- Re-read source material as needed before finalizing the plan.
- Resolve ambiguity in the plan itself instead of pushing decisions onto the future implementer.

When implementing from an ExecPlan:
- Proceed milestone by milestone.
- Keep the living-document sections current as work progresses.
- Update the plan before stopping on partial work.

## Where Plans Live
- Store ExecPlans in [docs/superpowers/specs](/Users/thedaviddias/Projects/radarboard/docs/superpowers/specs).
- Name them `YYYY-MM-DD-<topic>-plan.md`.
- Keep design docs and ExecPlans separate when both exist.
- If a task already has a design doc, create the ExecPlan beside it.
- Every ExecPlan should mention near the top that it is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md).

## Non-Negotiable Requirements
- Every ExecPlan must be fully self-contained.
- Every ExecPlan must be a living document.
- Every ExecPlan must enable a complete novice to complete the work end to end.
- Every ExecPlan must describe a demonstrably working outcome, not just code edits.
- Every ExecPlan must define non-obvious terms in plain language, or avoid them.
- Every ExecPlan must include enough repository context that a new contributor can find the relevant files and understand why they matter.
- Every ExecPlan must include exact verification instructions with expected behavior.
- Every ExecPlan must remain accurate after each revision.

## Formatting Expectations
- Write in plain prose first.
- Prefer short paragraphs over long bullet dumps.
- Use checklists only in the `Progress` section.
- Use Markdown headings and normal Markdown syntax.
- Name files with full repository-relative paths.
- When listing commands, include the working directory and the exact command to run.
- When describing results, phrase acceptance as observable behavior rather than internal implementation trivia.
- Do not rely on external links or undocumented architecture knowledge inside an ExecPlan. Any critical context must be written into the plan itself.

## Required Sections

### Title
- Use a short, action-oriented title.

### Purpose / Big Picture
- Explain what someone gains after the change.
- State how they can see it working.
- Lead with user-visible behavior or maintainer-visible outcomes.

### Scope
- State what is in scope.
- State what is explicitly out of scope.

### Progress
- Use checkboxes.
- Include timestamps.
- Reflect the actual current state at all times.
- Split partially completed work into completed and remaining pieces when needed.

Example:

```md
## Progress
- [x] 2026-03-26 10:15Z: Audited current plugin settings flow.
- [ ] Implement shared polling state for task and expense plugins.
- [ ] Verify desktop and web behavior match.
```

### Surprises & Discoveries
- Record unexpected constraints, bugs, or implementation discoveries.
- Include concise evidence when possible.

Example:

```md
- Observation: Plugin overlay state is only synchronized after client-side navigation.
  Evidence: Reloading a deep-linked URL loses the selected item until a second interaction occurs.
```

### Decision Log
- Record meaningful decisions as they are made.
- Include the rationale.
- Include the date and author when practical.

Example:

```md
- Decision: Keep overlay query state in the shared hook instead of each plugin component.
  Rationale: The behavior must stay consistent across plugins and avoids duplicate fixes.
  Date/Author: 2026-03-26 / Codex
```

### Outcomes & Retrospective
- Summarize what shipped or was completed.
- Note what changed from the original intent.
- Capture follow-up work or remaining gaps.

### Context and Orientation
- Describe the relevant current state as if the reader knows nothing about the repo.
- Name the important files, routes, components, services, and modules by full repository-relative path.
- Define any non-obvious terms immediately.
- Do not assume the reader has seen earlier plans.

### Plan of Work
- Describe the sequence of edits and additions in prose.
- Name the files and modules to touch.
- Explain what each major step accomplishes and why the order matters.

### Concrete Steps
- State the exact commands to run.
- State the working directory for each command.
- Include short expected outputs when they help a novice verify progress.
- Update this section as implementation evolves.

### Validation and Acceptance
- Describe how to exercise the feature or change.
- Include the automated checks to run.
- Include manual verification when relevant.
- Phrase acceptance criteria as observable behavior with specific inputs and outputs.

### Idempotence and Recovery
- Explain which steps are safe to repeat.
- Explain how to recover from partial failure.
- Call out any risky, destructive, or migration-related steps and how to back out safely.

### Artifacts and Notes
- Include short, relevant transcripts, diffs, snippets, or evidence.
- Keep them concise and focused on proving success.

### Interfaces and Dependencies
- Name the libraries, packages, services, and internal modules involved.
- Be explicit about any interfaces, types, APIs, or contracts that must exist at the end of the work.
- When multiple areas are involved, explain how they relate.

## Milestones
- If the work is large, organize it into milestones.
- Each milestone must describe what will exist at the end of that milestone that did not exist before.
- Each milestone must be independently verifiable.
- Milestones are narrative and outcome-focused, not just administrative buckets.
- Prototyping milestones are allowed when they reduce uncertainty, but they must still be testable and clearly labeled as prototypes.

## Validation Standard
- Validation is mandatory.
- Include the exact project commands required for linting, typechecking, tests, builds, or manual runs.
- Include expected outcomes so a novice can distinguish success from failure.
- If a change is internal, explain how its effect can still be demonstrated.
- Prefer proof through behavior over proof through code structure.

## Maintenance Rules
- Update the plan before handing work off or pausing.
- Update the `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` sections throughout implementation.
- If you change course, record the reason in `Decision Log` and reflect the impact everywhere else in the plan.
- When revising a plan, add a short note at the bottom describing what changed and why.
- The plan must always be restartable by someone with only the working tree and the plan file.

## Radarboard-Specific Expectations
- Respect the repo rules in [AGENTS.md](/Users/thedaviddias/Projects/radarboard/AGENTS.md).
- Prefer one ExecPlan per initiative, even if the work spans multiple apps or packages.
- Do not create per-app or per-package `PLANS.md` files unless the repository operating model changes substantially.
- Keep plan language concrete and implementation-oriented.
- Reuse the existing `docs/superpowers/specs` location instead of introducing another planning directory.

## Quality Bar
A high-quality ExecPlan should allow a new contributor to answer all of these questions without opening chat history:
- What is being built or changed?
- Why does it matter?
- Where in the repo does the work happen?
- In what order should the work be done?
- How do I verify each major step?
- How do I recover if something fails?
- What decisions have already been made, and why?

Revision note: 2026-03-26. Expanded this file to align more closely with the OpenAI ExecPlan guidance by adding stronger self-containment, formatting, milestone, validation, and restartability requirements.
