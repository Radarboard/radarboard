#!/usr/bin/env tsx

import process from "node:process";
import { parseArgs } from "./args";
import { runCommand } from "./runner";
import { runTail } from "./tail";

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.kind === "tail") {
    return runTail(parsed.options);
  }

  return runCommand(parsed.options);
}

try {
  const code = await main();
  process.exit(code);
} catch (error) {
  const exitCode =
    typeof error === "object" && error !== null && "code" in error && typeof error.code === "number"
      ? error.code
      : 1;

  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(exitCode);
}
