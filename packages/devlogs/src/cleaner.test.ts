import { describe, expect, it } from "vitest";
import { cleanChunk, cleanLogText } from "./cleaner";

describe("devlogs cleaner", () => {
  it("strips ANSI control sequences and normalizes chunk line endings", () => {
    const cleaned = cleanChunk(Buffer.from("\u001B[31mhello\r\nworld\u001B[0m\r"));

    expect(cleaned).toBe("hello\nworld\n");
  });

  it("normalizes full log text to LF", () => {
    expect(cleanLogText("line one\rline two\r\nline three")).toBe("line one\nline two\nline three");
  });
});
