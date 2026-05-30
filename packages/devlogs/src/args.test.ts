import { describe, expect, it } from "vitest";
import { parseArgs } from "./args";

describe("parseArgs", () => {
  it("parses run arguments with explicit output controls", () => {
    const parsed = parseArgs([
      "--out-dir",
      "tmp/logs",
      "--name",
      "smoke",
      "--text-only",
      "--print-paths",
      "pnpm",
      "test",
    ]);

    expect(parsed).toEqual({
      kind: "run",
      options: {
        command: ["pnpm", "test"],
        history: true,
        name: "smoke",
        outDir: "tmp/logs",
        printPaths: true,
        writeRaw: false,
        writeText: true,
      },
    });
  });

  it("rejects disabling both raw and text outputs", () => {
    expect(() => parseArgs(["--raw-only", "--text-only", "pnpm", "test"])).toThrowError(
      "At least one log output must be enabled."
    );
  });

  it("parses tail queries and passes through trailing tail arguments", () => {
    const parsed = parseArgs(["tail", "--out-dir", "tmp/logs", "--raw", "build", "--", "-f"]);

    expect(parsed).toEqual({
      kind: "tail",
      options: {
        outDir: "tmp/logs",
        query: "build",
        raw: true,
        tailArgs: ["-f"],
      },
    });
  });
});
