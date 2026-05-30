import type { CliOptions, ParsedArgs, TailOptions } from "./types";

const USAGE =
  "Usage: devlogs [--out-dir <path>] [--name <name>] [--raw-only|--text-only] [--no-history] [--print-paths] [--] <command...>";
const TAIL_USAGE = "Usage: devlogs tail [--out-dir <path>] [--raw] [query] [--] [tail args...]";

function fail(message: string, code = 1): never {
  throw Object.assign(new Error(message), { code });
}

function parseCliArgs(argv: string[]): CliOptions {
  let history = true;
  let outDir = ".devlogs";
  let name: string | undefined;
  let printPaths = false;
  let writeRaw = true;
  let writeText = true;
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--") {
      i += 1;
      break;
    }
    if (!arg?.startsWith("-") || arg === "-") {
      break;
    }

    switch (arg) {
      case "--out-dir":
        outDir = argv[i + 1] ?? fail(`Missing value for ${arg}`);
        i += 2;
        continue;
      case "--name":
        name = argv[i + 1] ?? fail(`Missing value for ${arg}`);
        i += 2;
        continue;
      case "--raw-only":
        writeText = false;
        i += 1;
        continue;
      case "--text-only":
        writeRaw = false;
        i += 1;
        continue;
      case "--no-history":
        history = false;
        i += 1;
        continue;
      case "--print-paths":
        printPaths = true;
        i += 1;
        continue;
      case "--help":
      case "-h":
        return fail(USAGE, 0);
      default:
        fail(`Unknown option: ${arg}\n${USAGE}`);
    }
  }

  if (!(writeRaw || writeText)) {
    fail("At least one log output must be enabled.");
  }

  const command = argv.slice(i);
  if (command.length === 0) {
    fail(USAGE);
  }

  return { command, history, name, outDir, printPaths, writeRaw, writeText };
}

function parseTailArgs(argv: string[]): TailOptions {
  let outDir = ".devlogs";
  let query: string | undefined;
  let raw = false;
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--") {
      i += 1;
      break;
    }
    if (!arg?.startsWith("-") || arg === "-") {
      break;
    }

    switch (arg) {
      case "--out-dir":
        outDir = argv[i + 1] ?? fail(`Missing value for ${arg}`);
        i += 2;
        continue;
      case "--raw":
        raw = true;
        i += 1;
        continue;
      case "--help":
      case "-h":
        return fail(TAIL_USAGE, 0);
      default:
        return { outDir, query, raw, tailArgs: argv.slice(i) };
    }
  }

  const nextArg = argv[i];
  if (nextArg && !nextArg.startsWith("-")) {
    query = nextArg;
    i += 1;
  }

  if (argv[i] === "--") {
    i += 1;
  }

  return { outDir, query, raw, tailArgs: argv.slice(i) };
}

/** Parse CLI arguments into a structured command. */
export function parseArgs(argv: string[]): ParsedArgs {
  if (argv[0] === "tail") {
    return { kind: "tail", options: parseTailArgs(argv.slice(1)) };
  }

  return { kind: "run", options: parseCliArgs(argv) };
}
