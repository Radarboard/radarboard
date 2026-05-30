# Radarboard Release Notes Template

The normal Radarboard flow now auto-generates `release-notes/desktop-v<version>.md` from consumed Changesets and git author metadata during `pnpm changeset:version`.

Use this template only if you need to hand-author or replace a release note file:

```bash
pnpm release:notes --tag desktop-v0.1.0
```

Guidelines:

- Lead with user-facing outcomes, not implementation details.
- Cover the whole product when relevant: app, desktop, plugins, integrations, widgets, docs.
- Use Changesets as the package-level source of truth, but do not turn this file into a package changelog.
- Keep the generated section markers if you want future auto-generation runs to preserve your curated summary block.
