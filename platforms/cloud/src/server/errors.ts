import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { createT, isMessageKey, type MessageKey } from "../shared/i18n";
import { requestLocale } from "./i18n";

type Status = ConstructorParameters<typeof HTTPException>[0];

/**
 * An HTTP error whose message is a catalog key with its params. It is
 * translated into the request's language when it is sent (errorResponse),
 * so code that throws needs no locale. A plain
 * `new HTTPException(409, { message: "errors.groups.nameTaken" })` works the
 * same for messages without params.
 */
export function httpError(status: Status, key: MessageKey, params?: Record<string, unknown>) {
  return new HTTPException(status, { message: key, cause: params });
}

/**
 * The answer for an HTTPException: the response it carries, else
 * `{ error }` with the message translated when it is a catalog key. Messages
 * that are not keys (git's own output, a parser's error) pass through.
 */
export function errorResponse(c: Context, error: HTTPException) {
  if (error.res) return error.getResponse();
  const params =
    error.cause && typeof error.cause === "object" ? (error.cause as Record<string, unknown>) : undefined;
  const message = isMessageKey(error.message)
    ? createT(requestLocale(c))(error.message, params)
    : error.message;
  return c.json({ error: message }, error.status);
}

/** The answer for an unexpected error, in the request's language. */
export function genericErrorResponse(c: Context) {
  return c.json({ error: createT(requestLocale(c))("errors.generic") }, 500);
}
