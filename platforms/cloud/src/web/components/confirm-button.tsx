import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ConfirmProps = {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  /** When set, the confirm button stays disabled until this is typed. */
  confirmText?: string;
  onConfirm: () => Promise<unknown>;
  variant?: React.ComponentProps<typeof Button>["variant"];
};

/** A button that asks before doing something that cannot be undone. */
export function ConfirmButton({
  variant = "destructive",
  size,
  children,
  ...props
}: ConfirmProps & {
  size?: React.ComponentProps<typeof Button>["size"];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <ConfirmDialog open={open} onOpenChange={setOpen} variant={variant} {...props}>
      <DialogTrigger asChild>
        <Button variant={variant === "destructive" ? "outline" : variant} size={size}>
          {children}
        </Button>
      </DialogTrigger>
    </ConfirmDialog>
  );
}

/**
 * The question of ConfirmButton on its own, for when something else opens it
 * (a menu item, a toolbar). It closes once onConfirm has worked.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmText,
  onConfirm,
  variant = "destructive",
  children,
}: ConfirmProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const { t } = useTranslation();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        setTyped("");
      }}
    >
      {children}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {confirmText && (
          <div className="space-y-2">
            <Label htmlFor="confirm-text">{t("common.typeToConfirm", { text: confirmText })}</Label>
            <Input
              id="confirm-text"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("common.cancel")}</Button>
          </DialogClose>
          <Button
            variant={variant}
            disabled={busy || (!!confirmText && typed.trim() !== confirmText)}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onOpenChange(false);
                setTyped("");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : t("common.somethingWrong"));
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
