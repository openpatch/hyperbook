import { and, desc, eq, gte, asc } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type {
  AiAttachment,
  AiConversationSummary,
  AiMessageView,
  AiProposalStatus,
  AiProposedChange,
  AiToolUse,
} from "../../shared/schemas";
import { legacyParts, type AiAnswerPart } from "../../shared/ai-parts";
import type { ChatMessage, UserContentPart } from "../ai/provider";
import type { Db } from "../db/client";
import { aiConversations, aiMessages } from "../db/schema";
import { parseJson } from "../json";

/*
 * The AI assistant's conversations (docs/cloud-ai-assistant.md): one
 * teacher's chat about one book, kept so it survives a reload, and so a
 * follow-up sees the whole conversation — earlier answers, the tools they
 * used, and the file changes still waiting for the teacher. Only the
 * teacher who had a conversation sees it.
 */

type MessageRow = typeof aiMessages.$inferSelect;

/** The history the model is sent, in characters — roughly 15k tokens. */
const HISTORY_BUDGET = 60_000;
/** One earlier answer, at most. */
const ANSWER_MAX = 12_000;
/** One earlier attached document, at most. */
const DOCUMENT_MAX = 20_000;
/** Images and documents are sent again only from this many latest messages. */
const ATTACHMENT_REACH = 4;
/** Conversations a teacher sees per book. */
const LIST_LIMIT = 100;

/** A conversation's title: the first line of its first request. */
export function titleOf(prompt: string): string {
  const line = prompt.trim().split("\n")[0]!.trim();
  return line.length > 80 ? `${line.slice(0, 79)}…` : line || "…";
}

export function createConversation(
  db: Db,
  userId: number,
  bookId: number,
  title: string,
) {
  return db
    .insert(aiConversations)
    .values({ userId, bookId, title })
    .returning()
    .get();
}

/** The teacher's own conversation in this book; 404 for anything else. */
export function getConversation(
  db: Db,
  userId: number,
  bookId: number,
  id: number,
) {
  const conversation = db
    .select()
    .from(aiConversations)
    .where(
      and(
        eq(aiConversations.id, id),
        eq(aiConversations.userId, userId),
        eq(aiConversations.bookId, bookId),
      ),
    )
    .get();
  if (!conversation)
    throw new HTTPException(404, { message: "Conversation not found" });
  return conversation;
}

export function listConversations(
  db: Db,
  userId: number,
  bookId: number,
): AiConversationSummary[] {
  return db
    .select({
      id: aiConversations.id,
      title: aiConversations.title,
      updatedAt: aiConversations.updatedAt,
    })
    .from(aiConversations)
    .where(
      and(eq(aiConversations.userId, userId), eq(aiConversations.bookId, bookId)),
    )
    .orderBy(desc(aiConversations.updatedAt), desc(aiConversations.id))
    .limit(LIST_LIMIT)
    .all()
    .map((c) => ({ ...c, updatedAt: c.updatedAt.getTime() }));
}

export function renameConversation(db: Db, id: number, title: string) {
  db.update(aiConversations)
    .set({ title })
    .where(eq(aiConversations.id, id))
    .run();
}

export function deleteConversation(db: Db, id: number) {
  db.delete(aiConversations).where(eq(aiConversations.id, id)).run();
}

export function touchConversation(db: Db, id: number) {
  db.update(aiConversations)
    .set({ updatedAt: new Date() })
    .where(eq(aiConversations.id, id))
    .run();
}

export function messagesOf(db: Db, conversationId: number): MessageRow[] {
  return db
    .select()
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(asc(aiMessages.id))
    .all();
}

/**
 * Edit and resend: drops one of the teacher's messages and everything
 * after it. Only a user message of this conversation qualifies.
 */
export function truncateFrom(
  db: Db,
  conversationId: number,
  messageId: number,
): { attachments: AiAttachment[] } {
  const message = db
    .select()
    .from(aiMessages)
    .where(
      and(
        eq(aiMessages.id, messageId),
        eq(aiMessages.conversationId, conversationId),
      ),
    )
    .get();
  if (!message || message.role !== "user")
    throw new HTTPException(404, { message: "Message not found" });
  db.delete(aiMessages)
    .where(
      and(
        eq(aiMessages.conversationId, conversationId),
        gte(aiMessages.id, messageId),
      ),
    )
    .run();
  return { attachments: attachmentsOf(message) };
}

export function addUserMessage(
  db: Db,
  conversationId: number,
  message: { content: string; pagePath: string; attachments: AiAttachment[] },
): number {
  return db
    .insert(aiMessages)
    .values({
      conversationId,
      role: "user",
      content: message.content,
      pagePath: message.pagePath,
      attachments:
        message.attachments.length > 0
          ? JSON.stringify(message.attachments)
          : null,
    })
    .returning({ id: aiMessages.id })
    .get().id;
}

export type AssistantRecord = {
  content: string;
  reasoning: string;
  tools: AiToolUse[];
  parts: AiAnswerPart[];
  proposal: AiProposedChange[] | null;
  finish: string;
  error: string | null;
  model: string;
  tokensIn: number;
  tokensOut: number;
  credits: number;
  durationMs: number;
};

/**
 * Stores an answer. A new proposal holds every pending change (the agent
 * starts from the earlier ones), so an earlier pending one is superseded.
 */
export function addAssistantMessage(
  db: Db,
  conversationId: number,
  record: AssistantRecord,
): number {
  return db.transaction((tx) => {
    const proposing = record.proposal !== null && record.proposal.length > 0;
    if (proposing) {
      tx.update(aiMessages)
        .set({ proposalStatus: "superseded" })
        .where(
          and(
            eq(aiMessages.conversationId, conversationId),
            eq(aiMessages.proposalStatus, "pending"),
          ),
        )
        .run();
    }
    return tx
      .insert(aiMessages)
      .values({
        conversationId,
        role: "assistant",
        content: record.content,
        reasoning: record.reasoning || null,
        tools: record.tools.length > 0 ? JSON.stringify(record.tools) : null,
        parts: record.parts.length > 0 ? JSON.stringify(record.parts) : null,
        proposal: proposing ? JSON.stringify(record.proposal) : null,
        proposalStatus: proposing ? "pending" : null,
        finish: record.finish,
        error: record.error,
        model: record.model,
        tokensIn: record.tokensIn,
        tokensOut: record.tokensOut,
        credits: record.credits,
        durationMs: record.durationMs,
      })
      .returning({ id: aiMessages.id })
      .get().id;
  });
}

/** The teacher accepted or denied a proposal: it no longer carries over. */
export function setProposalStatus(
  db: Db,
  conversationId: number,
  messageId: number,
  status: Extract<AiProposalStatus, "applied" | "denied">,
) {
  const updated = db
    .update(aiMessages)
    .set({ proposalStatus: status })
    .where(
      and(
        eq(aiMessages.id, messageId),
        eq(aiMessages.conversationId, conversationId),
        eq(aiMessages.role, "assistant"),
      ),
    )
    .run();
  if (updated.changes === 0)
    throw new HTTPException(404, { message: "Message not found" });
}

/** The changes still waiting for the teacher, if any. */
export function pendingProposal(rows: MessageRow[]): AiProposedChange[] | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i]!;
    if (row.proposalStatus === "pending" && row.proposal)
      return parseJson(row.proposal) as AiProposedChange[];
  }
  return null;
}

function attachmentsOf(row: MessageRow): AiAttachment[] {
  return row.attachments ? (parseJson(row.attachments) as AiAttachment[]) : [];
}

function toolsOf(row: MessageRow): AiToolUse[] {
  return row.tools ? (parseJson(row.tools) as AiToolUse[]) : [];
}

export function toView(row: MessageRow): AiMessageView {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    pagePath: row.pagePath,
    // A document's text stays on the server; the chat shows its name.
    attachments: attachmentsOf(row).map((a) =>
      a.kind === "image"
        ? { kind: "image", name: a.name, data: a.data }
        : { kind: "text", name: a.name },
    ),
    reasoning: row.reasoning,
    tools: toolsOf(row),
    parts: row.parts
      ? (parseJson(row.parts) as AiAnswerPart[])
      : row.role === "assistant"
        ? legacyParts(row.reasoning, toolsOf(row), row.content)
        : [],
    proposal: row.proposal
      ? (parseJson(row.proposal) as AiProposedChange[])
      : null,
    proposalStatus: row.proposalStatus,
    finish: row.finish,
    error: row.error,
    model: row.model,
    tokensIn: row.tokensIn,
    tokensOut: row.tokensOut,
    credits: row.credits,
    durationMs: row.durationMs,
    createdAt: row.createdAt.getTime(),
  };
}

/** An earlier answer as the model sees it again: text, tools, changes. */
function answerText(row: MessageRow): string {
  const parts: string[] = [];
  const text =
    row.content.length > ANSWER_MAX
      ? `${row.content.slice(0, ANSWER_MAX)}\n… (shortened)`
      : row.content;
  if (text) parts.push(text);
  const tools = toolsOf(row);
  if (tools.length > 0)
    parts.push(
      `(Tools used: ${tools.map((t) => (t.detail ? `${t.name} ${t.detail}` : t.name)).join("; ")})`,
    );
  if (row.proposal) {
    const changes = parseJson(row.proposal) as AiProposedChange[];
    const what = changes.map((c) => `${c.op} ${c.path}`).join(", ");
    const status =
      row.proposalStatus === "applied"
        ? "the teacher accepted them"
        : row.proposalStatus === "denied"
          ? "the teacher denied them"
          : row.proposalStatus === "superseded"
            ? "carried into a later proposal"
            : "still waiting for the teacher";
    parts.push(`(Proposed changes: ${what} — ${status})`);
  }
  if (row.finish === "error" || row.finish === "aborted")
    parts.push(
      row.finish === "aborted"
        ? "(The teacher stopped this answer.)"
        : "(This answer failed.)",
    );
  return parts.join("\n\n") || "(No answer.)";
}

/** A teacher's earlier message as the model sees it again. */
function requestContent(
  row: MessageRow,
  recent: boolean,
): string | UserContentPart[] {
  const attachments = attachmentsOf(row);
  const text = [
    row.content,
    ...attachments
      .filter((a) => a.kind === "text")
      .map((a) =>
        recent
          ? `### Attached document: ${a.name}\n\n\`\`\`\`\n${a.text.slice(0, DOCUMENT_MAX)}\n\`\`\`\``
          : `(Attached document: ${a.name})`,
      ),
    ...(recent
      ? []
      : attachments
          .filter((a) => a.kind === "image")
          .map((a) => `(Attached image: ${a.name})`)),
  ].join("\n\n");
  const images = recent ? attachments.filter((a) => a.kind === "image") : [];
  if (images.length === 0) return text;
  return [
    { type: "text", text },
    ...images.map((a) => ({
      type: "image_url" as const,
      image_url: { url: (a as { data: string }).data },
    })),
  ];
}

function sizeOf(content: string | UserContentPart[] | null): number {
  if (content === null) return 0;
  if (typeof content === "string") return content.length;
  // An image is billed like a few thousand characters of text.
  return content.reduce(
    (n, part) => n + (part.type === "text" ? part.text.length : 4000),
    0,
  );
}

/**
 * The conversation so far as provider messages, oldest first, within
 * HISTORY_BUDGET: the newest turns are kept, older ones dropped first.
 */
export function historyOf(rows: MessageRow[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  let used = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i]!;
    const recent = rows.length - i <= ATTACHMENT_REACH;
    const message: ChatMessage =
      row.role === "user"
        ? { role: "user", content: requestContent(row, recent) }
        : { role: "assistant", content: answerText(row) };
    const size = sizeOf(message.content);
    if (used + size > HISTORY_BUDGET && out.length > 0) break;
    used += size;
    out.unshift(message);
  }
  // A history starts with the teacher's turn; an answer whose request
  // was dropped would read as the model talking to itself.
  while (out[0]?.role === "assistant") out.shift();
  return out;
}
