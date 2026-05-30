# Radarboard

Radarboard is a local-first desktop board for the signals that tell you how your work is doing: revenue, product analytics, incidents, releases, pull requests, sponsorship, reviews, SEO, and roadmap activity.

It is built for indie hackers, open-source maintainers, creators, and teams who need one quiet place to see what changed without opening every operational tool they use.

[Documentation](https://docs.radarboard.app) · [Desktop releases](https://github.com/Radarboard/radarboard/releases) · [Community extensions](https://github.com/Radarboard/community-extensions) · [Homebrew tap](https://github.com/Radarboard/homebrew-radarboard)

## What Radarboard Tracks

- Revenue and subscriptions from RevenueCat and Open Collective
- Product analytics from OpenPanel
- Search performance from Google Search Console
- Errors and incidents from Sentry and BetterStack
- Shipping activity from GitHub, Linear, and Vercel
- App Store reviews from App Store Connect
- Email and alert activity from Resend
- Custom integrations, plugins, and widgets through the Radarboard SDKs

## Desktop Beta

The current public beta channel is published from this repository through GitHub Releases.

- Latest releases: <https://github.com/Radarboard/radarboard/releases>
- Beta tag format: `desktop-vX.Y.Z-beta.N`
- Homebrew tap repository: <https://github.com/Radarboard/homebrew-radarboard>

After the first beta is published, install the beta cask with:

```bash
brew tap Radarboard/radarboard https://github.com/Radarboard/homebrew-radarboard
brew install --cask radarboard-beta
```

The desktop app uses Tauri updater metadata attached to GitHub desktop releases.

## Local Development

Radarboard is a pnpm and Turborepo monorepo.

```bash
git clone https://github.com/Radarboard/radarboard.git
cd radarboard
pnpm install
pnpm dev
```

Useful local URLs:

- Dashboard app: `https://radarboard.localhost:1355`
- Marketing site: `https://radarboard-marketing.localhost:1355`
- Docs: run `pnpm --filter @radarboard/docs dev`

Common commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm docs:sdk:check
```

## Repository Layout

```text
apps/
  app/          Dashboard web app loaded by the desktop shell
  desktop/      Tauri desktop app
  docs/         Mintlify documentation
  marketing/    Public website
integrations/   First-party service integrations
plugins/        First-party plugin surfaces
widgets/        First-party dashboard widgets
packages/       Shared SDKs, UI, utilities, and app packages
skills/         Repo-local Codex extension-creation skills
```

## Extensions

Radarboard extensions are regular TypeScript packages registered through `radarboard.config.ts`.

- Integrations connect external services.
- Widgets render dashboard cards and panels.
- Plugins add deeper product surfaces and tools.

Start with the extension docs:

- [Build an integration](https://docs.radarboard.app/developer-guide/build-an-integration)
- [Build a widget](https://docs.radarboard.app/developer-guide/build-a-widget)
- [Build a plugin](https://docs.radarboard.app/developer-guide/build-a-plugin)
- [Community extensions](https://github.com/Radarboard/community-extensions)

## Release Flow

- Source repo: `Radarboard/radarboard`
- Desktop release workflow: `.github/workflows/desktop-macos-release.yml`
- Homebrew sync workflow: `.github/workflows/desktop-homebrew-tap-sync.yml`
- Public tap: `Radarboard/homebrew-radarboard`

Desktop beta releases are prereleases. Stable releases require Apple signing and notarization secrets.

## Contributing

Use pnpm only. Before opening a pull request, run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

For extensions, also run:

```bash
pnpm check:extensions
```

## Security

Do not commit local environment files, API keys, signing keys, certificates, or machine-specific MCP configuration. Report security issues privately to the maintainers before opening a public issue.
