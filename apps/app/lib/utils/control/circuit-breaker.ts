/**
 * Circuit breaker for outbound API calls.
 *
 * Tracks consecutive failures per key. After `threshold` failures, the
 * circuit opens and `withCircuitBreaker` short-circuits with a
 * `CircuitOpenError` for an exponentially increasing cooldown period.
 * On success, the circuit resets.
 *
 * States:
 * - CLOSED: requests pass through normally
 * - OPEN: requests short-circuit (cooldown period active)
 * - HALF_OPEN: cooldown expired, next request is a probe
 */

export type CircuitState = "closed" | "open" | "half_open";

export class CircuitOpenError extends Error {
  readonly circuitKey: string;
  readonly retryAfterMs: number;

  constructor(key: string, retryAfterMs: number) {
    super(`Circuit open for "${key}" — retry after ${Math.ceil(retryAfterMs / 1000)}s`);
    this.name = "CircuitOpenError";
    this.circuitKey = key;
    this.retryAfterMs = retryAfterMs;
  }
}

interface CircuitEntry {
  failures: number;
  lastFailedAt: number;
  lastSuccessAt: number;
}

export interface CircuitBreakerConfig {
  /** Consecutive failures before opening the circuit. Default: 5. */
  threshold?: number;
  /** Base cooldown in ms for exponential backoff. Default: 1000 (1s). */
  baseCooldownMs?: number;
  /** Maximum cooldown cap in ms. Default: 3600000 (1 hour). */
  maxCooldownMs?: number;
}

const DEFAULT_CONFIG: Required<CircuitBreakerConfig> = {
  threshold: 5,
  baseCooldownMs: 1000,
  maxCooldownMs: 3_600_000,
};

const GLOBAL_KEY = "__radarboard_circuit_breaker__" as const;

function getCircuits(): Map<string, CircuitEntry> {
  const g = globalThis as unknown as Record<string, Map<string, CircuitEntry>>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new Map();
  }
  return g[GLOBAL_KEY];
}

/** Calculate cooldown duration using exponential backoff. */
function getCooldownMs(failures: number, config: Required<CircuitBreakerConfig>): number {
  const cooldown = config.baseCooldownMs * 2 ** (failures - config.threshold);
  return Math.min(cooldown, config.maxCooldownMs);
}

/** Get the current state of a circuit. */
export function getCircuitState(key: string, config: CircuitBreakerConfig = {}): CircuitState {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const entry = getCircuits().get(key);

  if (!entry || entry.failures < cfg.threshold) return "closed";

  const cooldownMs = getCooldownMs(entry.failures, cfg);
  const elapsed = Date.now() - entry.lastFailedAt;

  if (elapsed >= cooldownMs) return "half_open";
  return "open";
}

/** Get remaining cooldown time in ms, or 0 if circuit is not open. */
export function getRemainingCooldownMs(key: string, config: CircuitBreakerConfig = {}): number {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const entry = getCircuits().get(key);

  if (!entry || entry.failures < cfg.threshold) return 0;

  const cooldownMs = getCooldownMs(entry.failures, cfg);
  const remaining = cooldownMs - (Date.now() - entry.lastFailedAt);
  return Math.max(0, remaining);
}

/**
 * Execute `fn` with circuit breaker protection.
 *
 * - CLOSED: runs `fn` normally
 * - OPEN: throws `CircuitOpenError` without calling `fn`
 * - HALF_OPEN: runs `fn` as a probe — success resets, failure re-opens
 *
 * @example
 * ```ts
 * const data = await withCircuitBreaker("github/pulls", async () => {
 *   return await fetch("https://api.github.com/...");
 * });
 * ```
 */
export async function withCircuitBreaker<T>(
  key: string,
  fn: () => Promise<T>,
  config: CircuitBreakerConfig = {}
): Promise<T> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const circuits = getCircuits();
  const state = getCircuitState(key, cfg);

  if (state === "open") {
    const retryAfterMs = getRemainingCooldownMs(key, cfg);
    throw new CircuitOpenError(key, retryAfterMs);
  }

  // CLOSED or HALF_OPEN — attempt the call
  try {
    const result = await fn();

    // Success — reset the circuit
    circuits.delete(key);
    return result;
  } catch (err) {
    // Record the failure
    const entry = circuits.get(key);
    circuits.set(key, {
      failures: (entry?.failures ?? 0) + 1,
      lastFailedAt: Date.now(),
      lastSuccessAt: entry?.lastSuccessAt ?? 0,
    });

    throw err;
  }
}

/** Reset a specific circuit (for testing). */
export function resetCircuit(key: string): void {
  getCircuits().delete(key);
}

/** Reset all circuits (for testing). */
export function resetAllCircuits(): void {
  getCircuits().clear();
}
