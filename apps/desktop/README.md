# Desktop App

Native desktop application for Radarboard, built with [Tauri v2](https://v2.tauri.app/). Wraps the Next.js web app in a native window with system tray integration and local SQLite storage.

## How It Works

The desktop app spawns the Next.js standalone server as a child process on a random local port, then loads it in a native OS webview. All 76+ API routes, SSE streams, and the AI assistant work identically to the web version — nothing is re-implemented.

```
┌─────────────────────────────────────────┐
│  Tauri Shell (native window + tray)     │
│  ┌───────────────────────────────────┐  │
│  │  OS Webview                       │  │
│  │  → http://127.0.0.1:<port>        │  │
│  └───────────────────────────────────┘  │
│          ▲                              │
│          │ HTTP                         │
│  ┌───────┴───────────────────────────┐  │
│  │  Next.js Standalone Server        │  │
│  │  (child process)                  │  │
│  │  ├─ API routes                    │  │
│  │  ├─ SSE streams                   │  │
│  │  └─ SQLite (local) or Turso (cloud)│  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## Prerequisites

- [Node.js](https://nodejs.org/) ≥ 20
- [Rust toolchain](https://rustup.rs/) (install via `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- Platform-specific dependencies:
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Linux**: `sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev`
  - **Windows**: [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/), [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

## Development

```bash
# 1. Build the web app with standalone output (required first)
pnpm --filter @radarboard/app build

# 2. Run the desktop app in dev mode
cd apps/desktop
pnpm tauri dev
```

Or from the monorepo root:

```bash
pnpm --filter @radarboard/app build && pnpm dev:desktop
```

The dev command will:
1. Compile the Rust backend
2. Spawn the Next.js standalone server on a random port
3. Open a native window pointing to `http://127.0.0.1:<port>`
4. Show a system tray icon (click to show/hide window)

### Local Dev App Install

To keep a stable installed app separate from local desktop builds, build the isolated dev bundle and link it into `/Applications`:

```bash
pnpm desktop:build:dev-app
pnpm desktop:link:dev-app
```

This creates a `Radarboard Dev.app` symlink in `/Applications` that points at the local Tauri build output. Rebuilding refreshes the app contents in place without touching `/Applications/Radarboard.app`.

Remove the local dev-installed app with:

```bash
pnpm desktop:unlink:dev-app
```

## Production Build

```bash
pnpm build:desktop
```

This command builds the signed `.app` through Tauri, then creates the `.dmg` through the repo-owned `hdiutil` wrapper in `scripts/build-dmg.mjs`.
Outputs platform-specific installers in `src-tauri/target/release/bundle/` for default local builds.
Targeted CI/release builds use `src-tauri/target/<target-triple>/release/bundle/`:
- **macOS**: `.dmg`, `.app`
- **Windows**: `.msi`, `.exe`
- **Linux**: `.AppImage`, `.deb`

## macOS CI And Release

Detailed release instructions live in [RELEASING.md](/Users/thedaviddias/Projects/radarboard/apps/desktop/RELEASING.md).

The repository now has three macOS workflows:

- `Desktop macOS CI`
  Builds an unsigned Apple Silicon `.app` and `.dmg` on pull requests and on `main`, then uploads them as workflow artifacts for internal smoke testing only.
- `Desktop macOS Release`
  Builds a signed, notarized Apple Silicon release and creates a draft GitHub release when you push a `desktop-v*` tag or run the workflow manually.
- `Desktop Homebrew Tap Sync`
  Watches for published `desktop-v*` releases, computes the DMG checksum, and updates the `radarboard` cask in the configured custom Homebrew tap.

### Required GitHub Secrets For macOS Releases With Updater Support

- `APPLE_CERTIFICATE`
  Base64-encoded `.p12` Developer ID Application certificate exported from Keychain Access.
- `APPLE_CERTIFICATE_PASSWORD`
  Password used when exporting the `.p12` signing certificate.
- `KEYCHAIN_PASSWORD`
  Temporary build keychain password used on the GitHub macOS runner.
- `TAURI_SIGNING_PRIVATE_KEY`
  The private updater signing key used to sign trusted update metadata.
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
  Optional password for the updater signing key.
- `HOMEBREW_TAP_GITHUB_TOKEN`
  Fine-grained GitHub token with contents write access to the custom tap repository.

Set this GitHub Actions repository variable for tap sync:

- `HOMEBREW_TAP_REPOSITORY`
  Full owner/name for the custom tap repository, for example `radarboard/homebrew-tap`.

For notarization, configure one of these auth sets:

- `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`
- `APPLE_API_ISSUER`, `APPLE_API_KEY`, `APPLE_API_PRIVATE_KEY`

In this repo, the local updater signing key was generated at `apps/desktop/.tauri/radarboard-updater.key` and is ignored by git. Use its contents for `TAURI_SIGNING_PRIVATE_KEY`.

For local builds, you can keep the updater env vars in your shell profile:

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat /Users/thedaviddias/Projects/radarboard/apps/desktop/.tauri/radarboard-updater.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD='...'
```

### Release Trigger

To create a macOS draft release from CI:

```bash
git tag desktop-v0.1.0
git push origin desktop-v0.1.0
```

Or run `Desktop macOS Release` manually from GitHub Actions and provide the tag name.

Note:

- The current public path is unsigned macOS distribution with signed updater metadata.
- First install still goes through the normal macOS unidentified-developer warning path.
- In-app updates become available only after the GitHub release is published, not while it is still a draft.

## Database

By default, the desktop app uses **local SQLite** — no cloud connection needed. The web app's existing fallback in `apps/app/db/client.ts` handles this automatically when `TURSO_DATABASE_URL` is not set.

For **hybrid cloud sync**, set these environment variables before launching:

```bash
TURSO_DATABASE_URL=libsql://your-db.turso.io TURSO_AUTH_TOKEN=your-token pnpm tauri dev
```

## Desktop Features

| Feature | Status |
|---------|--------|
| Native window with OS webview | Done |
| System tray (show/hide/quit) | Done |
| Window state persistence (size/position) | Done |
| Local SQLite database | Done |
| Hybrid cloud sync (optional Turso) | Done |
| Hide to tray on close | Done |
| Native menu bar (About, Edit, View, Window, Help) | Done |
| Global shortcut (`Cmd+Shift+D` to show/focus) | Done |
| Single instance (prevents duplicate apps) | Done |
| Autostart (launch at login) | Done |
| Structured logging (stdout + webview console) | Done |
| Persistent key-value store (user preferences) | Done |
| Deep links (`radarboard://`) | Done |
| Auto-updater (signed manifests) | Done (inactive, enable in `tauri.conf.json`) |
| Browser shortcut blocking in production | Done |
| CrabNebula DevTools (IPC inspector, tracing) | Done (opt-in via `--features devtools`) |
| Native notifications | Done |
| Code signing | CI-ready when macOS release secrets are configured |

## Tauri Plugins

The desktop app uses the following Tauri v2 plugins:

| Plugin | Purpose |
|--------|---------|
| `tauri-plugin-shell` | Spawn child processes (sidecar server) |
| `tauri-plugin-opener` | Open URLs/files with default app |
| `tauri-plugin-notification` | System notifications |
| `tauri-plugin-log` | Structured logging to stdout and webview console |
| `tauri-plugin-store` | Persistent key-value store for user preferences |
| `tauri-plugin-deep-link` | Handle `radarboard://` URLs |
| `tauri-plugin-updater` | In-app auto-updates with signed manifests |
| `tauri-plugin-window-state` | Save/restore window size and position (desktop) |
| `tauri-plugin-single-instance` | Prevent duplicate app instances (desktop) |
| `tauri-plugin-autostart` | Launch at OS startup (desktop) |
| `tauri-plugin-process` | Current process info (desktop) |
| `tauri-plugin-global-shortcut` | Global hotkeys (desktop) |
| `tauri-plugin-prevent-default` | Disable browser shortcuts in release builds (desktop) |
| `tauri-plugin-devtools` | CrabNebula DevTools — IPC inspector, tracing (desktop, opt-in) |

### Using DevTools

To enable CrabNebula DevTools during development:

```bash
cd apps/desktop
pnpm tauri dev --features devtools
```

This adds a DevTools panel for inspecting IPC calls, Rust tracing spans, plugin registration, and backend logs.

## Directory Structure

```
desktop/
├── README.md
├── package.json
├── tsconfig.json
├── placeholder/
│   └── index.html            # Loading screen shown before server starts
├── scripts/
│   ├── build-sidecar.sh      # Bundles Node.js binary + Next.js standalone app
│   └── next-server.mjs       # Server launcher (port discovery, health check, lifecycle)
└── src-tauri/
    ├── Cargo.toml             # Rust dependencies + plugin declarations
    ├── build.rs               # Tauri build script (icon re-encoding, target triple)
    ├── tauri.conf.json        # App config (window, bundle, plugins)
    ├── capabilities/
    │   └── default.json       # Permission grants for all plugins
    ├── icons/                 # App icons (replace placeholders before release)
    └── src/
        ├── lib.rs             # App builder, plugins, tray, menu bar, server lifecycle
        └── main.rs            # Desktop entry point (calls lib::run())
```

## iOS (iPad)

The iOS app loads the cloud-hosted web app in a native WKWebView — no local server needed. Currently targets iPad in landscape mode.

### Architecture

```
┌─────────────────────────────────────────┐
│  Tauri iOS App (WKWebView)             │
│  ┌───────────────────────────────────┐  │
│  │  → https://app.radarboard.dev         │  │
│  └───────────────────────────────────┘  │
│          ▲                              │
│          │ HTTPS                        │
│  ┌───────┴───────────────────────────┐  │
│  │  Cloud Backend (Vercel, etc.)     │  │
│  │  ├─ Next.js Server               │  │
│  │  ├─ Turso Database (cloud SQLite) │  │
│  │  ├─ API routes + SSE streams     │  │
│  │  └─ OAuth flows                   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Prerequisites (iOS)

- **macOS** with [Xcode](https://developer.apple.com/xcode/) installed (not just Command Line Tools)
- Rust iOS targets: `rustup target add aarch64-apple-ios aarch64-apple-ios-sim`
- [CocoaPods](https://cocoapods.org/): `brew install cocoapods`

### iOS Development

```bash
# 1. Initialize the Xcode project (one-time)
cd apps/desktop
pnpm ios:init

# 2. Run on iOS Simulator
pnpm ios:dev

# 3. Run on a physical device
pnpm ios:dev:device

# 4. Build for distribution
pnpm ios:build
```

Or from the monorepo root:

```bash
pnpm dev:ios
```

### Cloud URL Configuration

The iOS app loads from `RADARBOARD_CLOUD_URL` (defaults to `https://app.radarboard.dev`). Override it for staging/dev:

```bash
RADARBOARD_CLOUD_URL=https://staging.radarboard.dev pnpm ios:dev
```

### iOS Limitations

- **iPad landscape only** — the dashboard has no responsive phone layout yet
- **Requires internet** — loads from cloud (no local sidecar)
- **No system tray** — iOS manages app lifecycle natively
- **No window state persistence** — iOS handles window management

### iOS Roadmap

| Feature | Status |
|---------|--------|
| iPad landscape support | Done |
| Cloud-hosted webview | Done |
| Native notifications | Done (via plugin) |
| Phone responsive layout | Future |
| Offline mode / local cache | Future |
| Push notifications (APNs) | Future |
| Deep links (`radarboard://`) | Future |
| App Store submission | Future |

## Why Tauri Over Electron

| | Tauri | Electron |
|-|-------|----------|
| **Bundle size** | ~20-30 MB | ~150-200 MB |
| **Memory** | ~30-80 MB | ~100-300 MB |
| **Security** | Sandboxed webview | Full Node.js in renderer |
| **Mobile** | iOS/Android (v2) | Desktop only |

Both approaches would spawn the same Next.js standalone server — the only difference is the shell. Tauri's smaller footprint and stronger security model make it the better fit for a monitoring dashboard that runs alongside other dev tools.
`pnpm build:desktop` builds the signed macOS app bundle and DMG without touching local Radarboard data.

`pnpm build:desktop:fresh-install` is the explicit clean-install path. It:
- builds the desktop app
- installs the built `Radarboard.app` into `/Applications`
- backs up and clears `~/Library/Application Support/Radarboard`
- backs up and clears `~/Library/Application Support/com.radarboard.client`

Use `build:desktop:fresh-install` only when you intentionally want a first-run experience. Normal rebuilds should use `build:desktop` and keep app data intact.
