import { spawn } from "node:child_process";
import { createWriteStream, type WriteStream } from "node:fs";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { finished } from "node:stream/promises";
import { cleanChunk, cleanLogText } from "./cleaner";
import { buildRunRecord, getLogPaths, getRunIndexPath } from "./paths";
import type { CliOptions } from "./types";

/** Run a command, capturing its output to log files while mirroring to the terminal. */
export async function runCommand(options: CliOptions): Promise<number> {
  const paths = getLogPaths(options);
  const record = buildRunRecord(options, paths);

  await mkdir(options.outDir, { recursive: true });

  // Truncate all output files
  const allPaths = [...new Set([...paths.rawPaths, ...paths.textPaths])];
  await Promise.all(allPaths.map((p) => appendFile(p, "", { flag: "w" })));

  // Append run record to index
  await appendFile(getRunIndexPath(record.outDir), `${JSON.stringify(record)}\n`);

  const rawStreams = paths.rawPaths.map((p) => createWriteStream(p));
  const textStreams = paths.textPaths.map((p) => createWriteStream(p));

  if (options.printPaths) {
    for (const p of [...paths.rawPaths, ...paths.textPaths]) {
      process.stderr.write(`devlogs: ${p}\n`);
    }
  }

  const firstCommand = options.command[0];
  if (!firstCommand) {
    throw new Error("No command specified");
  }

  const childEnv = { ...process.env, FORCE_COLOR: "1" };
  const child = spawn(firstCommand, options.command.slice(1), {
    stdio: ["inherit", "pipe", "pipe"],
    env: childEnv,
  });

  const writeToStreams = (chunk: Buffer, target: "stdout" | "stderr") => {
    // Mirror to terminal
    if (target === "stdout") {
      process.stdout.write(chunk);
    } else {
      process.stderr.write(chunk);
    }

    // Write raw
    for (const stream of rawStreams) {
      stream.write(chunk);
    }

    // Write cleaned text
    const cleaned = cleanChunk(chunk);
    if (cleaned) {
      for (const stream of textStreams) {
        stream.write(cleaned);
      }
    }
  };

  child.stdout?.on("data", (chunk: Buffer) => writeToStreams(chunk, "stdout"));
  child.stderr?.on("data", (chunk: Buffer) => writeToStreams(chunk, "stderr"));

  // Forward signals to child
  const signalHandlers: Array<[string, () => void]> = [];
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    const handler = () => {
      if (!child.killed) {
        child.kill(sig as NodeJS.Signals);
      }
    };
    process.on(sig, handler);
    signalHandlers.push([sig, handler]);
  }

  try {
    const code = await new Promise<number>((resolve) => {
      child.on("exit", (exitCode) => resolve(exitCode ?? 1));
    });
    return code;
  } finally {
    // Clean up signal handlers
    for (const [sig, handler] of signalHandlers) {
      process.removeListener(sig, handler);
    }

    // Close all streams
    const allStreams: WriteStream[] = [...rawStreams, ...textStreams];
    for (const stream of allStreams) {
      stream.end();
    }
    await Promise.all(allStreams.map((s) => finished(s)));

    // Re-clean text logs from raw capture for accuracy
    await rewriteTextLogs(paths.rawPaths, paths.textPaths);
  }
}

/** Re-read raw logs and write properly cleaned text logs (handles incomplete chunks). */
async function rewriteTextLogs(rawPaths: string[], textPaths: string[]): Promise<void> {
  if (textPaths.length === 0 || rawPaths.length === 0) return;

  const firstRawPath = rawPaths[0];
  if (!firstRawPath) return;

  try {
    const raw = await readFile(firstRawPath, "utf-8");
    const cleaned = cleanLogText(raw);
    await Promise.all(
      textPaths.map(async (p) => {
        const { writeFile } = await import("node:fs/promises");
        return writeFile(p, cleaned);
      })
    );
  } catch {
    // If raw file doesn't exist or is empty, skip
  }
}
