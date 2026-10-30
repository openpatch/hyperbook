import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Reference } from "../../../shared/references";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/*
 * What a rename, move or delete is about to do to the places that reference
 * the file: where they are, and — when the file moves — that their
 * addresses will be rewritten (or left broken, when it is deleted).
 */

export type RefactorChoice = {
  label: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  run: () => Promise<void> | void;
};

export type RefactorRequest = {
  title: string;
  /** The sentence between title and list, e.g. what the operation will do to the references. */
  lead: React.ReactNode;
  /** Where the file is referenced from, as the scan found them. */
  references: Reference[];
  /** Each referencing page's text, for showing the line a reference sits in. */
  texts: Record<string, string>;
  choices: RefactorChoice[];
};

/** The line a reference sits in, trimmed to a window around the address it carries. */
function snippet(ref: Reference, text: string | undefined): { before: string; target: string; after: string } | null {
  const line = text?.split("\n")[ref.line - 1];
  if (line === undefined) return null;
  const from = ref.column - 1;
  const target = line.slice(from, from + ref.length);
  if (target !== ref.raw.slice(0, ref.length)) return null;
  const window = 60;
  let start = Math.max(0, Math.min(from - 20, from - window));
  let end = Math.min(line.length, from + ref.length + window);
  if (start > 0) start = Math.max(0, start - 1);
  return {
    before: (start > 0 ? "…" : "") + line.slice(start, from),
    target,
    after: line.slice(from + ref.length, end) + (end < line.length ? "…" : ""),
  };
}

export function RefactorDialog({ request, onClose }: { request: RefactorRequest | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  useEffect(() => setBusy(false), [request]);

  // Only lines the scan can still show; the rest still count in the lead.
  const rows =
    request?.references.map((ref) => ({ ref, snippet: snippet(ref, request.texts[ref.file]) })).filter((r) => r.snippet) ??
    [];

  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{request?.title}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-left">
              <div>{request?.lead}</div>
              {rows.length > 0 && (
                <ul className="max-h-64 space-y-2 overflow-y-auto">
                  {rows.map(({ ref, snippet }, i) => (
                    <li key={i} className="rounded-md border p-2 font-mono text-xs">
                      <div className="text-muted-foreground">
                        {ref.file}:{ref.line}
                        {ref.directive && <> · {ref.directive.name}</>}
                      </div>
                      <div className="break-all whitespace-pre-wrap">
                        {snippet!.before}
                        <mark className="rounded bg-primary/15 px-0.5 text-primary">{snippet!.target}</mark>
                        {snippet!.after}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-wrap">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          {request?.choices.map((choice) => (
            <Button
              key={choice.label}
              variant={choice.variant ?? "default"}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await choice.run();
                } finally {
                  setBusy(false);
                  onClose();
                }
              }}
            >
              {choice.label}
            </Button>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
