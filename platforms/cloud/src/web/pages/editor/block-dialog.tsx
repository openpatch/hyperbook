import { useRef, useState } from "react";
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
import type { InlineBlock } from "./blocks";
import { VisualFrame } from "./visual-frame";

/**
 * An element block of a page (a structogram) in its visual editor. "Apply"
 * writes the result back into the page, as an unsaved change of the page.
 */
export function BlockDialog({
  edit,
  onApply,
  onClose,
}: {
  edit: (InlineBlock & { lang: string }) | null;
  onApply: (code: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const latest = useRef<string | null>(null);
  const [changed, setChanged] = useState(false);

  const close = () => {
    latest.current = null;
    setChanged(false);
    onClose();
  };
  const apply = () => {
    if (latest.current !== null && changed) onApply(latest.current);
    close();
  };

  return (
    <Dialog
      open={edit !== null}
      onOpenChange={(open) => !open && close()}
    >
      <DialogContent className="flex h-[85dvh] flex-col sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t("editor.blockDialog.title")}</DialogTitle>
          <DialogDescription>{t("editor.blockDialog.description")}</DialogDescription>
        </DialogHeader>
        {edit && (
          <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border">
            <VisualFrame
              key={`${edit.from}:${edit.code}`}
              kind="struktolab-pseudocode"
              text={edit.code}
              language={edit.lang}
              onChange={(code) => {
                latest.current = code;
                setChanged(code !== edit.code);
              }}
              onSave={apply}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!changed} onClick={apply}>
            {t("editor.blockDialog.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
