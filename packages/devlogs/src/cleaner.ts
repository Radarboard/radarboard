import { stripVTControlCharacters } from "node:util";

/** Normalize line endings to LF. */
function normalizeLineEndings(text: string): string {
  return text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

/** Strip ANSI/VT control characters and normalize line endings from a chunk. */
export function cleanChunk(chunk: Buffer): string {
  return normalizeLineEndings(stripVTControlCharacters(chunk.toString()));
}

/** Strip ANSI/VT control characters and normalize line endings from full text. */
export function cleanLogText(text: string): string {
  return normalizeLineEndings(stripVTControlCharacters(text));
}
