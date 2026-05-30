import { afterEach, beforeEach, vi } from "vitest";

type ConsoleCall = {
  level: "warn" | "error";
  message: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __RADARBOARD_ALLOW_CONSOLE__: boolean | undefined;
}

let consoleCalls: ConsoleCall[] = [];

function stringifyConsoleArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;

  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function formatConsoleMessage(args: unknown[]): string {
  return args.map((arg) => stringifyConsoleArg(arg)).join(" ");
}

beforeEach(() => {
  consoleCalls = [];

  vi.spyOn(console, "warn").mockImplementation((...args: Parameters<typeof console.warn>) => {
    consoleCalls.push({
      level: "warn",
      message: formatConsoleMessage(args),
    });
  });

  vi.spyOn(console, "error").mockImplementation((...args: Parameters<typeof console.error>) => {
    consoleCalls.push({
      level: "error",
      message: formatConsoleMessage(args),
    });
  });
});

afterEach(() => {
  if (globalThis.__RADARBOARD_ALLOW_CONSOLE__ === true) {
    consoleCalls = [];
    return;
  }

  if (consoleCalls.length === 0) return;

  const formatted = consoleCalls
    .map((entry, index) => `${index + 1}. [${entry.level}] ${entry.message}`)
    .join("\n");

  throw new Error(`Unexpected console output during test:\n${formatted}`);
});
