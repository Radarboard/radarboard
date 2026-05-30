/**
 * Structured error types for Radarboard.
 *
 * Provides a typed error hierarchy with error codes and HTTP status mappings.
 * API routes can catch these and return consistent JSON error responses.
 */

/** Error codes for programmatic handling. */
export type RadarboardErrorCode =
  | "CREDENTIAL_MISSING"
  | "CREDENTIAL_EXPIRED"
  | "CREDENTIAL_INVALID"
  | "INTEGRATION_UNAVAILABLE"
  | "INTEGRATION_RATE_LIMITED"
  | "INTEGRATION_TIMEOUT"
  | "PLUGIN_NOT_FOUND"
  | "PLUGIN_TOKEN_INVALID"
  | "PLUGIN_INIT_FAILED"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR";

/** Base error class with code, HTTP status, and optional metadata. */
export class RadarboardError extends Error {
  readonly code: RadarboardErrorCode;
  readonly statusCode: number;
  readonly metadata?: Record<string, unknown>;

  constructor(
    code: RadarboardErrorCode,
    message: string,
    statusCode = 500,
    metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = "RadarboardError";
    this.code = code;
    this.statusCode = statusCode;
    this.metadata = metadata;
  }

  /** Serialize for JSON API responses. */
  toJSON(): {
    error: string;
    code: RadarboardErrorCode;
    metadata?: Record<string, unknown>;
  } {
    return {
      error: this.message,
      code: this.code,
      ...(this.metadata ? { metadata: this.metadata } : {}),
    };
  }
}

/** Credential-related errors (missing, expired, invalid). */
export class CredentialError extends RadarboardError {
  constructor(
    code: Extract<
      RadarboardErrorCode,
      "CREDENTIAL_MISSING" | "CREDENTIAL_EXPIRED" | "CREDENTIAL_INVALID"
    >,
    message: string,
    metadata?: Record<string, unknown>
  ) {
    super(code, message, 401, metadata);
    this.name = "CredentialError";
  }
}

/** Integration-related errors (unavailable, rate-limited, timeout). */
export class IntegrationError extends RadarboardError {
  constructor(
    code: Extract<
      RadarboardErrorCode,
      "INTEGRATION_UNAVAILABLE" | "INTEGRATION_RATE_LIMITED" | "INTEGRATION_TIMEOUT"
    >,
    message: string,
    metadata?: Record<string, unknown>
  ) {
    const statusCode =
      code === "INTEGRATION_RATE_LIMITED" ? 429 : code === "INTEGRATION_TIMEOUT" ? 504 : 502;
    super(code, message, statusCode, metadata);
    this.name = "IntegrationError";
  }
}

/** Plugin-related errors. */
export class PluginError extends RadarboardError {
  constructor(
    code: Extract<
      RadarboardErrorCode,
      "PLUGIN_NOT_FOUND" | "PLUGIN_TOKEN_INVALID" | "PLUGIN_INIT_FAILED"
    >,
    message: string,
    metadata?: Record<string, unknown>
  ) {
    const statusCode =
      code === "PLUGIN_NOT_FOUND" ? 404 : code === "PLUGIN_TOKEN_INVALID" ? 403 : 500;
    super(code, message, statusCode, metadata);
    this.name = "PluginError";
  }
}

/** Input validation errors (Zod parse failures, missing params). */
export class ValidationError extends RadarboardError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super("VALIDATION_ERROR", message, 400, metadata);
    this.name = "ValidationError";
  }
}

/** Resource not found. */
export class NotFoundError extends RadarboardError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super("NOT_FOUND", message, 404, metadata);
    this.name = "NotFoundError";
  }
}

/**
 * Check if an unknown error is a RadarboardError.
 * Useful in catch blocks to decide between typed and generic error handling.
 */
export function isRadarboardError(err: unknown): err is RadarboardError {
  return err instanceof RadarboardError;
}
