import type { ApiEnvelope } from "@radarboard/types/api-envelope";
import { isRadarboardError } from "@radarboard/types/errors";
import { NextResponse } from "next/server";
import type { ZodSchema } from "zod";

type ParseResult<T> = { ok: true; data: T } | { ok: false; response: Response };
type ErrorMetadata = Record<string, unknown>;

interface HandleRouteOptions {
  context?: string;
  onError?: (error: unknown) => void;
}

function defaultErrorCode(status: number): string {
  switch (status) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    default:
      return status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR";
  }
}

function getErrorDetail(err: unknown, fallback = "Internal server error"): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  if (typeof err === "string" && err.trim()) return err;
  return fallback;
}

export class ApiRouteError extends Error {
  readonly status: number;
  readonly code: string;
  readonly metadata?: ErrorMetadata;

  constructor(
    status: number,
    message: string,
    code = defaultErrorCode(status),
    metadata?: ErrorMetadata
  ) {
    super(message);
    this.name = "ApiRouteError";
    this.status = status;
    this.code = code;
    this.metadata = metadata;
  }
}

export function routeError(
  status: number,
  message: string,
  code = defaultErrorCode(status),
  metadata?: ErrorMetadata
): ApiRouteError {
  return new ApiRouteError(status, message, code, metadata);
}

export function badRequest(message: string, metadata?: ErrorMetadata): ApiRouteError {
  return routeError(400, message, "BAD_REQUEST", metadata);
}

export function unauthorized(message: string, metadata?: ErrorMetadata): ApiRouteError {
  return routeError(401, message, "UNAUTHORIZED", metadata);
}

export function forbidden(message: string, metadata?: ErrorMetadata): ApiRouteError {
  return routeError(403, message, "FORBIDDEN", metadata);
}

export function notFound(message: string, metadata?: ErrorMetadata): ApiRouteError {
  return routeError(404, message, "NOT_FOUND", metadata);
}

export function conflict(message: string, metadata?: ErrorMetadata): ApiRouteError {
  return routeError(409, message, "CONFLICT", metadata);
}

export function internalError(
  err: unknown,
  message = "Internal server error",
  metadata?: ErrorMetadata
): ApiRouteError {
  return routeError(500, `${message}: ${getErrorDetail(err)}`, "INTERNAL_ERROR", metadata);
}

// ---------------------------------------------------------------------------
// Correlation ID helpers
// ---------------------------------------------------------------------------

/** Extract or generate a correlation ID from a request. */
export function getCorrelationId(request?: Request): string {
  const fromHeader = request?.headers.get("X-Correlation-Id");
  return fromHeader || crypto.randomUUID();
}

/** Build a success envelope response. */
export function envelopeSuccess<T>(
  data: T,
  correlationId: string,
  status = 200
): NextResponse<ApiEnvelope<T>> {
  return NextResponse.json(
    { ok: true as const, correlationId, data },
    {
      status,
      headers: { "X-Correlation-Id": correlationId },
    }
  );
}

/** Build an error envelope response. */
export function envelopeError(
  code: string,
  message: string,
  correlationId: string,
  status = 500,
  metadata?: Record<string, unknown>
): NextResponse<ApiEnvelope<never>> {
  return NextResponse.json(
    {
      ok: false as const,
      correlationId,
      error: { code, message, ...(metadata ? { metadata } : {}) },
    },
    {
      status,
      headers: { "X-Correlation-Id": correlationId },
    }
  );
}

/**
 * Convert any error to a structured JSON response.
 * - RadarboardError → uses its code, statusCode, and metadata
 * - Unknown errors → generic 500 with the error message
 */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ApiRouteError) {
    return errorJson(err.status, err.message, err.metadata, err.code);
  }
  if (isRadarboardError(err)) {
    return NextResponse.json(err.toJSON(), { status: err.statusCode });
  }
  const message = err instanceof Error ? err.message : "Internal server error";
  return NextResponse.json({ error: message, code: "INTERNAL_ERROR" as const }, { status: 500 });
}

export function errorJson(
  status: number,
  message: string,
  extras?: ErrorMetadata,
  code = defaultErrorCode(status)
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      code,
      ...(extras ?? {}),
    },
    { status }
  );
}

export async function handleRoute(
  handler: () => Response | Promise<Response>,
  options: HandleRouteOptions = {}
): Promise<Response> {
  try {
    return await handler();
  } catch (err) {
    options.onError?.(err);
    if (err instanceof ApiRouteError || isRadarboardError(err)) {
      return errorResponse(err);
    }
    return errorResponse(options.context ? internalError(err, options.context) : err);
  }
}

/**
 * Parse and validate a JSON request body against a Zod schema.
 *
 * On success returns `{ ok: true, data }` where `data` is fully typed.
 * On failure returns `{ ok: false, response }` — a 400 Response ready to return
 * from the route handler, containing both a flat `error` string (first issue,
 * for backward-compatible clients) and a structured `issues` array (for richer
 * client-side handling).
 *
 * Usage:
 * ```ts
 * const parsed = await parseBody(request, MySchema)
 * if (!parsed.ok) return parsed.response
 * // parsed.data is fully typed here
 * ```
 */
export async function parseBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<ParseResult<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON", issues: [] }, { status: 400 }),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    // Zod v4 uses `issues`; v3 used `errors`. Support both.
    const issues =
      result.error.issues ?? (result.error as { errors?: typeof result.error.issues }).errors ?? [];
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: issues[0]?.message ?? "Invalid request",
          issues: issues.map((e) => ({
            path: e.path,
            message: e.message,
          })),
        },
        { status: 400 }
      ),
    };
  }

  return { ok: true, data: result.data };
}

function validateSchema<T>(
  raw: unknown,
  schema: ZodSchema<T>,
  invalidMessage: string
): ParseResult<T> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues =
      result.error.issues ?? (result.error as { errors?: typeof result.error.issues }).errors ?? [];
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: issues[0]?.message ?? invalidMessage,
          issues: issues.map((e) => ({
            path: e.path,
            message: e.message,
          })),
        },
        { status: 400 }
      ),
    };
  }

  return { ok: true, data: result.data };
}

/**
 * Parse and validate an HTML form submission against a Zod schema.
 */
export async function parseFormData<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<ParseResult<T>> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid form data", issues: [] }, { status: 400 }),
    };
  }

  const raw: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};
  for (const [key, value] of formData.entries()) {
    const existing = raw[key];
    if (existing === undefined) {
      raw[key] = value;
      continue;
    }

    raw[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
  }

  return validateSchema(raw, schema, "Invalid form data");
}

/**
 * Parse and validate an application/x-www-form-urlencoded request body against a Zod schema.
 */
export async function parseUrlEncodedBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<ParseResult<T>> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid form data", issues: [] }, { status: 400 }),
    };
  }

  const raw = Object.fromEntries(new URLSearchParams(text));
  return validateSchema(raw, schema, "Invalid form data");
}

/**
 * Validate URL search params against a Zod schema.
 *
 * Converts searchParams to a plain object (all values as strings) then
 * validates through the schema. Works with `z.coerce.number()` etc.
 *
 * Usage:
 * ```ts
 * const parsed = parseSearchParams(request.nextUrl.searchParams, MySchema)
 * if (!parsed.ok) return parsed.response
 * // parsed.data is fully typed here
 * ```
 */
export function parseSearchParams<T>(
  searchParams: URLSearchParams,
  schema: ZodSchema<T>
): ParseResult<T> {
  const raw: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    raw[key] = value;
  }

  return validateSchema(raw, schema, "Invalid query parameters");
}
