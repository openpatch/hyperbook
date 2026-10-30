import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { AiProposedChange } from "../../../shared/schemas";
import { api, unwrap } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/*
 * The AI assistant's proposal, as the teacher reviews it: every changed
 * file as a diff (computed with git, server-side), each accepted or denied
 * on its own. Accepting is the panel's job — it applies the subset through
 * the editor's normal save path. Deleting a file warns about the pages that
 * reference it, like the editor's own refactor dialog.
 */

const keyOf = (change: AiProposedChange) => `${change.op}:${change.path}`;

export function AiDiffDialog({
  bookId,
  activePath,
  changes,
  onDone,
  onClose,
}: {
  bookId: number;
  activePath: string | null;
  /** The proposal, as the route sent it; null hides the dialog. */
  changes: AiProposedChange[] | null;
  /** The accepted subset, or an empty list when denied. */
  onDone: (accepted: AiProposedChange[]) => void;
  /** The dialog was closed without a decision; the proposal stays pending. */
  onClose: () => void;
}) {
  const { t } = useTranslation();
  // `true` for files the teacher has not turned off; per file, by key.
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const isOn = (change: AiProposedChange) => accepted[keyOf(change)] ?? true;
  const chosen = (changes ?? []).filter(isOn);

  return (
    <Dialog
      open={changes !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="flex max-h-[85dvh] w-full sm:max-w-5xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t("editor.ai.proposalTitle")}</DialogTitle>
          <DialogDescription>{t("editor.ai.proposalHint")}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto pr-1">
          {(changes ?? []).map((change) => (
            <ProposedFile
              key={keyOf(change)}
              bookId={bookId}
              activePath={activePath}
              change={change}
              accepted={isOn(change)}
              onAccepted={(on) =>
                setAccepted((state) => ({ ...state, [keyOf(change)]: on }))
              }
            />
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onDone([])}>
            {t("editor.ai.deny")}
          </Button>
          <Button disabled={chosen.length === 0} onClick={() => onDone(chosen)}>
            {t("editor.ai.accept", { count: chosen.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One changed file: its accept checkbox and what kind of change it is, then its diff. */
function ProposedFile({
  bookId,
  activePath,
  change,
  accepted,
  onAccepted,
}: {
  bookId: number;
  activePath: string | null;
  change: AiProposedChange;
  accepted: boolean;
  onAccepted: (on: boolean) => void;
}) {
  const { t } = useTranslation();
  // Only deletions need the warning; the route scans the book's pages.
  const { data: referencedBy } = useQuery({
    enabled: change.op === "delete",
    queryKey: ["ai-references", bookId, change.path],
    queryFn: () =>
      unwrap(
        api.books[":id"].files.references.$get({
          param: { id: String(bookId) },
          query: { path: change.path },
        }),
      ),
  });
  const references = [
    ...new Set((referencedBy?.references ?? []).map((ref) => ref.file)),
  ];

  const isNew = change.op === "write" && change.oldText === null;
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 py-1">
        <Checkbox
          checked={accepted}
          onCheckedChange={(value) => onAccepted(value === true)}
          aria-label={t("editor.ai.include", { path: change.path })}
        />
        <span className="font-medium">{change.path}</span>
        <span className="text-xs text-muted-foreground">
          {change.op === "delete"
            ? t("editor.ai.deleted")
            : isNew
              ? t("editor.ai.newFile")
              : t("editor.ai.edited")}
        </span>
        {change.path === activePath && (
          <span className="text-xs text-muted-foreground">
            {t("editor.ai.openPage")}
          </span>
        )}
      </div>
      {change.op === "delete" && references.length > 0 && (
        <p className="mb-1 text-xs text-destructive">
          {t("editor.ai.referencedBy", { files: references.join(", ") })}
        </p>
      )}
      <pre className="overflow-auto rounded-md border border-border bg-background p-2 text-xs leading-5">
        {change.diff.split("\n").map((line, index) => (
          <div
            key={index}
            className={cn(
              line.startsWith("+") &&
                !line.startsWith("+++") &&
                "bg-green-500/10",
              line.startsWith("-") &&
                !line.startsWith("---") &&
                "bg-red-500/10",
              line.startsWith("@@") && "text-muted-foreground",
            )}
          >
            {line || " "}
          </div>
        ))}
      </pre>
    </div>
  );
}
