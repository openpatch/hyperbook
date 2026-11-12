import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ChoiceRequest = {
  title: string;
  description: React.ReactNode;
  choices: { label: string; variant?: React.ComponentProps<typeof Button>["variant"]; run: () => Promise<void> | void }[];
};

/** Files a dialog is about, one per line. */
export function PathList({ paths }: { paths: string[] }) {
  return (
    <ul className="my-2 list-disc pl-5 font-mono text-sm">
      {paths.map((path) => (
        <li key={path}>{path}</li>
      ))}
    </ul>
  );
}

/** A question with a few answers: discard changes, resolve a conflict, … */
export function ChoiceDialog({
  request,
  onClose,
}: {
  request: ChoiceRequest | null;
  /** Closes `closed`, the request the dialog was showing. */
  onClose: (closed: ChoiceRequest | null) => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && !busy && onClose(request)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{request?.title}</DialogTitle>
          <DialogDescription asChild>
            <div>{request?.description}</div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-wrap">
          <Button variant="outline" onClick={() => onClose(request)} disabled={busy}>
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
                  onClose(request);
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
