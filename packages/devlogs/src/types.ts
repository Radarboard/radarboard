/** Options for the "run" subcommand (default mode). */
export interface CliOptions {
  command: string[];
  history: boolean;
  name?: string;
  outDir: string;
  printPaths: boolean;
  writeRaw: boolean;
  writeText: boolean;
}

/** Options for the "tail" subcommand. */
export interface TailOptions {
  outDir: string;
  query?: string;
  raw: boolean;
  tailArgs: string[];
}

/** Union of parsed CLI arguments. */
export type ParsedArgs =
  | { kind: "run"; options: CliOptions }
  | { kind: "tail"; options: TailOptions };

/** A record stored in runs.jsonl tracking each captured run. */
export interface RunRecord {
  command: string;
  key: string;
  name?: string;
  outDir: string;
  rawPath: string;
  textPath: string;
  startedAt: string;
}

/** Resolved file paths for a capture run. */
export interface LogPaths {
  key: string;
  rawPaths: string[];
  textPaths: string[];
}
