import type { EditorView } from "@codemirror/view";
import {
  ArrowUpIcon,
  BookOpenIcon,
  ChevronRightIcon,
  CopyIcon,
  FileIcon,
  FilePenIcon,
  FolderTreeIcon,
  HistoryIcon,
  ImageIcon,
  Loader2Icon,
  PaperclipIcon,
  PencilIcon,
  PlusIcon,
  RotateCwIcon,
  SearchIcon,
  SparklesIcon,
  SquareIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  AI_ATTACHMENTS_MAX,
  type AiAssistInput,
  type AiAttachment,
  type AiMessageView,
  type AiProposalStatus,
  type AiProposedChange,
  type FileChange,
} from "../../../shared/schemas";
import { addPart, closeParts, type AiAnswerPart } from "../../../shared/ai-parts";
import { ConflictError } from "./workspace";
import {
  assist,
  attachable,
  contextOf,
  decideProposal,
  deleteConversation,
  formatRelativeCost,
  listConversations,
  loadConversation,
  renameConversation,
  selectionOf,
  toAttachment,
  useAiStatus,
  weightValue,
  type AiStatus,
} from "@/lib/ai";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AiDiffDialog } from "./ai-diff-dialog";
import { Markdown } from "@/components/markdown";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

/*
 * The AI assistant's pane in the editor (platforms/cloud/docs/cloud-ai-assistant.md),
 * a chat like the big ones: conversations the server keeps, the model's
 * thinking as it streams (folded away once it answers), the tools it uses
 * with live progress while it writes a file, edit-and-resend, regenerate,
 * continue after a cut-off answer, and images or documents to attach.
 * File changes arrive as a proposal the teacher reviews; until they decide,
 * follow-ups build on it.
 */

type Effort = "auto" | "low" | "medium" | "high";

/** A message in the chat; an answer grows while it streams. */
type Turn = {
  /** Stable across the server id arriving. */
  key: string;
  /** The server's id; null until the stream reports it. */
  id: number | null;
  role: "user" | "assistant";
  content: string;
  attachments: AiMessageView["attachments"];
  /** Thinking, tool steps and text, in the order they happened. */
  parts: AiAnswerPart[];
  /** A tool call whose arguments are streaming in right now. */
  writing: { name: string; path: string | null; chars: number } | null;
  proposal: AiProposedChange[] | null;
  proposalStatus: AiProposalStatus | null;
  finish: string | null;
  error: string | null;
  credits: number | null;
  durationMs: number | null;
  streaming: boolean;
};

let keys = 0;
const nextKey = () => `turn-${++keys}`;

function fromView(message: AiMessageView): Turn {
  return {
    key: nextKey(),
    id: message.id,
    role: message.role,
    content: message.content,
    attachments: message.attachments,
    parts: message.parts,
    writing: null,
    proposal: message.proposal,
    proposalStatus: message.proposalStatus,
    finish: message.finish,
    error: message.error,
    credits: message.credits,
    durationMs: message.durationMs,
    streaming: false,
  };
}

function blankAnswer(): Turn {
  return {
    key: nextKey(),
    id: null,
    role: "assistant",
    content: "",
    attachments: [],
    parts: [],
    writing: null,
    proposal: null,
    proposalStatus: null,
    finish: null,
    error: null,
    credits: null,
    durationMs: null,
    streaming: true,
  };
}

/** The conversation last open in a book, per browser — a convenience only. */
function rememberedConversation(bookId: number): number | null {
  try {
    const value = Number(localStorage.getItem(`hyperbook.ai.conversation.${bookId}`));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function remember(bookId: number, id: number | null) {
  try {
    const key = `hyperbook.ai.conversation.${bookId}`;
    if (id === null) localStorage.removeItem(key);
    else localStorage.setItem(key, String(id));
  } catch {
    // Storage blocked: the panel simply opens a new chat next time.
  }
}

export function AiPanel({
  bookId,
  activePath,
  getViewOf,
  isTabOpen,
  isTabDirty,
  closeTab,
  reloadTab,
  commit,
  request = null,
  onRequestTaken,
}: {
  bookId: number;
  /** The open file; null when no text file is open. */
  activePath: string | null;
  /** Any open tab's editor by path, read at action time, not while typing. */
  getViewOf: (path: string) => EditorView | null;
  isTabOpen: (path: string) => boolean;
  isTabDirty: (path: string) => boolean;
  closeTab: (path: string) => void;
  reloadTab: (path: string) => Promise<void>;
  commit: (changes: FileChange[], message?: string) => Promise<unknown>;
  /** A question from elsewhere ("Explain with AI" on an error), asked in a new chat. */
  request?: { id: number; text: string } | null;
  /** The request was asked; it must not be asked again. */
  onRequestTaken?: () => void;
}) {
  const { t } = useTranslation();
  const status = useAiStatus();
  const queryClient = useQueryClient();
  const conversations = useQuery({
    queryKey: ["ai-conversations", bookId],
    queryFn: () => listConversations(bookId),
  });
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<AiAttachment[]>([]);
  const [attaching, setAttaching] = useState(false);
  /** The model the teacher picked; null: the instance's default. */
  const [model, setModel] = useState<string | null>(null);
  const [effort, setEffort] = useState<Effort>("auto");
  /** The turn whose proposal's diff dialog is open. */
  const [reviewing, setReviewing] = useState<string | null>(null);
  /** The user turn being edited, and its new text. */
  const [editing, setEditing] = useState<{ key: string; text: string } | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const stop = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /** Whether the list follows new text: only while the teacher is at the bottom. */
  const following = useRef(true);
  const turnsRef = useRef(turns);
  turnsRef.current = turns;

  // The conversation last open in this book comes back after a reload —
  // unless the panel opened for a question of its own.
  useEffect(() => {
    if (request) return;
    const remembered = rememberedConversation(bookId);
    if (remembered !== null) void open(remembered, { quiet: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  // A question from elsewhere: asked in a new chat, once the current answer is done.
  useEffect(() => {
    if (!request || streaming) return;
    onRequestTaken?.();
    newChat();
    void run(request.text, { fresh: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.id, streaming]);

  useEffect(() => {
    const el = listRef.current;
    if (el && following.current) el.scrollTop = el.scrollHeight;
  }, [turns]);

  /** Updates one turn by key. */
  function patch(key: string, change: (turn: Turn) => Partial<Turn>) {
    setTurns((all) =>
      all.map((turn) => (turn.key === key ? { ...turn, ...change(turn) } : turn)),
    );
  }

  /**
   * Leaving a conversation stops its running answer, like switching chats
   * does elsewhere; the server keeps what was written so far.
   */
  function leave() {
    stop.current?.abort();
  }

  async function open(id: number, { quiet = false } = {}) {
    if (id === conversationId && turns.length > 0) return;
    leave();
    try {
      const conversation = await loadConversation(bookId, id);
      setConversationId(conversation.id);
      setTitle(conversation.title);
      setTurns(conversation.messages.map(fromView));
      setReviewing(null);
      setEditing(null);
      following.current = true;
      remember(bookId, conversation.id);
    } catch {
      remember(bookId, null);
      if (!quiet) toast.error(t("editor.ai.loadFailed"));
    }
  }

  function newChat() {
    leave();
    setConversationId(null);
    setTitle(null);
    setTurns([]);
    setReviewing(null);
    setEditing(null);
    remember(bookId, null);
  }

  async function removeConversation(id: number) {
    await deleteConversation(bookId, id);
    if (id === conversationId) newChat();
    void queryClient.invalidateQueries({ queryKey: ["ai-conversations", bookId] });
    toast.success(t("editor.ai.conversationDeleted"));
  }

  async function saveTitle() {
    const next = renaming?.trim();
    setRenaming(null);
    if (!next || conversationId === null || next === title) return;
    setTitle(next);
    await renameConversation(bookId, conversationId, next);
    void queryClient.invalidateQueries({ queryKey: ["ai-conversations", bookId] });
  }

  async function attach(files: Iterable<File>) {
    const list = [...files];
    if (list.length === 0) return;
    setAttaching(true);
    try {
      const added: AiAttachment[] = [];
      for (const file of list) {
        if (attachments.length + added.length >= AI_ATTACHMENTS_MAX) {
          toast.error(t("editor.ai.attachLimit", { count: AI_ATTACHMENTS_MAX }));
          break;
        }
        if (!attachable(file)) {
          toast.error(t("editor.ai.attachUnsupported", { name: file.name }));
          continue;
        }
        try {
          added.push(await toAttachment(file));
        } catch (error) {
          toast.error(error instanceof Error ? error.message : String(error));
        }
      }
      setAttachments((all) => [...all, ...added]);
    } finally {
      setAttaching(false);
    }
  }

  /**
   * Sends a message; the selection and the open page go along. With
   * `replaceFrom`, that user message and everything after it are replaced
   * (edit and resend, regenerate).
   */
  async function run(
    text: string,
    {
      replaceFrom,
      files,
      fresh = false,
    }: { replaceFrom?: Turn; files?: AiAttachment[]; fresh?: boolean } = {},
  ) {
    const view = activePath ? getViewOf(activePath) : null;
    if (!view || !activePath) {
      toast.error(t("editor.ai.openFileFirst"));
      return;
    }
    if (streaming) return;
    const selection = selectionOf(view);
    const document = view.state.doc.toString();
    setTarget(activePath);
    const input: AiAssistInput = {
      prompt: text,
      model: model ?? undefined,
      pagePath: activePath,
      selection: selection?.text || undefined,
      context: contextOf(view),
      // The whole page, so the assistant may rewrite it — only when it fits;
      // a truncated page must never reach a write_file, or content would go.
      pageText: document.length <= 128 * 1024 ? document : undefined,
      // A new chat's first question, even before its state has settled.
      conversationId: fresh ? undefined : (conversationId ?? undefined),
      replaceFrom: replaceFrom?.id ?? undefined,
      // Omitted on a resend without new files: the server keeps the old ones.
      attachments: files,
      reasoningEffort: effort === "auto" ? undefined : effort,
    };

    const controller = new AbortController();
    stop.current = controller;
    const question: Turn = {
      ...blankAnswer(),
      role: "user",
      content: text,
      streaming: false,
      attachments: (files ?? replaceFrom?.attachments ?? []).map((a) =>
        a.kind === "image"
          ? { kind: "image" as const, name: a.name, data: a.data }
          : { kind: "text" as const, name: a.name },
      ),
    };
    const answer = blankAnswer();
    setTurns((all) => {
      const cut = replaceFrom ? all.findIndex((x) => x.key === replaceFrom.key) : -1;
      return [...(cut === -1 ? all : all.slice(0, cut)), question, answer];
    });
    setPrompt("");
    setAttachments([]);
    setEditing(null);
    setReviewing(null);
    setStreaming(true);
    following.current = true;
    const started = Date.now();
    // Thinking ends with the next part — or a tool call starting to stream.
    const endThinking = (turn: Turn) => ({ parts: closeParts(turn.parts) });
    let ended = false;
    try {
      await assist(
        bookId,
        input,
        (event) => {
          switch (event.event) {
            case "conversation":
              setConversationId(event.id);
              setTitle(event.title);
              remember(bookId, event.id);
              patch(question.key, () => ({ id: event.userMessageId }));
              void queryClient.invalidateQueries({ queryKey: ["ai-conversations", bookId] });
              break;
            case "reasoning":
              patch(answer.key, (turn) => ({
                parts: addPart(turn.parts, { kind: "thinking", text: event.text }),
              }));
              break;
            case "delta":
              patch(answer.key, (turn) => ({
                content: turn.content + event.text,
                parts: addPart(turn.parts, { kind: "text", text: event.text }),
                writing: null,
              }));
              break;
            case "toolProgress":
              patch(answer.key, (turn) => ({
                writing: { name: event.name, path: event.path, chars: event.chars },
                ...endThinking(turn),
              }));
              break;
            case "tool":
              patch(answer.key, (turn) => ({
                parts: addPart(turn.parts, {
                  kind: "tool",
                  name: event.name,
                  detail: event.detail,
                }),
                writing: null,
              }));
              break;
            case "usage":
              queryClient.setQueryData<AiStatus>(["ai-status"], (old) =>
                old ? { ...old, tokensUsedThisWeek: event.tokensUsedThisWeek } : old,
              );
              break;
            case "proposal":
              // It holds every change still pending; earlier ones are in it.
              setTurns((all) =>
                all.map((turn) =>
                  turn.key === answer.key
                    ? { ...turn, proposal: event.changes, proposalStatus: "pending" }
                    : turn.proposalStatus === "pending"
                      ? { ...turn, proposalStatus: "superseded" }
                      : turn,
                ),
              );
              setReviewing(answer.key);
              break;
            case "done":
              ended = true;
              patch(answer.key, (turn) => ({
                id: event.messageId ?? turn.id,
                finish: event.finish,
                credits: event.usage?.credits ?? null,
                durationMs: event.durationMs ?? Date.now() - started,
                streaming: false,
                writing: null,
                ...endThinking(turn),
              }));
              break;
            case "saved":
              patch(answer.key, () => ({ id: event.messageId }));
              break;
            case "error":
              ended = true;
              patch(answer.key, (turn) => ({
                finish: "error",
                error: event.message,
                streaming: false,
                writing: null,
                durationMs: Date.now() - started,
                ...endThinking(turn),
              }));
              break;
          }
        },
        controller.signal,
      );
    } catch (error) {
      ended = true;
      const aborted = error instanceof DOMException && error.name === "AbortError";
      patch(answer.key, (turn) => ({
        finish: aborted ? "aborted" : "error",
        error: aborted ? null : error instanceof Error ? error.message : String(error),
        streaming: false,
        writing: null,
        durationMs: Date.now() - started,
        ...endThinking(turn),
      }));
    } finally {
      if (!ended) patch(answer.key, () => ({ streaming: false, writing: null }));
      stop.current = null;
      setStreaming(false);
      // The day's counter changed; the quota line follows.
      void queryClient.invalidateQueries({ queryKey: ["ai-status"] });
      void queryClient.invalidateQueries({ queryKey: ["ai-conversations", bookId] });
    }
  }

  /** The teacher's message an answer replies to. */
  function questionOf(answer: Turn): Turn | null {
    const index = turnsRef.current.findIndex((turn) => turn.key === answer.key);
    for (let i = index - 1; i >= 0; i--) {
      const turn = turnsRef.current[i]!;
      if (turn.role === "user") return turn;
    }
    return null;
  }

  function regenerate(answer: Turn) {
    const question = questionOf(answer);
    if (!question || question.id === null) return;
    void run(question.content, { replaceFrom: question });
  }

  /**
   * Applies the accepted subset of a proposal: a write to a file that is
   * open in a tab goes into that tab's buffer (undoable, unsaved until the
   * teacher saves) — but only when the buffer still is what the proposal
   * diffed against, so unsaved edits are never overwritten silently.
   * Everything else becomes one ordinary commit through the same endpoint
   * the editor saves with — so quotas, the hyperbook.json check and
   * conflict detection apply, and a 409 changes nothing.
   */
  async function applyProposal(turn: Turn, accepted: AiProposedChange[]) {
    setReviewing(null);
    const decide = (status: "applied" | "denied") => {
      patch(turn.key, () => ({ proposalStatus: status }));
      if (conversationId !== null && turn.id !== null)
        void decideProposal(bookId, conversationId, turn.id, status).catch(() => {});
    };
    if (accepted.length === 0) {
      decide("denied");
      toast.info(t("editor.ai.denied"));
      return;
    }
    // Write changes only: they go into a tab's buffer, never a delete.
    const locally: Extract<AiProposedChange, { op: "write" }>[] = [];
    const asCommit: AiProposedChange[] = [];
    const blocked: string[] = [];
    for (const change of accepted) {
      if (change.op !== "write") {
        if (isTabOpen(change.path) && isTabDirty(change.path)) {
          blocked.push(change.path);
          continue;
        }
        asCommit.push(change);
        continue;
      }
      const view = getViewOf(change.path);
      if (!view) {
        asCommit.push(change);
        continue;
      }
      const doc = view.state.doc.toString();
      if (change.oldText === null ? doc !== "" : doc !== change.oldText) {
        blocked.push(change.path);
        continue;
      }
      locally.push(change);
    }
    if (blocked.length > 0) {
      toast.error(t("editor.ai.pageChanged", { files: blocked.join(", ") }));
    }
    const applied = [...asCommit, ...locally];
    try {
      if (asCommit.length > 0) {
        const changes: FileChange[] = asCommit.map((change) =>
          change.op === "write"
            ? {
                op: "write",
                path: change.path,
                content: change.newText,
                encoding: "utf8",
                baseOid: change.baseOid,
              }
            : { op: "delete", path: change.path, baseOid: change.baseOid },
        );
        const paths = asCommit.map((change) => change.path);
        const message = `AI: ${paths.slice(0, 5).join(", ")}${paths.length > 5 ? " …" : ""}`;
        await commit(changes, message);
      }
      const changedDuringCommit: string[] = [];
      for (const change of locally) {
        const view = getViewOf(change.path);
        if (
          !view ||
          (change.oldText === null
            ? view.state.doc.length !== 0
            : view.state.doc.toString() !== change.oldText)
        ) {
          changedDuringCommit.push(change.path);
          continue;
        }
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: change.newText },
        });
      }
      for (const change of asCommit) {
        if (!isTabOpen(change.path)) continue;
        if (change.op === "delete") {
          if (isTabDirty(change.path)) changedDuringCommit.push(change.path);
          else closeTab(change.path);
        } else if (isTabDirty(change.path)) {
          changedDuringCommit.push(change.path);
        } else {
          void reloadTab(change.path);
        }
      }
      if (changedDuringCommit.length > 0) {
        toast.error(
          t("editor.ai.pageChanged", { files: [...new Set(changedDuringCommit)].join(", ") }),
        );
      }
      if (applied.length > 0) {
        decide("applied");
        toast.success(t("editor.ai.applied"));
      }
    } catch (error) {
      if (error instanceof ConflictError) {
        toast.error(t("editor.ai.conflict"));
      } else {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    }
  }

  const quotaBadge =
    status.data && status.data.enabled && status.data.allowed ? (
      <Badge
        variant="secondary"
        className="text-xs font-normal text-muted-foreground"
        title={t("editor.ai.requestsTitle")}
      >
        {status.data.quota === null
          ? t("editor.ai.requestsUnlimited", { used: status.data.usedToday })
          : t("editor.ai.requests", { used: status.data.usedToday, limit: status.data.quota })}
      </Badge>
    ) : null;

  const credits = status.data && status.data.enabled && status.data.allowed ? status.data : null;
  /** The cheapest model's cost — the ×1 the other models are shown against. */
  const cheapestModelCost = status.data
    ? Math.min(...status.data.models.map((m) => weightValue(status.data?.modelWeights[m])))
    : 1;
  const creditsBar =
    credits && credits.tokenQuota !== null && credits.tokenQuota > 0 ? (
      <div className="w-full space-y-1" title={t("editor.ai.creditsTitle", { date: credits.tokensResetOn })}>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={
              "h-full rounded-full " +
              (credits.tokensUsedThisWeek / credits.tokenQuota >= 0.9
                ? "bg-destructive"
                : credits.tokensUsedThisWeek / credits.tokenQuota >= 0.75
                  ? "bg-amber-500"
                  : "bg-primary")
            }
            style={{
              width: `${Math.min(100, (credits.tokensUsedThisWeek / credits.tokenQuota) * 100)}%`,
            }}
          />
        </div>
        <div className="text-xs text-muted-foreground">
          {t("editor.ai.credits", {
            left: Math.max(0, credits.tokenQuota - credits.tokensUsedThisWeek).toLocaleString(),
            limit: credits.tokenQuota.toLocaleString(),
          })}
        </div>
      </div>
    ) : credits ? (
      <div className="text-xs text-muted-foreground" title={t("editor.ai.creditsTitle", { date: credits.tokensResetOn })}>
        {t("editor.ai.creditsUsed", { used: credits.tokensUsedThisWeek.toLocaleString() })}
      </div>
    ) : null;

  const lastAnswer = [...turns].reverse().find((turn) => turn.role === "assistant");
  const reviewTurn = turns.find((turn) => turn.key === reviewing) ?? null;

  return (
    <div
      className="flex h-full flex-col gap-2 p-3 text-sm"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files.length === 0) return;
        e.preventDefault();
        void attach(e.dataTransfer.files);
      }}
    >
      <div className="flex items-center gap-1">
        <SparklesIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        {renaming !== null ? (
          <Input
            autoFocus
            value={renaming}
            aria-label={t("editor.ai.renameConversation")}
            className="h-6 min-w-0 flex-1 px-1 text-sm"
            onChange={(e) => setRenaming(e.target.value)}
            onBlur={() => void saveTitle()}
            onKeyDown={(e) => {
              if (e.key === "Enter") void saveTitle();
              if (e.key === "Escape") setRenaming(null);
            }}
          />
        ) : (
          <button
            type="button"
            className="min-w-0 truncate text-left font-medium"
            title={title ? t("editor.ai.renameConversation") : undefined}
            disabled={title === null}
            onDoubleClick={() => title && setRenaming(title)}
          >
            {title ?? t("editor.ai.title")}
          </button>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label={t("editor.ai.conversations")}
                title={t("editor.ai.conversations")}
                
              >
                <HistoryIcon className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-96 w-72 overflow-auto">
              <DropdownMenuLabel>{t("editor.ai.conversations")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(conversations.data ?? []).length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  {t("editor.ai.noConversations")}
                </p>
              ) : (
                (conversations.data ?? []).map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    className={cn("group gap-2", c.id === conversationId && "bg-accent")}
                    onSelect={() => void open(c.id)}
                  >
                    <span className="min-w-0 flex-1 truncate">{c.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(c.updatedAt).toLocaleDateString()}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                      aria-label={t("editor.ai.deleteConversation")}
                      title={t("editor.ai.deleteConversation")}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        void removeConversation(c.id);
                      }}
                    >
                      <Trash2Icon className="size-3.5" aria-hidden />
                    </button>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label={t("editor.ai.newChat")}
            title={t("editor.ai.newChat")}
            onClick={newChat}
          >
            <PlusIcon className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {status.data && status.data.models.length > 1 ? (
          <Select value={model ?? status.data.model ?? undefined} onValueChange={setModel}>
            <SelectTrigger size="sm" className="h-6 w-auto px-2 text-xs" aria-label={t("editor.ai.modelLabel")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[...status.data.models]
                // Cheapest first: by cost, ties by the name teachers see —
                // the label, else the id.
                .sort((a, b) => {
                  const byCost =
                    weightValue(status.data?.modelWeights[a]) - weightValue(status.data?.modelWeights[b]);
                  return byCost !== 0
                    ? byCost
                    : (status.data?.modelLabels[a] || a).localeCompare(status.data?.modelLabels[b] || b);
                })
                .map((name) => (
                  <SelectItem key={name} value={name}>
                    {t("editor.ai.modelCost", {
                      model: status.data?.modelLabels[name] || name,
                      cost: formatRelativeCost(status.data?.modelWeights[name], cheapestModelCost),
                    })}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        ) : (
          status.data?.model && (
            <span className="truncate text-xs text-muted-foreground">
              {t("editor.ai.model", { model: status.data.modelLabels[status.data.model] || status.data.model })}
            </span>
          )
        )}
        {quotaBadge}
      </div>
      {creditsBar}

      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-4 overflow-auto pr-1"
        onScroll={(e) => {
          const el = e.currentTarget;
          following.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
      >
        {turns.length === 0 && <p className="text-xs text-muted-foreground">{t("editor.ai.hint")}</p>}
        {turns.map((turn) =>
          turn.role === "user" ? (
            <UserMessage
              key={turn.key}
              turn={turn}
              editing={editing?.key === turn.key ? editing.text : null}
              canEdit={!streaming && turn.id !== null && conversationId !== null}
              onEdit={() => setEditing({ key: turn.key, text: turn.content })}
              onChange={(text) => setEditing({ key: turn.key, text })}
              onCancel={() => setEditing(null)}
              onSend={() => {
                const text = editing?.text.trim();
                if (text) void run(text, { replaceFrom: turn });
              }}
            />
          ) : (
            <AssistantMessage
              key={turn.key}
              turn={turn}
              isLast={turn.key === lastAnswer?.key}
              busy={streaming}
              onRegenerate={() => regenerate(turn)}
              onContinue={() => void run(t("editor.ai.continuePrompt"))}
              onReview={() => setReviewing(turn.key)}
            />
          ),
        )}
      </div>

      {activePath && (
        <div
          className="rounded-lg border bg-background focus-within:ring-1 focus-within:ring-ring"
        >
          {(attachments.length > 0 || attaching) && (
            <div className="flex flex-wrap gap-1 border-b p-1.5">
              {attachments.map((a, i) => (
                <AttachmentChip
                  key={`${a.name}-${i}`}
                  attachment={a.kind === "image" ? a : { kind: "text", name: a.name }}
                  onRemove={() => setAttachments((all) => all.filter((_, j) => j !== i))}
                />
              ))}
              {attaching && <Loader2Icon className="m-1 size-4 animate-spin text-muted-foreground" aria-hidden />}
            </div>
          )}
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t("editor.ai.promptPlaceholder")}
            aria-label={t("editor.ai.title")}
            rows={2}
            className="max-h-48 min-h-0 resize-none border-0 text-sm shadow-none focus-visible:ring-0 field-sizing-content"
            onPaste={(e) => {
              const files = [...e.clipboardData.files];
              if (files.length > 0) {
                e.preventDefault();
                void attach(files);
              }
            }}
            onKeyDown={(e) => {
              // isComposing: an IME candidate confirmation is not a send.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && prompt.trim()) {
                e.preventDefault();
                if (!streaming && !attaching) void run(prompt.trim(), { files: attachments });
              }
            }}
          />
          <div className="flex items-center gap-1 px-1.5 pt-1 pb-1.5">
            <input
              ref={fileRef}
              type="file"
              multiple
              hidden
              accept="image/*,application/pdf,.md,.txt,.typ,.csv,.json,.yaml,.yml,.html,.py,.java,.sql"
              onChange={(e) => {
                if (e.target.files) void attach(e.target.files);
                e.target.value = "";
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={t("editor.ai.attach")}
              title={t("editor.ai.attach")}
              disabled={attaching}
              onClick={() => fileRef.current?.click()}
            >
              <PaperclipIcon className="size-4" aria-hidden />
            </Button>
            <Select value={effort} onValueChange={(v) => setEffort(v as Effort)}>
              <SelectTrigger
                size="sm"
                className="h-7 w-auto cursor-pointer border-0 px-2 text-xs shadow-none hover:bg-accent dark:bg-transparent"
                aria-label={t("editor.ai.effortLabel")}
                title={t("editor.ai.effortHint")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">{t("editor.ai.effortAuto")}</SelectItem>
                <SelectItem value="low">{t("editor.ai.effortLow")}</SelectItem>
                <SelectItem value="medium">{t("editor.ai.effortMedium")}</SelectItem>
                <SelectItem value="high">{t("editor.ai.effortHigh")}</SelectItem>
              </SelectContent>
            </Select>
            {streaming ? (
              <Button
                size="icon"
                variant="outline"
                className="ml-auto size-7 rounded-full"
                aria-label={t("editor.ai.stop")}
                title={t("editor.ai.stop")}
                onClick={() => {
                  stop.current?.abort();
                  toast.info(t("editor.ai.stopped"));
                }}
              >
                <SquareIcon className="size-3 fill-current" aria-hidden />
              </Button>
            ) : (
              <Button
                size="icon"
                className="ml-auto size-7 rounded-full"
                aria-label={t("editor.ai.ask")}
                title={t("editor.ai.ask")}
                disabled={!prompt.trim() || attaching}
                onClick={() => void run(prompt.trim(), { files: attachments })}
              >
                <ArrowUpIcon className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      )}

      <AiDiffDialog
        bookId={bookId}
        changes={reviewTurn?.proposal ?? null}
        activePath={target ?? activePath}
        onClose={() => setReviewing(null)}
        onDone={(accepted) => reviewTurn && void applyProposal(reviewTurn, accepted)}
      />
    </div>
  );
}

/** The teacher's message, editable and resendable like in a chat. */
function UserMessage({
  turn,
  editing,
  canEdit,
  onEdit,
  onChange,
  onCancel,
  onSend,
}: {
  turn: Turn;
  editing: string | null;
  canEdit: boolean;
  onEdit: () => void;
  onChange: (text: string) => void;
  onCancel: () => void;
  onSend: () => void;
}) {
  const { t } = useTranslation();
  if (editing !== null) {
    return (
      <div className="space-y-1 rounded-lg border p-2">
        <Textarea
          autoFocus
          value={editing}
          aria-label={t("editor.ai.edit")}
          className="max-h-60 min-h-0 resize-none text-sm field-sizing-content"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              onSend();
            }
            if (e.key === "Escape") onCancel();
          }}
        />
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            {t("editor.ai.cancel")}
          </Button>
          <Button size="sm" disabled={!editing.trim()} onClick={onSend}>
            {t("editor.ai.send")}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="group space-y-1">
      {turn.attachments.length > 0 && (
        <div className="flex flex-wrap justify-end gap-1">
          {turn.attachments.map((a, i) => (
            <AttachmentChip key={`${a.name}-${i}`} attachment={a} />
          ))}
        </div>
      )}
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-lg rounded-br-sm bg-primary px-3 py-2 text-primary-foreground">
          {turn.content}
        </div>
      </div>
      <div className="flex justify-end gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
        <CopyButton text={turn.content} />
        {canEdit && (
          <Button
            size="icon-xs"
            variant="ghost"
            title={t("editor.ai.edit")}
            aria-label={t("editor.ai.edit")}
            onClick={onEdit}
          >
            <PencilIcon aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}

/** An answer: thinking, tool steps, text, and what can be done with it. */
function AssistantMessage({
  turn,
  isLast,
  busy,
  onRegenerate,
  onContinue,
  onReview,
}: {
  turn: Turn;
  isLast: boolean;
  busy: boolean;
  onRegenerate: () => void;
  onContinue: () => void;
  onReview: () => void;
}) {
  const { t } = useTranslation();
  const idle = turn.streaming && turn.parts.length === 0 && !turn.writing;
  // Tool steps that follow each other form one list; thinking and text
  // break it, so the answer reads in the order it happened.
  type ToolPart = Extract<AiAnswerPart, { kind: "tool" }>;
  const groups: (Exclude<AiAnswerPart, ToolPart> | { kind: "tools"; tools: ToolPart[] })[] = [];
  for (const part of turn.parts) {
    const last = groups.at(-1);
    if (part.kind === "tool" && last?.kind === "tools") last.tools.push(part);
    else if (part.kind === "tool") groups.push({ kind: "tools", tools: [part] });
    else groups.push(part);
  }
  const lastPart = turn.parts.at(-1);
  return (
    <div className="space-y-1.5">
      {groups.map((group, i) => {
        const isLastGroup = i === groups.length - 1;
        if (group.kind === "thinking")
          return (
            <Thinking
              key={i}
              part={group}
              active={turn.streaming && isLastGroup && group.ms === null}
            />
          );
        if (group.kind === "text")
          return (
            <div key={i} className="rounded-lg rounded-bl-sm bg-muted px-3 py-2">
              <Markdown text={group.text} className="ai-markdown break-words" />
              {turn.streaming && isLastGroup && !turn.writing && (
                <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-foreground/60 align-middle" aria-hidden />
              )}
            </div>
          );
        return (
          <ul key={i} className="space-y-0.5 text-xs text-muted-foreground">
            {group.tools.map((tool, j) => (
              <li key={j} className="flex min-w-0 items-center gap-1.5">
                <ToolIcon name={tool.name} />
                <span className="truncate" title={tool.detail ?? undefined}>
                  {toolLabel(t, tool.name, tool.detail)}
                </span>
              </li>
            ))}
          </ul>
        );
      })}
      {turn.writing && (
        <p className="flex min-w-0 items-center gap-1.5 text-xs">
          <Loader2Icon className="size-3.5 shrink-0 animate-spin" aria-hidden />
          <span className="truncate" title={turn.writing.path ?? undefined}>
            {t("editor.ai.writingProgress", {
              what: toolLabel(t, turn.writing.name, turn.writing.path),
              size: formatSize(turn.writing.chars),
            })}
          </span>
        </p>
      )}
      {(idle || (turn.streaming && !turn.writing && lastPart?.kind === "tool")) && (
        <p className="flex items-center gap-2 text-muted-foreground">
          <span className="inline-block size-2 animate-pulse rounded-full bg-primary" aria-hidden />
          {t("editor.ai.working")}
        </p>
      )}
      {turn.error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-destructive">
          {turn.error}
        </p>
      )}
      {!turn.streaming && turn.finish === "aborted" && (
        <p className="text-xs text-muted-foreground">{t("editor.ai.stopped")}</p>
      )}
      {!turn.streaming && (turn.finish === "length" || turn.finish === "steps") && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{t(turn.finish === "length" ? "editor.ai.finishLength" : "editor.ai.finishSteps")}</span>
          {isLast && (
            <Button size="sm" variant="outline" className="h-6" disabled={busy} onClick={onContinue}>
              {t("editor.ai.continue")}
            </Button>
          )}
        </div>
      )}
      {turn.proposal && turn.proposal.length > 0 && (
        <ProposalLine turn={turn} onReview={onReview} />
      )}
      {!turn.streaming && (
        <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
          {turn.content && <CopyButton text={turn.content} />}
          {isLast && (
            <Button
              size="icon-xs"
              variant="ghost"
              title={turn.finish === "error" ? t("editor.ai.retry") : t("editor.ai.regenerate")}
              aria-label={turn.finish === "error" ? t("editor.ai.retry") : t("editor.ai.regenerate")}
              disabled={busy || turn.id === null}
              onClick={onRegenerate}
            >
              <RotateCwIcon aria-hidden />
            </Button>
          )}
          {(turn.credits !== null || turn.durationMs !== null) && (
            <span className="ml-1">
              {[
                turn.credits !== null ? t("editor.ai.answerCredits", { credits: turn.credits.toLocaleString() }) : null,
                turn.durationMs !== null ? t("editor.ai.answerSeconds", { seconds: Math.max(1, Math.round(turn.durationMs / 1000)) }) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** One stretch of the model's thinking: open while it thinks, folded after. */
function Thinking({
  part,
  active,
}: {
  part: Extract<AiAnswerPart, { kind: "thinking" }>;
  active: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<boolean | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = boxRef.current;
    if (el && active) el.scrollTop = el.scrollHeight;
  }, [part.text, active]);
  const expanded = open ?? active;
  const ms = part.ms ?? (part.startedAt !== null ? now - part.startedAt : null);
  const seconds = ms !== null ? Math.max(1, Math.round(ms / 1000)) : null;
  const label = active
    ? t("editor.ai.thinking", { seconds: seconds ?? 0 })
    : seconds !== null
      ? t("editor.ai.thought", { seconds })
      : t("editor.ai.thoughts");
  return (
    <div className="text-xs">
      <button
        type="button"
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
        aria-expanded={expanded}
        onClick={() => setOpen(!expanded)}
      >
        <ChevronRightIcon className={cn("size-3.5 transition-transform", expanded && "rotate-90")} aria-hidden />
        <span className={cn(active && "animate-pulse")}>{label}</span>
      </button>
      {expanded && (
        <div
          ref={boxRef}
          className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap border-l-2 pl-2 text-muted-foreground"
        >
          {part.text}
        </div>
      )}
    </div>
  );
}

function ProposalLine({ turn, onReview }: { turn: Turn; onReview: () => void }) {
  const { t } = useTranslation();
  const count = turn.proposal?.length ?? 0;
  if (turn.proposalStatus === "pending") {
    return (
      <Button size="sm" variant="outline" className="h-7" onClick={onReview}>
        <FilePenIcon className="size-3.5" aria-hidden />
        {t("editor.ai.reviewChanges", { count })}
      </Button>
    );
  }
  const label =
    turn.proposalStatus === "applied"
      ? t("editor.ai.proposalApplied", { count })
      : turn.proposalStatus === "denied"
        ? t("editor.ai.proposalDenied", { count })
        : t("editor.ai.proposalSuperseded", { count });
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <FilePenIcon className="size-3.5" aria-hidden />
      {label}
    </p>
  );
}

function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: { kind: "image" | "text"; name: string; data?: string };
  onRemove?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md border bg-muted/50 py-0.5 pr-1 pl-0.5 text-xs">
      {attachment.kind === "image" && attachment.data ? (
        <img src={attachment.data} alt="" className="size-6 rounded object-cover" />
      ) : attachment.kind === "image" ? (
        <ImageIcon className="size-4 text-muted-foreground" aria-hidden />
      ) : (
        <FileIcon className="size-4 text-muted-foreground" aria-hidden />
      )}
      <span className="max-w-40 truncate" title={attachment.name}>
        {attachment.name}
      </span>
      {onRemove && (
        <button
          type="button"
          className="rounded text-muted-foreground hover:text-foreground"
          aria-label={t("editor.ai.removeAttachment", { name: attachment.name })}
          onClick={onRemove}
        >
          <XIcon className="size-3.5" aria-hidden />
        </button>
      )}
    </span>
  );
}

function ToolIcon({ name }: { name: string }) {
  const className = "size-3.5 shrink-0";
  switch (name) {
    case "search_files":
      return <SearchIcon className={className} aria-hidden />;
    case "list_files":
      return <FolderTreeIcon className={className} aria-hidden />;
    case "read_docs":
      return <BookOpenIcon className={className} aria-hidden />;
    case "edit_file":
    case "write_file":
    case "rename_file":
    case "delete_file":
      return <FilePenIcon className={className} aria-hidden />;
    default:
      return <FileIcon className={className} aria-hidden />;
  }
}

const TOOL_LABELS = new Set([
  "read_files",
  "read_file",
  "search_files",
  "list_files",
  "read_docs",
  "edit_file",
  "write_file",
  "rename_file",
  "delete_file",
]);

/** "Reads book/a.md", "Searches “KQ1”" — a tool step in the teacher's words. */
function toolLabel(
  t: ReturnType<typeof useTranslation>["t"],
  name: string,
  detail: string | null,
): string {
  const key = name === "read_file" ? "read_files" : name;
  if (!TOOL_LABELS.has(key)) return detail ? `${name} ${detail}` : name;
  // File names, not paths: the narrow pane would cut off the rest of the
  // line. The full detail is the line's tooltip.
  const short =
    detail && key !== "search_files" && key !== "read_docs"
      ? detail.replace(/[^\s,→]*\//g, "")
      : detail;
  return t(`editor.ai.tools.${key}` as "editor.ai.tools.read_files", {
    detail: short ?? "…",
  });
}

function formatSize(chars: number): string {
  return chars < 1024 ? `${chars} B` : `${(chars / 1024).toFixed(1)} KB`;
}

/** A small copy button under a chat message. */
function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation();
  return (
    <Button
      size="icon-xs"
      variant="ghost"
      title={t("editor.ai.copy")}
      aria-label={t("editor.ai.copy")}
      onClick={() =>
        void copyText(text).then((ok) =>
          ok ? toast.success(t("editor.ai.copied")) : toast.error(t("common.copyFailed")),
        )
      }
    >
      <CopyIcon aria-hidden />
    </Button>
  );
}
