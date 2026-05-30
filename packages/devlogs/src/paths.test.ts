import { describe, expect, it } from "vitest";
import { buildRunRecord, findMatchingRun, getLatestLogPath, getLogKey, getLogPaths } from "./paths";

describe("devlogs paths", () => {
  it("builds stable log paths for latest, named, and history outputs", () => {
    const paths = getLogPaths(
      {
        command: ["pnpm", "test"],
        history: true,
        outDir: ".devlogs",
        printPaths: false,
        writeRaw: true,
        writeText: true,
      },
      new Date("2026-03-27T10:00:00.000Z")
    );

    expect(getLogKey({ command: ["pnpm", "test"], name: undefined })).toBe("pnpm-test");
    expect(paths.rawPaths).toEqual([
      ".devlogs/latest.raw.log",
      ".devlogs/pnpm-test.raw.log",
      ".devlogs/pnpm-test.2026-03-27T10-00-00Z.raw.log",
    ]);
    expect(paths.textPaths).toEqual([
      ".devlogs/latest.txt",
      ".devlogs/pnpm-test.txt",
      ".devlogs/pnpm-test.2026-03-27T10-00-00Z.txt",
    ]);
  });

  it("builds run records and resolves the latest matching run", () => {
    const paths = getLogPaths(
      {
        command: ["pnpm", "lint"],
        history: false,
        name: "quality-check",
        outDir: ".devlogs",
        printPaths: false,
        writeRaw: true,
        writeText: true,
      },
      new Date("2026-03-27T11:00:00.000Z")
    );
    const record = buildRunRecord(
      {
        command: ["pnpm", "lint"],
        history: false,
        name: "quality-check",
        outDir: ".devlogs",
        printPaths: false,
        writeRaw: true,
        writeText: true,
      },
      paths,
      new Date("2026-03-27T11:00:00.000Z")
    );

    expect(record).toMatchObject({
      command: "pnpm lint",
      key: "quality-check",
      rawPath: ".devlogs/quality-check.raw.log",
      textPath: ".devlogs/quality-check.txt",
    });
    expect(
      findMatchingRun(
        [
          {
            ...record,
            key: "old",
            command: "pnpm test",
          },
          record,
        ],
        "lint"
      )
    ).toEqual(record);
    expect(getLatestLogPath({ outDir: ".devlogs", raw: false, tailArgs: [] })).toBe(
      ".devlogs/latest.txt"
    );
  });
});
