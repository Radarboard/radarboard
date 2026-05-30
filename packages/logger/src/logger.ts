import type { LogEntry, LogLevel } from "@radarboard/types/logs";
import { logBuffer } from "./log-buffer";

/** Numeric values for level comparison. Higher = more severe. */
const LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

let currentLevel: LogLevel = "debug";
let idCounter = 0;

/** Set the minimum log level. Entries below this level are silently dropped. */
export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

/** Get the current minimum log level. */
export function getLogLevel(): LogLevel {
  return currentLevel;
}

function generateId(): string {
  idCounter += 1;
  return `${Date.now()}-${String(idCounter)}`;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_VALUES[level] >= LEVEL_VALUES[currentLevel];
}

function writeToStdout(line: string): void {
  if (typeof process !== "undefined" && process.stdout?.write) {
    process.stdout.write(`${line}\n`);
  }
}

/** Observer function called for every log entry. */
export type LogObserver = (entry: LogEntry) => void;

const observers: LogObserver[] = [];

/**
 * Register a global log observer.
 *
 * This allows external systems (like the debug events database or Sentry)
 * to react to log entries without the logger package depending on them.
 */
export function addLogObserver(observer: LogObserver): void {
  observers.push(observer);
}

function writeLog(entry: LogEntry): void {
  // Write ndjson to stdout (captured by devlogs CLI to files)
  writeToStdout(JSON.stringify(entry));

  // Push to in-memory ring buffer (read by /api/logs for dashboard widget)
  logBuffer.push(entry);

  // Notify observers (e.g. for centralized error reporting)
  for (const observer of observers) {
    try {
      observer(entry);
    } catch {
      // Observers must not crash the logger
    }
  }
}

/** Structured logger interface. */
export interface Logger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

/**
 * Create a named logger instance.
 *
 * Each logger produces structured JSON entries written to stdout (for devlogs
 * file capture) and pushed to the in-memory ring buffer (for the dashboard
 * logs widget).
 *
 * @param name - Source identifier (e.g. "api/revenue", "cache", "revenuecat")
 */
export function createLogger(name: string): Logger {
  function log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    if (!shouldLog(level)) return;

    const entry: LogEntry = {
      id: generateId(),
      timestamp: Date.now(),
      level,
      source: name,
      message,
      metadata,
    };

    writeLog(entry);
  }

  return {
    debug: (message, metadata) => log("debug", message, metadata),
    info: (message, metadata) => log("info", message, metadata),
    warn: (message, metadata) => log("warn", message, metadata),
    error: (message, metadata) => log("error", message, metadata),
  };
}
