import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { bookPathProblem } from "../../../shared/schemas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type PathRequest = {
  title: string;
  description?: string;
  label: string;
  initial: string;
  submitLabel: string;
  /**
   * Asks only for a name in this folder ("" is the book's root), not a path;
   * onSubmit still gets the whole path.
   */
  folder?: string;
  /** Resolves when done; a thrown error is shown in the dialog. */
  onSubmit: (path: string) => Promise<void>;
};

/** Asks for a path in the book: new file, new folder, rename. */
export function PathDialog({ request, onClose }: { request: PathRequest | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Whether the name's stem was selected since the dialog opened. */
  const selected = useRef(false);
  useEffect(() => {
    setValue(request?.initial ?? "");
    setError(null);
    selected.current = false;
  }, [request]);

  const submit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = value.trim();
    const folder = request!.folder;
    if (folder !== undefined && name.includes("/")) return setError(t("validation.nameWithoutSlash"));
    const path = folder ? `${folder}/${name}` : name;
    const problem = bookPathProblem(path);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      await request!.onSubmit(path);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{request?.title}</DialogTitle>
            {request?.description && <DialogDescription>{request.description}</DialogDescription>}
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="path-input">{request?.label}</Label>
            <Input
              id="path-input"
              value={value}
              autoFocus
              spellCheck={false}
              onFocus={(e) => {
                // A name is mostly changed before its extension; once, so a
                // click back into the field places the caret as usual.
                if (request?.folder === undefined || selected.current) return;
                selected.current = true;
                const dot = e.target.value.indexOf(".", 1);
                e.target.setSelectionRange(0, dot === -1 ? e.target.value.length : dot);
              }}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              aria-invalid={error !== null}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {request?.submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type ChoiceRequest = {
  title: string;
  description: React.ReactNode;
  choices: { label: string; variant?: React.ComponentProps<typeof Button>["variant"]; run: () => Promise<void> | void }[];
};

/** A question with a few answers: discard changes, resolve a conflict, … */
export function ChoiceDialog({ request, onClose }: { request: ChoiceRequest | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{request?.title}</DialogTitle>
          <DialogDescription asChild>
            <div>{request?.description}</div>
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
