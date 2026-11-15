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
  modelWeights,
  usedThisWeek,
  usedToday,
  weightedTokens,
} from "../../domain/ai-usage";
import { repoDir } from "../../hosting/storage";
import { createT } from "../../i18n";
import { z } from "zod";
import {
  aiAssistInput,
  aiConversationRenameInput,
  aiProposalStatusInput,
  type AiProposedChange,
  type AiToolUse,
} from "../../../shared/schemas";
import {
  addAssistantMessage,
  addUserMessage,
  createConversation,
  deleteConversation,
  getConversation,
  historyOf,
  listConversations,
  messagesOf,
  pendingProposal,
  renameConversation,
  setProposalStatus,
  titleOf,
  toView,
  touchConversation,
  truncateFrom,
} from "../../domain/ai-conversations";
import type { AuthedEnv } from "../env";
import { requireUser } from "../middleware";
import { idParam } from "../params";
import { effectiveAi, getInstanceSettings } from "../../domain/instance";
import { hostedOnly } from "./publishing";
import { validate } from "../validate";

/*
 * The editor's AI writing assistant (platforms/cloud/docs/cloud-ai-assistant.md). The
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
        (ai?.models ?? []).map((m) => [m, modelWeights(weights, m)]),
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

const conversationParams = validate(
  "param",
  z.object({
    id: z.coerce.number().int().positive(),
    cid: z.coerce.number().int().positive(),
  }),
);
const messageParams = validate(
  "param",
  z.object({
    id: z.coerce.number().int().positive(),
    cid: z.coerce.number().int().positive(),
    mid: z.coerce.number().int().positive(),
  }),
);

/**
 * /api/books/:id/ai/… — one streamed request (assist), and the teacher's
 * conversations in this book.
 */
export function bookAiRoutes({ db, config }: Deps) {
  const allow = rateLimiter(config.ai?.requestsPerMinute ?? 6);
  return new Hono<AuthedEnv>()
    .use(requireUser)
    .get("/:id/ai/conversations", idParam, (c) => {
      const user = c.get("user");
      const { book } = bookAccess(db, user, c.req.valid("param").id);
      return c.json({ conversations: listConversations(db, user.id, book.id) });
    })
    .get("/:id/ai/conversations/:cid", conversationParams, (c) => {
      const user = c.get("user");
      const { id, cid } = c.req.valid("param");
      const { book } = bookAccess(db, user, id);
      const conversation = getConversation(db, user.id, book.id, cid);
      return c.json({
        id: conversation.id,
        title: conversation.title,
        messages: messagesOf(db, conversation.id).map(toView),
      });
    })
    .patch(
      "/:id/ai/conversations/:cid",
      conversationParams,
      validate("json", aiConversationRenameInput),
      (c) => {
        const user = c.get("user");
        const { id, cid } = c.req.valid("param");
        const { book } = bookAccess(db, user, id);
        const conversation = getConversation(db, user.id, book.id, cid);
        renameConversation(db, conversation.id, c.req.valid("json").title);
        return c.json({ ok: true });
      },
    )
    .delete("/:id/ai/conversations/:cid", conversationParams, (c) => {
      const user = c.get("user");
      const { id, cid } = c.req.valid("param");
      const { book } = bookAccess(db, user, id);
      const conversation = getConversation(db, user.id, book.id, cid);
      deleteConversation(db, conversation.id);
      return c.json({ ok: true });
    })
    .post(
      "/:id/ai/conversations/:cid/messages/:mid/proposal",
      messageParams,
      validate("json", aiProposalStatusInput),
      (c) => {
        const user = c.get("user");
        const { id, cid, mid } = c.req.valid("param");
        const { book } = bookAccess(db, user, id);
        const conversation = getConversation(db, user.id, book.id, cid);
        setProposalStatus(db, conversation.id, mid, c.req.valid("json").status);
        return c.json({ ok: true });
      },
    )
    .post(
    "/:id/ai/assist",
    idParam,
    // The schema caps a valid request: prompt, selection, context, page and
    // up to four scaled-down images; the body limit stops anything larger
    // before it is read, like the files routes do.
    bodyLimit({
      maxSize: 20 * 1024 * 1024,
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
      const request = c.req.valid("json");
      // A conversation that is not the teacher's own fails before anything
      // is counted.
      const existing =
        request.conversationId !== undefined
          ? getConversation(db, user.id, book.id, request.conversationId)
          : null;
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
      // Edit and resend (or regenerate): the edited message and what
      // followed it go; its attachments stay unless new ones came along.
      let input = request;
      if (existing && request.replaceFrom !== undefined) {
        const replaced = truncateFrom(db, existing.id, request.replaceFrom);
        if (request.attachments === undefined)
          input = { ...request, attachments: replaced.attachments };
      }
      // Counted once the request is accepted — a provider that then fails
      // has been asked all the same.
      countRequest(db, user.id);
      const repo = repoDir(config, book.id);
      // The teacher may pick any of the instance's models; anything else
      // falls back to the default rather than calling an unvetted name.
      const model =
        input.model && ai.models.includes(input.model) ? input.model : ai.model;

      // The conversation as it was before this message: the model's
      // history, and the changes still waiting for the teacher.
      const conversation =
        existing ?? createConversation(db, user.id, book.id, titleOf(input.prompt));
      const before = messagesOf(db, conversation.id);
      const context = {
        history: historyOf(before),
        pending: pendingProposal(before),
      };
      const userMessageId = addUserMessage(db, conversation.id, {
        content: input.prompt,
        pagePath: input.pagePath,
        attachments: input.attachments ?? [],
      });
      touchConversation(db, conversation.id);

      return streamSSE(c, async (stream) => {
        // One writer at a time: a heartbeat ping must never land between
        // the lines of one event, or the editor would read it as two
        // events. Every write goes through this queue.
        let writing: Promise<unknown> = Promise.resolve();
        const send = (event: string, data: unknown) => {
          const write = writing.then(() =>
            stream.writeSSE({ event, data: JSON.stringify(data) }),
          );
          writing = write.catch(() => {});
          return write;
        };
        // A heartbeat while the model works: a reasoning model can think
        // for minutes before its first word, and many proxies cut an
        // idle connection long before that — a comment line keeps the
        // editor's connection open without producing an event.
        const ping = setInterval(() => {
          writing = writing
            .then(() => stream.write(": ping\n\n"))
            .catch(() => clearInterval(ping));
        }, 15_000);
        const started = Date.now();
        let finish = "error";
        let errorMessage: string | null = null;
        let answer = "";
        let reasoning = "";
        const toolUses: AiToolUse[] = [];
        let proposal: AiProposedChange[] | null = null;
        let steps = 0;
        let tokensIn = 0;
        let tokensCached = 0;
        let tokensOut = 0;
        let credits = 0;
        const weights = modelWeights(ai.modelWeights, model);
        await send("conversation", {
          id: conversation.id,
          title: conversation.title,
          userMessageId,
        });
        try {
          for await (const event of runAssistant(
            { ai: { ...ai, model }, repo },
            input,
            context,
            c.req.raw.signal,
          )) {
            if (event.type === "delta") {
              answer += event.text;
              await send("delta", { text: event.text });
            } else if (event.type === "reasoning") {
              reasoning += event.text;
              await send("reasoning", { text: event.text });
            } else if (event.type === "tool_progress") {
              await send("toolProgress", {
                name: event.name,
                path: event.path,
                chars: event.chars,
              });
            } else if (event.type === "tool") {
              steps += 1;
              toolUses.push({ name: event.name, detail: event.detail });
              await send("tool", { name: event.name, detail: event.detail });
            } else if (event.type === "usage") {
              tokensIn += event.promptTokens;
              tokensCached += event.cachedPromptTokens;
              tokensOut += event.completionTokens;
              credits += weightedTokens(
                event.promptTokens,
                event.cachedPromptTokens,
                event.completionTokens,
                weights,
              );
              // Written as it happens, so an abort or failure later on
              // still costs what the provider already spent.
              const week = addTokens(
                db,
                user.id,
                event.promptTokens,
                event.cachedPromptTokens,
                event.completionTokens,
                weights,
              );
              await send("usage", {
                tokensUsedThisWeek: week,
                tokenQuota,
              });
            } else if (event.type === "proposal") {
              proposal = event.changes;
              await send("proposal", { changes: event.changes });
            } else {
              finish = event.finish;
            }
          }
        } catch (error) {
          if (c.req.raw.signal.aborted) {
            // The teacher stopped the request; there is no reader left to
            // tell, and an abort is not a provider failure.
            finish = "aborted";
          } else if (error instanceof ProviderError) {
            finish = "error";
            errorMessage =
              error.code === "timeout"
                ? t("errors.ai.timeout")
                : t("errors.ai.provider");
            await send("error", { message: errorMessage, code: error.code });
          } else {
            finish = "error";
            errorMessage = t("errors.generic");
            await send("error", { message: errorMessage, code: "internal" });
          }
        } finally {
          clearInterval(ping);
          // The answer is kept as far as it got — a stopped or failed one
          // too, like a chat keeps what it showed.
          const durationMs = Date.now() - started;
          const messageId = addAssistantMessage(db, conversation.id, {
            content: answer,
            reasoning,
            tools: toolUses,
            proposal,
            finish,
            error: errorMessage,
            model,
            tokensIn,
            tokensOut,
            credits,
            durationMs,
          });
          touchConversation(db, conversation.id);
          if (finish !== "error" && finish !== "aborted") {
            // What the answer cost, so the editor can show it next to it.
            await send("done", {
              finish,
              messageId,
              durationMs,
              usage: { tokensIn, tokensCached, tokensOut, credits },
            });
          } else if (finish === "error") {
            // The failed answer is part of the conversation too; the
            // editor needs its id to offer a retry in place.
            await send("saved", { messageId });
          }
          // Metadata only: never the request's or the answer's content.
          audit(db, {
            actorUserId: user.id,
            action: "ai.assist",
            targetType: "book",
            targetId: book.id,
            data: {
              page: input.pagePath,
              model,
              tokensIn,
              tokensCached,
              tokensOut,
              weights,
              steps,
              proposedChanges: proposal?.length ?? 0,
              finish,
            },
          });
        }
      });
    },
  );
}
