import type { EditorView } from "@codemirror/view";
import { CopyIcon, RotateCwIcon, SparklesIcon, StopCircleIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type {
  AiAssistInput,
  AiProposedChange,
  FileChange,
} from "../../../shared/schemas";
import { ConflictError } from "./workspace";
import {
  assist,
  contextOf,
  selectionOf,
  useAiStatus,
  type AiStatus,
} from "@/lib/ai";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AiDiffDialog } from "./ai-diff-dialog";
import { cn } from "@/lib/utils";

/*
 * The AI assistant's pane in the editor (docs/cloud-ai-assistant.md), laid
 * out like a chat: the teacher's requests on the right, the assistant's
 * answers on the left, each with a copy button. The selected text and the
 * open page go along with every request. File changes arrive as a proposal
 * whose diff the teacher reviews and accepts; a dismissed proposal stays
 * re-openable until the next message is sent.
 */

type Phase = "idle" | "streaming" | "result";

/** One request and its answer; the answer grows while it streams. */
type Exchange = { prompt: string; answer: string };

export function AiPanel({
  bookId,
  activePath,
  getViewOf,
  isTabOpen,
  isTabDirty,
  closeTab,
  reloadTab,
  commit,
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
}) {
  const { t } = useTranslation();
  const status = useAiStatus();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>("idle");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [working, setWorking] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  /** The model the teacher picked; null: the instance's default. */
  const [model, setModel] = useState<string | null>(null);
  /** The latest proposal; kept after the dialog is dismissed, until the next message. */
  const [proposal, setProposal] = useState<AiProposedChange[] | null>(null);
  /** Whether the proposal's diff dialog is open. */
  const [reviewOpen, setReviewOpen] = useState(false);
  /** The last request that failed, so it can be retried. */
  const [failed, setFailed] = useState<string | null>(null);
  const [target, setTarget] = useState<{
    path: string;
    document: string;
    from: number;
    to: number;
    head: number;
  } | null>(null);
  const stop = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view, also while the answer streams in.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [exchanges, working, phase]);

  const quotaBadge =
    status.data && status.data.enabled && status.data.allowed ? (
      <Badge
        variant="secondary"
        className="text-xs font-normal text-muted-foreground"
        title={t("editor.ai.requestsTitle")}
      >
        {status.data.quota === null
          ? t("editor.ai.requestsUnlimited", { used: status.data.usedToday })
          : t("editor.ai.requests", {
              used: status.data.usedToday,
              limit: status.data.quota,
            })}
      </Badge>
    ) : null;

  const credits =
    status.data && status.data.enabled && status.data.allowed
      ? status.data
      : null;
  const creditsBar =
    credits && credits.tokenQuota !== null && credits.tokenQuota > 0 ? (
      <div
        className="w-full space-y-1"
        title={t("editor.ai.creditsTitle", { date: credits.tokensResetOn })}
      >
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
            left: Math.max(
              0,
              credits.tokenQuota - credits.tokensUsedThisWeek,
            ).toLocaleString(),
            limit: credits.tokenQuota.toLocaleString(),
          })}
        </div>
      </div>
    ) : credits ? (
      <div
        className="text-xs text-muted-foreground"
        title={t("editor.ai.creditsTitle", { date: credits.tokensResetOn })}
      >
        {t("editor.ai.creditsUsed", {
          used: credits.tokensUsedThisWeek.toLocaleString(),
        })}
      </div>
    ) : null;

  /** Sends the teacher's request; the selection and the open page go along. */
  async function run(freePrompt: string) {
    const view = activePath ? getViewOf(activePath) : null;
    if (!view || !activePath) {
      toast.error(t("editor.ai.openFileFirst"));
      return;
    }
    const selection = selectionOf(view);
    const document = view.state.doc.toString();
    const selected = view.state.selection.main;
    setTarget({
      path: activePath,
      document,
      from: selected.from,
      to: selected.to,
      head: selected.head,
    });
    const input: AiAssistInput = {
      action: "free",
      prompt: freePrompt,
      model: model ?? undefined,
      pagePath: activePath,
      selection: selection?.text || undefined,
      context: contextOf(view),
      // The whole page, so the assistant may rewrite it — only when it fits;
      // a truncated page must never reach a write_file, or content would go.
      pageText: document.length <= 128 * 1024 ? document : undefined,
    };

    stop.current?.abort();
    const controller = new AbortController();
    stop.current = controller;
    setExchanges((all) => [...all, { prompt: freePrompt, answer: "" }]);
    // A new message retires the previous proposal and clears the input.
    setProposal(null);
    setReviewOpen(false);
    setPrompt("");
    setWorking(t("editor.ai.working"));
    setPhase("streaming");
    // An object, not a `let`: the stream's callbacks write it, and TypeScript
    // would otherwise narrow what the outer code may read from it.
    const ended = { finish: "stop" as "stop" | "length" | "error" };
    try {
      await assist(
        bookId,
        input,
        (event) => {
          switch (event.event) {
            case "delta":
              setExchanges((all) =>
                all.map((exchange, index) =>
                  index === all.length - 1
                    ? { ...exchange, answer: exchange.answer + event.text }
                    : exchange,
                ),
              );
              setWorking(null);
              break;
            case "tool": {
              // Show what the tool works on, not just its name:
              // "read_file book/lemmings.md", "write_file quiz/a.json".
              const path =
                typeof event.args.path === "string" ? ` ${event.args.path}` : "";
              setWorking(t("editor.ai.reading", { name: `${event.name}${path}` }));
              break;
            }
            case "usage":
              queryClient.setQueryData<AiStatus>(["ai-status"], (old) =>
                old
                  ? { ...old, tokensUsedThisWeek: event.tokensUsedThisWeek }
                  : old,
              );
              break;
            case "done":
              ended.finish = event.finish;
              break;
            case "error":
              ended.finish = "error";
              toast.error(event.message);
              break;
            case "proposal":
              setProposal(event.changes);
              setReviewOpen(true);
              break;
          }
        },
        controller.signal,
      );
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        toast.error(error instanceof Error ? error.message : String(error));
        ended.finish = "error";
      }
    } finally {
      stop.current = null;
      setWorking(null);
      setPhase("result");
      // A failed request stays retryable until the next one succeeds.
      setFailed(ended.finish === "error" ? freePrompt : null);
      if (ended.finish === "length") toast.warning(t("editor.ai.length"));
      // The day's counter changed; the quota line follows.
      void queryClient.invalidateQueries({ queryKey: ["ai-status"] });
    }
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
  async function applyProposal(accepted: AiProposedChange[]) {
    setProposal(null);
    setReviewOpen(false);
    if (accepted.length === 0) {
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
          changes: {
            from: 0,
            to: view.state.doc.length,
            insert: change.newText,
          },
        });
      }
      for (const change of asCommit) {
        if (!isTabOpen(change.path)) continue;
        if (change.op === "delete") {
          if (isTabDirty(change.path)) {
            changedDuringCommit.push(change.path);
          } else {
            closeTab(change.path);
          }
        } else if (isTabDirty(change.path)) {
          changedDuringCommit.push(change.path);
        } else {
          void reloadTab(change.path);
        }
      }
      if (changedDuringCommit.length > 0) {
        toast.error(
          t("editor.ai.pageChanged", {
            files: [...new Set(changedDuringCommit)].join(", "),
          }),
        );
      }
      if (applied.length > 0) {
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

  return (
    <div className="flex h-full flex-col gap-2 p-3 text-sm">
      <div className="flex items-center gap-2">
        <SparklesIcon className="size-4 text-muted-foreground" aria-hidden />
        <span className="font-medium">{t("editor.ai.title")}</span>
        <div className="ml-auto flex items-center gap-2">
          {status.data && status.data.models.length > 1 ? (
          <Select
            value={model ?? status.data.model ?? undefined}
            onValueChange={setModel}
          >
            <SelectTrigger
              size="sm"
              className="h-6 w-auto px-2 text-xs"
              aria-label={t("editor.ai.modelLabel")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {status.data.models.map((name) => (
                <SelectItem key={name} value={name}>
                  {t("editor.ai.modelWeight", {
                    model: status.data?.modelLabels[name] || name,
                    weight: status.data?.modelWeights[name] ?? 1,
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
        </div>
      </div>

      {quotaBadge && <div className="-mt-0.5 flex items-center">{quotaBadge}</div>}
      {creditsBar}

      <p className="text-xs text-muted-foreground">{t("editor.ai.hint")}</p>

      <div ref={listRef} className="min-h-0 flex-1 space-y-4 overflow-auto pr-1">
        {exchanges.map((exchange, index) => (
          <div key={index} className="space-y-1">
            <div className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-lg rounded-br-sm bg-primary px-3 py-2 text-primary-foreground">
                {exchange.prompt}
              </div>
            </div>
            <div className="flex justify-end">
              <CopyButton text={exchange.prompt} />
            </div>
            {exchange.answer && (
              <>
                <div className="flex justify-start">
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap break-words rounded-lg rounded-bl-sm bg-muted px-3 py-2",
                      index === exchanges.length - 1 &&
                        phase === "streaming" &&
                        "opacity-80",
                    )}
                  >
                    {exchange.answer}
                  </div>
                </div>
                <div className="flex justify-start">
                  <CopyButton text={exchange.answer} />
                </div>
              </>
            )}
          </div>
        ))}
        {phase === "streaming" && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <span
              className="inline-block size-2 animate-pulse rounded-full bg-primary"
              aria-hidden
            />
            {working ?? t("editor.ai.working")}
          </p>
        )}
      </div>

      {proposal && !reviewOpen && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setReviewOpen(true)}
        >
          {t("editor.ai.reviewProposal")}
        </Button>
      )}

      {failed && (
        <Button
          size="sm"
          variant="outline"
          disabled={phase === "streaming"}
          onClick={() => void run(failed)}
        >
          <RotateCwIcon className="size-4" aria-hidden />
          {t("editor.ai.retry")}
        </Button>
      )}

      {activePath && (
        <>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t("editor.ai.promptPlaceholder")}
            aria-label={t("editor.ai.title")}
            rows={3}
            className="min-h-0 resize-none text-sm"
            onKeyDown={(e) => {
              // isComposing: an IME candidate confirmation is not a send.
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing &&
                prompt.trim()
              ) {
                e.preventDefault();
                void run(prompt.trim());
              }
            }}
          />
          <Button
            size="sm"
            disabled={phase === "streaming" || !prompt.trim()}
            onClick={() => void run(prompt.trim())}
          >
            {t("editor.ai.ask")}
          </Button>
        </>
      )}

      {phase === "streaming" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            stop.current?.abort();
            setPhase("result");
            setWorking(null);
            toast.info(t("editor.ai.stopped"));
          }}
        >
          <StopCircleIcon className="size-4" aria-hidden />
          {t("editor.ai.stop")}
        </Button>
      )}

      <AiDiffDialog
        bookId={bookId}
        changes={reviewOpen ? proposal : null}
        activePath={target?.path ?? activePath}
        onClose={() => setReviewOpen(false)}
        onDone={(accepted) => void applyProposal(accepted)}
      />
    </div>
  );
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
        void navigator.clipboard
          .writeText(text)
          .then(() => toast.success(t("editor.ai.copied")))
      }
    >
      <CopyIcon aria-hidden />
    </Button>
  );
}
