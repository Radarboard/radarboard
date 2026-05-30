import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

type TauriDesktopConfig = {
  identifier?: string;
  bundle?: {
    macOS?: {
      minimumSystemVersion?: string;
    };
  };
};

const rootDir = process.cwd();
const tauriConfigPath = path.join(rootDir, "apps", "desktop", "src-tauri", "tauri.conf.json");
const defaultRepo = process.env.GITHUB_REPOSITORY ?? "Radarboard/radarboard";
const releaseChannels = ["stable", "beta"] as const;
type ReleaseChannel = (typeof releaseChannels)[number];

function parseArg(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

function requireArg(flag: string): string {
  const value = parseArg(flag);
  if (!value) {
    throw new Error(`Expected ${flag} <value>`);
  }

  return value;
}

function parseReleaseChannel(value: string | null): ReleaseChannel {
  if (!value) {
    return "stable";
  }

  if (releaseChannels.includes(value as ReleaseChannel)) {
    return value as ReleaseChannel;
  }

  throw new Error(`Unsupported Homebrew release channel: ${value}`);
}

export function versionToMacosSymbol(version: string): string {
  const major = Number.parseInt(version.split(".")[0] ?? "", 10);
  const map = new Map<number, string>([
    [12, "monterey"],
    [13, "ventura"],
    [14, "sonoma"],
    [15, "sequoia"],
  ]);

  const symbol = map.get(major);
  if (!symbol) {
    throw new Error(`Unsupported macOS minimumSystemVersion: ${version}`);
  }

  return symbol;
}

function readDesktopConfig(): Required<TauriDesktopConfig> {
  const parsed = JSON.parse(readFileSync(tauriConfigPath, "utf8")) as TauriDesktopConfig;
  const minimumSystemVersion = parsed.bundle?.macOS?.minimumSystemVersion;
  const identifier = parsed.identifier;

  if (!minimumSystemVersion) {
    throw new Error(`Missing bundle.macOS.minimumSystemVersion in ${tauriConfigPath}`);
  }

  if (!identifier) {
    throw new Error(`Missing identifier in ${tauriConfigPath}`);
  }

  return {
    identifier,
    bundle: {
      macOS: {
        minimumSystemVersion,
      },
    },
  };
}

export function buildCask({
  version,
  sha256,
  repo,
  downloadRepo = repo,
  minimumSystemVersion,
  identifier,
  channel = "stable",
  caskName = channel === "beta" ? "radarboard-beta" : "radarboard",
}: {
  version: string;
  sha256: string;
  repo: string;
  downloadRepo?: string;
  minimumSystemVersion: string;
  identifier: string;
  channel?: ReleaseChannel;
  caskName?: string;
}) {
  const macosSymbol = versionToMacosSymbol(minimumSystemVersion);
  const displayName = channel === "beta" ? "Radarboard Beta" : "Radarboard";
  const conflictsWith = channel === "beta" ? "radarboard" : "radarboard-beta";
  const livecheck =
    channel === "beta"
      ? `  livecheck do
    url "https://github.com/${downloadRepo}/releases"
    regex(/^desktop-v(\\d+(?:\\.\\d+){2}-beta\\.\\d+)$/i)
  end`
      : `  livecheck do
    url "https://github.com/${downloadRepo}/releases"
    regex(/^desktop-v(\\d+(?:\\.\\d+){2})$/i)
    strategy :github_latest
  end`;

  return `cask "${caskName}" do
  arch arm: "aarch64"

  version "${version}"
  sha256 "${sha256}"

  url "https://github.com/${downloadRepo}/releases/download/desktop-v#{version}/Radarboard-#{version}-macos-#{arch}.dmg",
      verified: "github.com/${downloadRepo}/"
  name "${displayName}"
  desc "Local-first desktop board for code, ops, and growth signals"
  homepage "https://radarboard.app"

${livecheck}

  auto_updates true
  conflicts_with cask: "${conflictsWith}"
  depends_on macos: ">= :${macosSymbol}"

  app "Radarboard.app"

  zap trash: [
    "~/Library/Application Support/Radarboard",
    "~/Library/Application Support/${identifier}",
    "~/Library/Caches/${identifier}",
    "~/Library/HTTPStorages/${identifier}",
    "~/Library/LaunchAgents/${identifier}.plist",
    "~/Library/Logs/${identifier}",
    "~/Library/Preferences/${identifier}.plist",
    "~/Library/Saved Application State/${identifier}.savedState",
    "~/Library/WebKit/${identifier}",
  ]
end
`;
}

function main() {
  const version = requireArg("--version");
  const sha256 = requireArg("--sha256");
  const repo = parseArg("--repo") ?? defaultRepo;
  const downloadRepo = parseArg("--download-repo") ?? repo;
  const channel = parseReleaseChannel(parseArg("--channel"));
  const caskName = parseArg("--cask-name") ?? (channel === "beta" ? "radarboard-beta" : "radarboard");
  const outputPath = path.resolve(
    rootDir,
    parseArg("--output") ?? path.join(rootDir, "packaging", "homebrew", "Casks", `${caskName}.rb`)
  );
  const config = readDesktopConfig();
  const caskContents = buildCask({
    version,
    sha256,
    repo,
    downloadRepo,
    minimumSystemVersion: config.bundle.macOS.minimumSystemVersion,
    identifier: config.identifier,
    channel,
    caskName,
  });

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, caskContents);
  console.log(`generated homebrew cask: ${path.relative(rootDir, outputPath)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
