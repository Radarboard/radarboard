import type { CliOptions, LogPaths, RunRecord, TailOptions } from "./types";

const MILLISECONDS_AT_END = /\.\d{3}Z$/;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")
    .slice(0, 48);
}

function getRunId(now: Date): string {
  return now.toISOString().replaceAll(":", "-").replace(MILLISECONDS_AT_END, "Z");
}

/** Derive a short key for file naming from the command or explicit name. */
export function getLogKey(options: Pick<CliOptions, "command" | "name">): string {
  return options.name ?? (slugify(options.command.join("-")) || "latest");
}

/** Compute all output file paths for a capture run. */
export function getLogPaths(options: CliOptions, now = new Date()): LogPaths {
  const key = getLogKey(options);
  const historyPrefix = `${options.outDir}/${key}.${getRunId(now)}`;
  const latestPrefix = `${options.outDir}/latest`;
  const namedPrefix = `${options.outDir}/${key}`;

  const rawPaths = buildPaths(
    [latestPrefix, namedPrefix],
    historyPrefix,
    options.history,
    options.writeRaw,
    ".raw.log"
  );

  const textPaths = buildPaths(
    [latestPrefix, namedPrefix],
    historyPrefix,
    options.history,
    options.writeText,
    ".txt"
  );

  return { key, rawPaths, textPaths };
}

function buildPaths(
  prefixes: string[],
  historyPrefix: string,
  history: boolean,
  enabled: boolean,
  suffix: string
): string[] {
  if (!enabled) return [];

  const paths = prefixes.map((p) => `${p}${suffix}`);
  if (history) {
    paths.push(`${historyPrefix}${suffix}`);
  }

  return [...new Set(paths)];
}

/** Path to the run index file. */
export function getRunIndexPath(outDir: string): string {
  return `${outDir}/runs.jsonl`;
}

/** Build the latest-log path for tail resolution. */
export function getLatestLogPath(options: TailOptions): string {
  const name = options.query ?? "latest";
  const suffix = options.raw ? ".raw.log" : ".txt";
  return `${options.outDir}/${name}${suffix}`;
}

/** Create a RunRecord for the current capture session. */
export function buildRunRecord(options: CliOptions, paths: LogPaths, now = new Date()): RunRecord {
  return {
    command: options.command.join(" "),
    key: paths.key,
    name: options.name,
    outDir: options.outDir,
    rawPath: `${options.outDir}/${paths.key}.raw.log`,
    textPath: `${options.outDir}/${paths.key}.txt`,
    startedAt: now.toISOString(),
  };
}

/** Find the most recent run matching a query string. */
export function findMatchingRun(
  records: RunRecord[],
  query: string | undefined
): RunRecord | undefined {
  if (!query) {
    return records.at(-1);
  }

  const normalized = query.toLowerCase();
  return [...records]
    .reverse()
    .find((record) =>
      [record.name, record.command, record.key].some((value) =>
        value?.toLowerCase().includes(normalized)
      )
    );
}
