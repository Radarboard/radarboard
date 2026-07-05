#!/bin/bash
# Build the desktop sidecar: bundles a Node.js binary + Next.js standalone server.
#
# Instead of compiling with pkg (which breaks Node's require() chain),
# we bundle the raw Node.js binary as a Tauri sidecar and the standalone
# server files as Tauri resources. At runtime, Rust spawns the Node
# binary with server.js as the argument.
#
# Usage: bash scripts/build-sidecar.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DESKTOP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$(cd "$DESKTOP_ROOT/../app" && pwd)"
STANDALONE="$APP_DIR/.next/standalone"
SIDECAR_DIR="$DESKTOP_ROOT/src-tauri/binaries"
RESOURCES="$DESKTOP_ROOT/src-tauri/resources"
RUNTIME_ROOT="$RESOURCES/standalone-runtime"
LAUNCHER_DIR="$RESOURCES/standalone"
RUNTIME_ARCHIVE_NAME="standalone-runtime.tar.gz"
RUNTIME_ARCHIVE="$RESOURCES/$RUNTIME_ARCHIVE_NAME"
DATA_DIR_NAME="${RADARBOARD_DATA_DIR_NAME:-Radarboard}"

# Detect target triple
TARGET_TRIPLE="${TAURI_TARGET_TRIPLE:-$(rustc --print host-tuple 2>/dev/null || echo "aarch64-apple-darwin")}"
echo "[build-sidecar] Target: $TARGET_TRIPLE"

# Step 1: Build the Next.js standalone app fresh so the desktop bundle never
# reuses stale web assets from a previous build.
echo "[build-sidecar] Running app build..."
rm -rf "$STANDALONE"
(cd "$APP_DIR" && pnpm build)

# Step 2: Find the Node.js binary
NODE_BIN="$(which node)"
if [ -z "$NODE_BIN" ]; then
  echo "[build-sidecar] ERROR: node not found in PATH"
  exit 1
fi
# Resolve symlinks to get the real binary
NODE_BIN="$(realpath "$NODE_BIN")"
echo "[build-sidecar] Node.js binary: $NODE_BIN ($(node --version))"

# Step 3: Copy Node.js binary as sidecar
mkdir -p "$SIDECAR_DIR"
BINARY_NAME="radarboard-helper-${TARGET_TRIPLE}"
cp "$NODE_BIN" "$SIDECAR_DIR/$BINARY_NAME"
chmod +x "$SIDECAR_DIR/$BINARY_NAME"
echo "[build-sidecar] Sidecar: $SIDECAR_DIR/$BINARY_NAME ($(du -sh "$SIDECAR_DIR/$BINARY_NAME" | cut -f1))"

# Step 4: Prepare resources — preserve the original directory structure
echo "[build-sidecar] Preparing resources..."
rm -rf "$RESOURCES"
mkdir -p "$RUNTIME_ROOT"

# Copy the standalone output without dereferencing links up front. The traced
# tree can contain stale pnpm symlinks, and blindly following them makes the
# bundle step fail before we have a chance to hoist the real package payloads.
cp -R "$STANDALONE/." "$RUNTIME_ROOT"

# Remove dev artifacts — the bundled app must not ship credentials or data
find "$RUNTIME_ROOT" \( -name ".env" -o -name ".env.local" -o -name ".env.production" -o -name "local.db" -o -name "local.e2e.db" -o -name ".radarboard.json" -o -name ".radarboard.e2e.json" \) -delete 2>/dev/null
echo "[build-sidecar] Removed dev artifacts from bundle"

# Copy static assets (not included by Next.js standalone)
mkdir -p "$RUNTIME_ROOT/apps/app/.next/static"
cp -r "$APP_DIR/.next/static/." "$RUNTIME_ROOT/apps/app/.next/static"

# Copy public assets
if [ -d "$APP_DIR/public" ]; then
  cp -r "$APP_DIR/public" "$RUNTIME_ROOT/apps/app/public"
fi

# Fix missing packages not traced by Next.js standalone.
# Turbopack's file tracing doesn't follow pnpm's symlink tree for certain
# server-only packages (node-fetch, jsdom). We copy each package and ALL
# its co-located dependencies from pnpm's virtual store to ensure the full
# transitive dependency tree is present at runtime.
MONOREPO_ROOT="$(cd "$DESKTOP_ROOT/../.." && pwd)"

copy_pnpm_package_tree() {
  local store_entry="$1"
  if [ ! -d "$store_entry" ]; then return; fi
  for pkg in "$store_entry"/*; do
    [ -d "$pkg" ] || continue
    local name
    name=$(basename "$pkg")
    # Handle scoped packages (@org/name)
    if [[ "$name" == @* ]]; then
      for scoped_pkg in "$pkg"/*; do
        [ -d "$scoped_pkg" ] || continue
        local scoped_name="$name/$(basename "$scoped_pkg")"
        local dest="$RUNTIME_ROOT/node_modules/$scoped_name"
        rm -rf "$dest"
        mkdir -p "$(dirname "$dest")"
        cp -rL "$scoped_pkg" "$dest"
      done
    else
      local dest="$RUNTIME_ROOT/node_modules/$name"
      rm -rf "$dest"
      cp -rL "$pkg" "$dest"
    fi
  done
}

# Packages whose dependency trees are missed by standalone tracing.
UNTRACED_PACKAGE_NAMES=(
  "node-fetch"
  "jsdom"
)

for PKG_NAME in "${UNTRACED_PACKAGE_NAMES[@]}"; do
  while IFS= read -r STORE_PATH; do
    if [ -d "$STORE_PATH" ]; then
      echo "[build-sidecar] Copying untraced package tree: $(basename "$(dirname "$STORE_PATH")")"
      copy_pnpm_package_tree "$STORE_PATH"
    fi
  done < <(find "$MONOREPO_ROOT/node_modules/.pnpm" -maxdepth 2 -path "*/${PKG_NAME}@*/node_modules" -type d)
done

# Hoist pnpm's hidden node_modules so require() can resolve them.
# The traced standalone tree sometimes contains broken links inside
# .pnpm/node_modules, so fall back to the real package payload under
# .pnpm/*/node_modules/<name> when the symlink farm is stale.
resolve_pnpm_package_dir() {
  local pkg_path="$1"
  local pkg_name
  local pkg_dir
  local fallback
  local resolved_pkg
  local after_pnpm
  local version_dir
  local rel_pkg_path
  local monorepo_candidate

  package_dir_has_payload() {
    local dir="$1"
    find "$dir" -mindepth 1 ! -name "package.json" -print -quit | grep -q .
  }

  if [ -e "$pkg_path" ]; then
    resolved_pkg="$(realpath "$pkg_path")"
    if package_dir_has_payload "$resolved_pkg"; then
      printf '%s\n' "$resolved_pkg"
      return 0
    fi

    if [[ "$resolved_pkg" == *"/node_modules/.pnpm/"*"/node_modules/"* ]]; then
      after_pnpm="${resolved_pkg#*"/node_modules/.pnpm/"}"
      version_dir="${after_pnpm%%/node_modules/*}"
      rel_pkg_path="${after_pnpm#"$version_dir/node_modules/"}"
      monorepo_candidate="$MONOREPO_ROOT/node_modules/.pnpm/$version_dir/node_modules/$rel_pkg_path"
      if [ -d "$monorepo_candidate" ] && package_dir_has_payload "$monorepo_candidate"; then
        printf '%s\n' "$monorepo_candidate"
        return 0
      fi
    fi
  fi

  pkg_name="$(basename "$pkg_path")"
  pkg_dir="$(dirname "$pkg_path")"

  if [[ "$(basename "$pkg_dir")" == @* ]]; then
    fallback="$(find "$RUNTIME_ROOT/node_modules/.pnpm" -path "*/node_modules/$(basename "$pkg_dir")/$pkg_name" -type d -print -quit)"
  else
    fallback="$(find "$RUNTIME_ROOT/node_modules/.pnpm" -path "*/node_modules/$pkg_name" -type d -print -quit)"
  fi

  if [ -n "$fallback" ]; then
    printf '%s\n' "$fallback"
    return 0
  fi

  return 1
}

PNPM_MODULES="$RUNTIME_ROOT/node_modules/.pnpm/node_modules"
if [ -d "$PNPM_MODULES" ]; then
  echo "[build-sidecar] Hoisting pnpm dependencies..."
  for pkg in "$PNPM_MODULES"/*; do
    [ -e "$pkg" ] || continue
    name=$(basename "$pkg")
    dest="$RUNTIME_ROOT/node_modules/$name"
    if [ -L "$dest" ]; then
      rm -f "$dest"
    fi
    if [ ! -e "$dest" ]; then
      if resolved_pkg="$(resolve_pnpm_package_dir "$pkg")"; then
        cp -R "$resolved_pkg" "$dest"
      else
        echo "[build-sidecar] Skipping unresolved package: $name"
      fi
    fi
  done
  # Handle scoped packages (@org/name)
  for scope in "$PNPM_MODULES"/@*; do
    [ -d "$scope" ] || continue
    scope_name=$(basename "$scope")
    mkdir -p "$RUNTIME_ROOT/node_modules/$scope_name"
    for pkg in "$scope"/*; do
      [ -e "$pkg" ] || continue
      name=$(basename "$pkg")
      dest="$RUNTIME_ROOT/node_modules/$scope_name/$name"
      if [ -L "$dest" ]; then
        rm -f "$dest"
      fi
      if [ ! -e "$dest" ]; then
        if resolved_pkg="$(resolve_pnpm_package_dir "$pkg")"; then
          cp -R "$resolved_pkg" "$dest"
        else
          echo "[build-sidecar] Skipping unresolved package: $scope_name/$name"
        fi
      fi
    done
  done
fi

# Materialize any remaining symlinks outside the pnpm store so the Tauri
# resource packager only sees self-contained files and directories.
while IFS= read -r link; do
  [ -n "$link" ] || continue
  resolved_link="$(realpath "$link")"
  rm -f "$link"

  if [ -d "$resolved_link" ]; then
    cp -R "$resolved_link" "$link"
  else
    cp -L "$resolved_link" "$link"
  fi
done < <(find "$RUNTIME_ROOT" -type l ! -path "*/.pnpm/*" -print)

# Step 5: Create the launcher script (runs inside the bundled Node.js)
write_launcher() {
  local archive_id="$1"

  rm -rf "$LAUNCHER_DIR"
  mkdir -p "$LAUNCHER_DIR"
  cat > "$LAUNCHER_DIR/launcher.mjs" <<'LAUNCHER_EOF'
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const resourceRoot = process.env.TAURI_RESOURCE_DIR || join(__dirname, "..");
const archivePath = join(resourceRoot, "__RUNTIME_ARCHIVE_NAME__");
const archiveId = "__RUNTIME_ARCHIVE_ID__";

// Self-terminate if the parent (the Tauri desktop app) dies. macOS has no
// PR_SET_PDEATHSIG, so a bare Node sidecar would otherwise linger as an orphan
// — holding its port and a stray dock tile — until the next launch's reaper
// cleans it up. The app kills us on a clean quit; this covers crashes, Force
// Quit, and the app bundle being replaced while running.
const parentPid = process.ppid;
setInterval(() => {
  // When the parent exits, we're reparented (ppid changes, typically to 1).
  if (process.ppid !== parentPid) {
    process.stderr.write("[sidecar] Parent process exited — shutting down\n");
    process.exit(0);
  }
}, 1000).unref();

async function getPort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

function waitForReady(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode < 500) resolve();
        else retry();
      });
      req.on("error", retry);
      req.setTimeout(1000, () => { req.destroy(); retry(); });
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Server not ready within ${timeoutMs}ms`));
      } else {
        setTimeout(check, 200);
      }
    };
    check();
  });
}

const port = process.env.PORT ? Number(process.env.PORT) : await getPort();

// Desktop app data directory — user-writable, persists across updates
const os = await import("node:os");
const fs = await import("node:fs");
const dataDir = join(process.env.HOME || os.homedir(), "Library", "Application Support", "__RADARBOARD_DATA_DIR_NAME__");
fs.mkdirSync(dataDir, { recursive: true });

const runtimeBaseDir = join(dataDir, "standalone-runtime");
const runtimeDir = join(runtimeBaseDir, archiveId);
const readyFile = join(runtimeDir, ".ready");

function extractRuntime() {
  if (fs.existsSync(readyFile)) return;

  if (!fs.existsSync(archivePath)) {
    throw new Error(`Runtime archive not found: ${archivePath}`);
  }

  fs.rmSync(runtimeDir, { recursive: true, force: true });
  fs.mkdirSync(runtimeBaseDir, { recursive: true });
  const tempDir = fs.mkdtempSync(join(runtimeBaseDir, `${archiveId}.tmp-`));
  const tarBinary = process.platform === "darwin" ? "/usr/bin/tar" : "tar";
  const result = spawnSync(tarBinary, ["-xzf", archivePath, "-C", tempDir], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`Failed to extract runtime archive${details ? `:\n${details}` : ""}`);
  }

  fs.renameSync(tempDir, runtimeDir);
  fs.writeFileSync(readyFile, new Date().toISOString());
}

extractRuntime();

const serverDir = join(runtimeDir, "apps", "app");
const serverJs = join(serverDir, "server.js");

process.env.PORT = String(port);
process.env.HOSTNAME = "127.0.0.1";
process.env.NODE_ENV = "production";
process.env.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${port}`;
// Use the user's data directory for SQLite so it persists across app updates
process.env.RADARBOARD_DATA_DIR = dataDir;
// Desktop apps need a local encryption key for credential storage
// Generate a per-installation key and persist it
const crypto = await import("node:crypto");
const keyFile = join(dataDir, ".encryption-key");
if (!fs.existsSync(keyFile)) {
  fs.writeFileSync(keyFile, crypto.randomBytes(32).toString("hex"), { mode: 0o600 });
}
process.env.ENCRYPTION_KEY = fs.readFileSync(keyFile, "utf8").trim();
// Plugin token signing also needs a local persistent secret in desktop builds.
const apiSecretFile = join(dataDir, ".api-secret");
if (!fs.existsSync(apiSecretFile)) {
  fs.writeFileSync(apiSecretFile, crypto.randomBytes(32).toString("hex"), { mode: 0o600 });
}
process.env.RADARBOARD_API_SECRET = fs.readFileSync(apiSecretFile, "utf8").trim();

process.stderr.write(`[sidecar] Starting Next.js on port ${port}\n`);
process.stderr.write(`[sidecar] Server: ${serverJs}\n`);

// Redirect stdout and console.log to stderr while loading server.js —
// Next.js prints its banner to stdout which would corrupt the URL
// protocol line that Rust reads.
const _realWrite = process.stdout.write.bind(process.stdout);
const _realLog = console.log.bind(console);
process.stdout.write = (chunk, ...args) => process.stderr.write(chunk, ...args);
console.log = (...args) => console.error(...args);

await import(serverJs);

// server.js does process.chdir(__dirname) which points to the read-only
// .app bundle. Override to the writable data directory so SQLite, config
// file writes, and other I/O land in the right place.
process.chdir(dataDir);
process.stderr.write(`[sidecar] Data dir: ${dataDir}\n`);

const url = `http://127.0.0.1:${port}`;
await waitForReady(url);

// Restore stdout AFTER server is fully ready and banner is printed
process.stdout.write = _realWrite;
console.log = _realLog;

process.stdout.write(url + "\n");
process.stderr.write(`[sidecar] Server ready at ${url}\n`);
LAUNCHER_EOF

  perl -0pi -e 's/__RADARBOARD_DATA_DIR_NAME__/\Q'"$DATA_DIR_NAME"'\E/g' "$LAUNCHER_DIR/launcher.mjs"
  perl -0pi -e 's/__RUNTIME_ARCHIVE_NAME__/\Q'"$RUNTIME_ARCHIVE_NAME"'\E/g' "$LAUNCHER_DIR/launcher.mjs"
  perl -0pi -e 's/__RUNTIME_ARCHIVE_ID__/\Q'"$archive_id"'\E/g' "$LAUNCHER_DIR/launcher.mjs"
}

write_launcher "pending"

# Step 6: Reduce bundle size — strip unnecessary files from node_modules
echo "[build-sidecar] Stripping unnecessary files from resources..."
find "$RUNTIME_ROOT" -type f \( \
  -name "*.md" -o -name "*.MD" -o \
  -name "*.txt" -o -name "*.map" -o \
  -name "*.ts" ! -name "*.d.ts" -o \
  -name "CHANGELOG*" -o -name "HISTORY*" -o \
  -name "LICENSE*" -o -name "LICENCE*" -o \
  -name "AUTHORS*" -o -name "CONTRIBUTORS*" -o \
  -name ".npmignore" -o -name ".eslintrc*" -o \
  -name ".prettierrc*" -o -name ".babelrc*" -o \
  -name "tsconfig.json" -o -name "jest.config*" -o \
  -name "*.test.js" -o -name "*.spec.js" -o \
  -name "Makefile" -o -name "Gruntfile*" -o \
  -name "Gulpfile*" -o -name ".travis.yml" -o \
  -name "appveyor.yml" -o -name ".github" \
\) -delete 2>/dev/null
# Remove empty directories
find "$RUNTIME_ROOT" -type d -empty -delete 2>/dev/null
# Remove .pnpm store (already hoisted)
rm -rf "$RUNTIME_ROOT/node_modules/.pnpm"

echo "[build-sidecar] Verifying standalone bundle..."
node "$SCRIPT_DIR/verify-sidecar-bundle.mjs" "$RUNTIME_ROOT"

if [[ "$(uname -s)" == "Darwin" && -n "${APPLE_SIGNING_IDENTITY:-}" ]]; then
  echo "[build-sidecar] Signing native resource binaries..."
  native_binary_count=0
  signed_native_binary_count=0

  while IFS= read -r -d '' native_binary; do
    if file "$native_binary" | grep -q "Mach-O"; then
      native_binary_count=$((native_binary_count + 1))
      codesign \
        --force \
        --options runtime \
        --timestamp \
        --sign "$APPLE_SIGNING_IDENTITY" \
        "$native_binary"
      signed_native_binary_count=$((signed_native_binary_count + 1))
    fi
  done < <(find "$RUNTIME_ROOT" -type f \( -name "*.node" -o -name "*.dylib" \) -print0)

  echo "[build-sidecar] Signed $signed_native_binary_count native resource binaries"
  if [[ "$native_binary_count" -eq 0 ]]; then
    echo "[build-sidecar] No Mach-O native resource binaries found"
  fi
elif [[ "$(uname -s)" == "Darwin" ]]; then
  echo "[build-sidecar] Skipping native resource signing; APPLE_SIGNING_IDENTITY is not set"
else
  echo "[build-sidecar] Skipping native resource signing on non-macOS host"
fi

echo "[build-sidecar] Archiving standalone runtime..."
COPYFILE_DISABLE=1 tar -czf "$RUNTIME_ARCHIVE" -C "$RUNTIME_ROOT" .
RUNTIME_ARCHIVE_ID="$(shasum -a 256 "$RUNTIME_ARCHIVE" | awk '{print $1}')"
write_launcher "$RUNTIME_ARCHIVE_ID"
rm -rf "$RUNTIME_ROOT"

echo "[build-sidecar] Resources: $(du -sh "$RESOURCES" | cut -f1)"
echo "[build-sidecar] Runtime archive: $RUNTIME_ARCHIVE_ID"
echo "[build-sidecar] Done"
