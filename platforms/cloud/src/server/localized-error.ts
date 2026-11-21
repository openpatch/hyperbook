import { createT, type MessageKey } from "../shared/i18n";

const english = createT("en");

/**
 * An error a teacher may read: its `message` is the English text (for logs,
 * git's output, checks stored in the database), and `key` with `params` lets
 * a route answer in the request's language: `httpError(400, error.key,
 * error.params)`.
 */
export class LocalizedError extends Error {
  constructor(
    readonly key: MessageKey,
    readonly params?: Record<string, unknown>,
  ) {
    super(english(key, params));
  }
}
