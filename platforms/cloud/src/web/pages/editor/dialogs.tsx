import { useEffect, useState } from "react";
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
  /** Resolves when done; a thrown error is shown in the dialog. */
  onSubmit: (path: string) => Promise<void>;
};

/** Asks for a path in the book: new file, new folder, rename. */
export function PathDialog({ request, onClose }: { request: PathRequest | null; onClose: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setValue(request?.initial ?? "");
    setError(null);
  }, [request]);

  const submit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const path = value.trim();
    const problem = bookPathProblem(path);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      await request!.onSubmit(path);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
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
              Cancel
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
            Cancel
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
