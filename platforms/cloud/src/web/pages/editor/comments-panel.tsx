import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, MessageSquareIcon, RotateCcwIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, unwrap } from "@/lib/api";
import { cn } from "@/lib/utils";

/*
 * The editor's Comments pane (docs/cloud-platform.md, M7): the threads of
 * the open file or of the whole book, a box for a new thread on the
 * selection, replies, suggestions, and resolving. Threads are polled while
 * the editor is open, so other people's comments show up.
 */

const fetchThreads = (bookId: string) =>
  unwrap(api.books[":id"].comments.$get({ param: { id: bookId }, query: {} }));

export type Thread = Awaited<ReturnType<typeof fetchThreads>>["threads"][number];
export type ThreadComment = Thread["comments"][number];

export const threadsKey = (bookId: string) => ["books", bookId, "comments"];

/** Every thread of the book, refreshed every 20 seconds and on focus. */
export function useThreads(bookId: string) {
  return useQuery({
    queryKey: threadsKey(bookId),
    queryFn: () => fetchThreads(bookId),
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
    select: (data) => data.threads,
  });
}

/** Open threads that are still in their file, by path: the file tree's badges. */
export function openCounts(threads: Thread[] | undefined): Map<string, number> {
  const counts = new Map<string, number>();
  for (const thread of threads ?? []) {
    if (thread.status !== "open" || thread.outdated) continue;
    counts.set(thread.path, (counts.get(thread.path) ?? 0) + 1);
  }
  return counts;
}

/** A new thread being written: the selection it is about, in the saved text. */
export type Draft = { path: string; oid: string; from: number; to: number; quote: string };

const errorText = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

export function CommentsPanel({
  bookId,
  threads,
  activePath,
  activeThread,
  canEdit,
  draft,
  onDraftDone,
  onSelect,
  onApply,
}: {
  bookId: string;
  threads: Thread[];
  activePath: string | null;
  activeThread: number | null;
  /** Editors and owners: they apply suggestions. */
  canEdit: boolean;
  draft: Draft | null;
  onDraftDone: (threadId: number | null) => void;
  onSelect: (thread: Thread) => void;
  /** Applies a suggestion in the open file; false when its text changed. */
  onApply: (thread: Thread, comment: ThreadComment) => boolean;
}) {
  const { t } = useTranslation();
  const [scope, setScope] = useState<"file" | "book">("file");
  const [showResolved, setShowResolved] = useState(false);
  const inScope = threads.filter((th) => scope === "book" || th.path === activePath);
  const sorted = [...inScope].sort((a, b) => a.path.localeCompare(b.path) || a.from - b.from || a.id - b.id);
  const open = sorted.filter((th) => th.status === "open" && !th.outdated);
  const outdated = sorted.filter((th) => th.status === "open" && th.outdated);
  const resolved = sorted.filter((th) => th.status === "resolved");

  // A thread chosen in the code (or by a deep link) comes into view, and
  // its resolved or outdated group opens.
  useEffect(() => {
    if (activeThread === null) return;
    const thread = threads.find((th) => th.id === activeThread);
    if (thread?.status === "resolved") setShowResolved(true);
    if (thread && thread.path !== activePath) setScope("book");
    requestAnimationFrame(() =>
      document.getElementById(`thread-${activeThread}`)?.scrollIntoView({ block: "nearest" }),
    );
  }, [activeThread]); // eslint-disable-line react-hooks/exhaustive-deps

  const card = (thread: Thread) => (
    <ThreadCard
      key={thread.id}
      bookId={bookId}
      thread={thread}
      active={thread.id === activeThread}
      showPath={scope === "book"}
      // Suggestions apply in the open file's editor.
      canEdit={canEdit && thread.path === activePath}
      onSelect={() => onSelect(thread)}
      onApply={(comment) => onApply(thread, comment)}
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <MessageSquareIcon className="size-4" />
        <span className="text-sm font-medium">{t("comments.title")}</span>
        <span className="flex-1" />
        <div
          role="group"
          aria-label={t("comments.title")}
          className="flex overflow-hidden rounded-md border border-border"
        >
          {(["file", "book"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={scope === option}
              className={cn(
                "px-2 py-1 text-xs",
                scope === option ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent",
              )}
              onClick={() => setScope(option)}
            >
              {option === "file" ? t("comments.thisFile") : t("comments.allFiles")}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {draft && <NewThread bookId={bookId} draft={draft} onDone={onDraftDone} />}
        {open.map(card)}
        {open.length === 0 && !draft && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {scope === "book" ? t("comments.emptyAll") : activePath ? t("comments.empty") : t("comments.noFile")}
          </p>
        )}
        {outdated.length > 0 && (
          <>
            <h3 className="border-b border-border bg-sidebar px-3 pt-3 pb-1 text-xs font-medium text-muted-foreground">
              {t("comments.outdated")}
            </h3>
            {outdated.map(card)}
          </>
        )}
        {resolved.length > 0 && (
          <>
            <button
              type="button"
              className="w-full border-b border-border px-3 py-2 text-left text-xs text-muted-foreground hover:bg-accent"
              aria-expanded={showResolved}
              onClick={() => setShowResolved((v) => !v)}
            >
              {showResolved ? t("comments.hideResolved") : t("comments.resolvedCount", { count: resolved.length })}
            </button>
            {showResolved && resolved.map(card)}
          </>
        )}
      </div>
    </div>
  );
}

/** The box for a new thread on the selection. */
function NewThread({ bookId, draft, onDone }: { bookId: string; draft: Draft; onDone: (id: number | null) => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [suggest, setSuggest] = useState(false);
  const [suggestion, setSuggestion] = useState(draft.quote);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => box.current?.focus(), [draft]);

  const send = async () => {
    setBusy(true);
    try {
      const { threadId } = await unwrap(
        api.books[":id"].comments.$post({
          param: { id: bookId },
          json: {
            anchor: { path: draft.path, oid: draft.oid, from: draft.from, to: draft.to },
            body,
            suggestion: suggest ? suggestion : null,
          },
        }),
      );
      await queryClient.invalidateQueries({ queryKey: threadsKey(bookId) });
      onDone(threadId);
    } catch (error) {
      toast.error(errorText(error, t("common.somethingWrong")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-2 border-b border-border bg-primary/5 p-3">
      <Quote text={draft.quote} />
      <Textarea
        ref={box}
        value={body}
        maxLength={10_000}
        placeholder={t("comments.placeholder")}
        aria-label={t("comments.placeholder")}
        className="min-h-20 bg-background text-sm"
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && body.trim()) void send();
          if (e.key === "Escape") onDone(null);
        }}
      />
      <div className="flex items-center gap-2">
        <Checkbox id="comment-suggest" checked={suggest} onCheckedChange={(v) => setSuggest(v === true)} />
        <Label htmlFor="comment-suggest" className="text-sm font-normal">
          {t("comments.suggest")}
        </Label>
      </div>
      {suggest && (
        <Textarea
          value={suggestion}
          aria-label={t("comments.suggestionLabel")}
          className="min-h-16 bg-background font-mono text-xs"
          onChange={(e) => setSuggestion(e.target.value)}
        />
      )}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => onDone(null)}>
          {t("common.cancel")}
        </Button>
        <Button size="sm" disabled={busy || !body.trim()} onClick={() => void send()}>
          {t("comments.send")}
        </Button>
      </div>
    </div>
  );
}

function Quote({ text, className }: { text: string; className?: string }) {
  return (
    <blockquote
      className={cn(
        "line-clamp-3 border-l-2 border-amber-500 pl-2 font-mono text-xs whitespace-pre-wrap text-muted-foreground",
        className,
      )}
    >
      {text}
    </blockquote>
  );
}

const when = (ms: number) => new Date(ms).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });

function ThreadCard({
  bookId,
  thread,
  active,
  showPath,
  canEdit,
  onSelect,
  onApply,
}: {
  bookId: string;
  thread: Thread;
  active: boolean;
  showPath: boolean;
  canEdit: boolean;
  onSelect: () => void;
  onApply: (comment: ThreadComment) => boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const id = String(bookId);
  const threadId = String(thread.id);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: threadsKey(bookId) });
      return true;
    } catch (error) {
      toast.error(errorText(error, t("common.somethingWrong")));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    if (await run(() => unwrap(api.books[":id"].comments[":threadId"].replies.$post({ param: { id, threadId }, json: { body: reply } }))))
      setReply("");
  };

  return (
    <article
      id={`thread-${thread.id}`}
      className={cn(
        "grid gap-2 border-b border-border px-3 py-3 text-sm",
        active && "bg-amber-500/10",
        thread.status === "resolved" && "opacity-75",
      )}
      aria-label={t("comments.on", { path: thread.path })}
    >
      <button type="button" className="grid gap-1 text-left" title={t("comments.jump")} onClick={onSelect}>
        {showPath && <span className="truncate font-mono text-xs text-primary">{thread.path}</span>}
        <Quote text={thread.quote} className={cn(thread.outdated && "line-through")} />
        {thread.outdated && thread.status === "open" && (
          <span className="text-xs text-muted-foreground">{t("comments.outdatedHint")}</span>
        )}
      </button>
      {thread.comments.map((comment) => (
        <CommentItem
          key={comment.id}
          bookId={bookId}
          comment={comment}
          quote={thread.quote}
          canApply={canEdit && thread.status === "open" && !thread.outdated && comment.appliedAt === null}
          onApply={() => {
            if (!onApply(comment)) return toast.error(t("comments.applyChanged"));
            void run(() =>
              unwrap(
                api.books[":id"].comments.c[":commentId"].applied.$post({
                  param: { id, commentId: String(comment.id) },
                }),
              ),
            ).then((ok) => ok && toast.success(t("comments.appliedToast")));
          }}
        />
      ))}
      {thread.status === "resolved" ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckIcon className="size-3.5" aria-hidden />
          <span className="flex-1">{t("comments.resolvedBy", { name: thread.resolvedBy ?? "" })}</span>
          {thread.canResolve && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              disabled={busy}
              onClick={() =>
                void run(() => unwrap(api.books[":id"].comments[":threadId"].reopen.$post({ param: { id, threadId } })))
              }
            >
              <RotateCcwIcon className="size-3.5" aria-hidden />
              {t("comments.reopen")}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-2">
          <Textarea
            value={reply}
            maxLength={10_000}
            placeholder={t("comments.replyPlaceholder")}
            aria-label={t("comments.replyPlaceholder")}
            className="min-h-9 bg-background text-sm"
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && reply.trim()) void sendReply();
            }}
          />
          <div className="flex justify-end gap-2">
            {thread.canResolve && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                disabled={busy}
                onClick={() =>
                  void run(() => unwrap(api.books[":id"].comments[":threadId"].resolve.$post({ param: { id, threadId } })))
                }
              >
                <CheckIcon className="size-3.5" aria-hidden />
                {t("comments.resolve")}
              </Button>
            )}
            {reply.trim() && (
              <Button size="sm" className="h-7 px-2" disabled={busy} onClick={() => void sendReply()}>
                {t("comments.reply")}
              </Button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function CommentItem({
  bookId,
  comment,
  quote,
  canApply,
  onApply,
}: {
  bookId: string;
  comment: ThreadComment;
  quote: string;
  canApply: boolean;
  onApply: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const param = { id: bookId, commentId: String(comment.id) };

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: threadsKey(bookId) });
      return true;
    } catch (error) {
      toast.error(errorText(error, t("common.somethingWrong")));
      return false;
    }
  };

  if (comment.deleted) {
    return <p className="text-xs text-muted-foreground italic">{t("comments.deleted")}</p>;
  }
  return (
    <div className="grid gap-1">
      <div className="flex items-baseline gap-2 text-xs">
        <span className="font-medium">{comment.author}</span>
        {comment.mine && <span className="text-muted-foreground">({t("comments.you")})</span>}
        <span className="text-muted-foreground">
          {when(comment.createdAt)}
          {comment.editedAt !== null && ` · ${t("comments.edited")}`}
        </span>
        <span className="flex-1" />
        {comment.mine && editing === null && (
          <>
            <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setEditing(comment.body)}>
              {t("comments.edit")}
            </button>
            <button
              type="button"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => void run(() => unwrap(api.books[":id"].comments.c[":commentId"].$delete({ param })))}
            >
              {t("comments.delete")}
            </button>
          </>
        )}
      </div>
      {editing !== null ? (
        <div className="grid gap-2">
          <Textarea
            value={editing}
            maxLength={10_000}
            aria-label={t("comments.edit")}
            className="min-h-16 bg-background text-sm"
            onChange={(e) => setEditing(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditing(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              className="h-7 px-2"
              disabled={!editing.trim()}
              onClick={() =>
                void run(() =>
                  unwrap(api.books[":id"].comments.c[":commentId"].$patch({ param, json: { body: editing } })),
                ).then((ok) => ok && setEditing(null))
              }
            >
              {t("comments.save")}
            </Button>
          </div>
        </div>
      ) : (
        <Markdown text={comment.body} className="ai-markdown break-words" />
      )}
      {comment.suggestion !== null && (
        <div className="grid gap-1 rounded-md border border-border bg-background p-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex-1">{t("comments.suggestion")}</span>
            {comment.appliedAt !== null ? (
              <Badge variant="secondary">{t("comments.applied")}</Badge>
            ) : (
              canApply && (
                <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={onApply}>
                  {t("comments.apply")}
                </Button>
              )
            )}
          </div>
          <del className="font-mono text-xs whitespace-pre-wrap text-destructive/80">{quote}</del>
          <ins className="font-mono text-xs whitespace-pre-wrap text-primary no-underline">{comment.suggestion}</ins>
        </div>
      )}
    </div>
  );
}
