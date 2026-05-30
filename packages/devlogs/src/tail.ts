import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { findMatchingRun, getLatestLogPath, getRunIndexPath } from "./paths";
import type { RunRecord, TailOptions } from "./types";

/** Load all past run records from the runs.jsonl index. */
async function loadRunRecords(outDir: string): Promise<RunRecord[]> {
  const path = getRunIndexPath(outDir);
  try {
    const text = await readFile(path, "utf-8");
    const lines = text.trim().split("\n").filter(Boolean);
    return lines.map((line) => JSON.parse(line) as RunRecord);
  } catch {
    return [];
  }
}

/** Resolve which log file to tail based on options. */
async function resolveTailPath(options: TailOptions): Promise<string> {
  if (!options.query) {
    return getLatestLogPath(options);
  }

  const records = await loadRunRecords(options.outDir);
  const match = findMatchingRun(records, options.query);

  if (match) {
    return options.raw ? match.rawPath : match.textPath;
  }

  return getLatestLogPath(options);
}

/** Run the tail subcommand: find the matching log file and delegate to system tail. */
export async function runTail(options: TailOptions): Promise<number> {
  const path = await resolveTailPath(options);

  try {
    await access(path);
  } catch {
    const detail = options.query
      ? `No log found for "${options.query}" in ${options.outDir}. Run your command with "devlogs <command>" first.`
      : `No log found at ${path}. Run your command with "devlogs <command>" first, or pass --out-dir if your logs live elsewhere.`;

    throw Object.assign(new Error(detail), { code: 1 });
  }

  const child = spawn("tail", [...options.tailArgs, path], {
    stdio: "inherit",
  });

  return new Promise<number>((resolve) => {
    child.on("exit", (code) => resolve(code ?? 1));
  });
}
