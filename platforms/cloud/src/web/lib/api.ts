import { hc, type InferResponseType } from "hono/client";
import type { AdminApi } from "../../server/admin/app";

/** Typed client for the admin API; types come straight from the server routes. */
export const api = hc<AdminApi>("/api");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly issues: { path: string; message: string }[] = [],
    /** The whole error response, for errors that carry more (e.g. conflicts). */
    readonly body: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Resolves to the JSON of a successful response, throws ApiError otherwise. */
export async function unwrap<T extends Response>(
  response: Promise<T>,
): Promise<InferResponseType<() => Promise<T>, 200>> {
  const res = await response;
  if (res.ok) return (await res.json()) as never;
  let message = `Request failed (${res.status})`;
  let issues: { path: string; message: string }[] = [];
  let all: Record<string, unknown> = {};
  try {
    const body = (await res.json()) as {
      error?: string;
      issues?: { path: string; message: string }[];
    };
    all = body;
    if (body.error) message = body.error;
    if (body.issues) issues = body.issues;
  } catch {
    // Not JSON; keep the generic message.
  }
  throw new ApiError(message, res.status, issues, all);
}
