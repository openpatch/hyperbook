import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { ZodType } from "zod";
import { createT, isMessageKey } from "../../shared/i18n";
import { requestLocale } from "../i18n";

/**
 * zValidator that answers bad input with 400 and the zod issues. Issue
 * messages that are catalog keys (the shared schemas use them) are
 * translated into the request's locale; anything else passes through.
 */
export function validate<T extends ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const t = createT(requestLocale(c));
      return c.json(
        {
          error: t("errors.invalidInput"),
          issues: result.error.issues.map((i) => ({
            path: i.path.join("."),
            message: isMessageKey(i.message) ? t(i.message) : i.message,
          })),
        },
        400,
      );
    }
  });
}
