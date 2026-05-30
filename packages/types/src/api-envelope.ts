/**
 * Standard API protocol envelope for request/response tracing.
 *
 * Every API response includes a correlationId for debugging.
 * Requests may optionally include one; if omitted, the server generates it.
 */

/** Successful response envelope. */
export interface ApiResponse<T = unknown> {
  ok: true;
  correlationId: string;
  data: T;
}

/** Error response envelope. */
export interface ApiErrorResponse {
  ok: false;
  correlationId: string;
  error: {
    code: string;
    message: string;
    metadata?: Record<string, unknown>;
  };
}

/** Union type for all API responses. */
export type ApiEnvelope<T = unknown> = ApiResponse<T> | ApiErrorResponse;
