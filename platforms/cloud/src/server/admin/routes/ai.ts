import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { streamSSE } from "hono/streaming";
import { audit } from "../../audit";
import { runAssistant } from "../../ai/agent";
import { ProviderError } from "../../ai/provider";
import type { Deps } from "../../deps";
import { bookAccess } from "../../domain/books";
import { getEntitlements } from "../../domain/entitlements";
import {
  addTokens,
  countRequest,
  currentWeek,
  modelWeight,
  usedThisWeek,
  usedToday,
} from "../../domain/ai-usage";
import { repoDir } from "../../hosting/storage";
import { createT } from "../../i18n";
import { aiAssistInput } from "../../../shared/schemas";
import type { AuthedEnv } from "../env";
import { requireUser } from "../middleware";
import { idParam } from "../params";
import { effectiveAi, getInstanceSettings } from "../../domain/instance";
import { hostedOnly } from "./publishing";
import { validate } from "../validate";

/*
 * The editor's AI writing assistant (docs/cloud-ai-assistant.md). The
 * provider's key lives in the server's env only; the editor talks to these
 * routes, never to the provider. Answering happens as Server-Sent Events,
 * because the assistant's text streams while it is written.
 */

/**
 * A fixed window per user, in memory: one instance, one process, and a
 * limit that exists to stop a runaway editor, not to bill anyone.
 */
function rateLimiter(maxPerMinute: number) {
  const window = new Map<number, { start: number; count: number }>();
  return (userId: number): boolean => {
    const now = Date.now();
    // Expired windows of one-off visitors are dropped once the map grows,
    // so they do not stay in memory for the process's whole life.
    if (window.size > 4096) {
      for (const [id, entry] of window) {
        if (now - entry.start >= 60_000) window.delete(id);
      }
    }
    const entry = window.get(userId);
    if (!entry || now - entry.start >= 60_000) {
      window.set(userId, { start: now, count: 1 });
      return true;
    }
    entry.count += 1;
    return entry.count <= maxPerMinute;
  };
}

/** /api/ai — whether the editor shows the assistant at all, and what is left. */
export function aiRoutes({ config, db }: Deps) {
  return new Hono<AuthedEnv>().use(requireUser).get("/", (c) => {
    const user = c.get("user");
    const { ai: aiAllowed, ai_requests_per_day, ai_tokens_per_week } = getEntitlements(
      db,
      user,
    );
    const ai = effectiveAi(config, getInstanceSettings(db));
    const weights = ai?.modelWeights ?? {};
    return c.json({
      enabled: ai !== null,
      model: ai?.model ?? null,
      models: ai?.models ?? [],
      modelLabels: ai?.modelLabels ?? {},
      modelWeights: Object.fromEntries(
        (ai?.models ?? []).map((m) => [m, modelWeight(weights, m)]),
      ),
      allowed: aiAllowed,
      usedToday: usedToday(db, user.id),
      quota: ai_requests_per_day,
      tokensUsedThisWeek: usedThisWeek(db, user.id),
      tokenQuota: ai_tokens_per_week,
      tokensResetOn: currentWeek().resets,
    });
  });
}

/** /api/books/:id/ai/assist — one streamed request. */
export function bookAiRoutes({ db, config }: Deps) {
  const allow = rateLimiter(config.ai?.requestsPerMinute ?? 6);
  return new Hono<AuthedEnv>().use(requireUser).post(
    "/:id/ai/assist",
    idParam,
    // The schema caps a valid request at well under 640 KiB (prompt,
    // selection, context, page); the body limit stops anything larger
    // before it is read, like the files routes do.
    bodyLimit({
      maxSize: 640 * 1024,
      onError: () => {
        throw new HTTPException(413, {
          message: "The AI request is too large",
        });
      },
    }),
    validate("json", aiAssistInput),
    (c) => {
      const user = c.get("user");
      const { book } = bookAccess(db, user, c.req.valid("param").id);
      // An external book has no repository here; like the files routes, say
      // so before anything is counted or streamed.
      hostedOnly(book);
      const t = createT(c.get("locale"));
      const ai = effectiveAi(config, getInstanceSettings(db));
      if (!ai) {
        throw new HTTPException(503, { message: t("errors.ai.notConfigured") });
      }
      // The entitlements decide whether this teacher may use the assistant
      // at all, and how many requests a UTC day buys them.
      const {
        ai: allowed,
        ai_requests_per_day: quota,
        ai_tokens_per_week: tokenQuota,
      } = getEntitlements(db, user);
      if (!allowed) {
        throw new HTTPException(403, { message: t("errors.ai.disabled") });
      }
      if (quota !== null && usedToday(db, user.id) >= quota) {
        throw new HTTPException(429, { message: t("errors.ai.quota") });
      }
      if (tokenQuota !== null && usedThisWeek(db, user.id) >= tokenQuota) {
        throw new HTTPException(429, { message: t("errors.ai.tokenQuota") });
      }
      if (!allow(user.id)) {
        throw new HTTPException(429, { message: t("errors.ai.rateLimited") });
      }
      // Counted once the request is accepted — a provider that then fails
      // has been asked all the same.
      countRequest(db, user.id);
      const input = c.req.valid("json");
      const repo = repoDir(config, book.id);
      // The teacher may pick any of the instance's models; anything else
      // falls back to the default rather than calling an unvetted name.
      const model =
        input.model && ai.models.includes(input.model) ? input.model : ai.model;

      return streamSSE(c, async (stream) => {
        const send = (event: string, data: unknown) =>
          stream.writeSSE({ event, data: JSON.stringify(data) });
        let finish = "error";
        let steps = 0;
        let proposedChanges = 0;
        let tokensIn = 0;
        let tokensOut = 0;
        const weight = modelWeight(ai.modelWeights, model);
        try {
          for await (const event of runAssistant(
            { ai: { ...ai, model }, repo },
            input,
            c.req.raw.signal,
          )) {
            if (event.type === "delta") {
              await send("delta", { text: event.text });
            } else if (event.type === "tool") {
              steps += 1;
              await send("tool", { name: event.name, args: event.args });
            } else if (event.type === "usage") {
              tokensIn += event.promptTokens;
              tokensOut += event.completionTokens;
              // Written as it happens, so an abort or failure later on
              // still costs what the provider already spent.
              const week = addTokens(
                db,
                user.id,
                event.promptTokens,
                event.completionTokens,
                weight,
              );
              await send("usage", {
                tokensUsedThisWeek: week,
                tokenQuota,
              });
            } else if (event.type === "proposal") {
              proposedChanges = event.changes.length;
              await send("proposal", { changes: event.changes });
            } else {
              finish = event.finish;
            }
          }
          await send("done", { finish });
        } catch (error) {
          if (c.req.raw.signal.aborted) {
            // The teacher stopped the request; there is no reader left to
            // tell, and an abort is not a provider failure.
            finish = "aborted";
          } else if (error instanceof ProviderError) {
            finish = "error";
            await send("error", {
              message: t("errors.ai.provider"),
              code: error.code,
            });
          } else {
            finish = "error";
            await send("error", {
              message: t("errors.generic"),
              code: "internal",
            });
          }
        } finally {
          // Metadata only: never the request's or the answer's content.
          audit(db, {
            actorUserId: user.id,
            action: "ai.assist",
            targetType: "book",
            targetId: book.id,
            data: {
              action: input.action,
              page: input.pagePath,
              model,
              tokensIn,
              tokensOut,
              weight,
              steps,
              proposedChanges,
              finish,
            },
          });
        }
      });
    },
  );
}
