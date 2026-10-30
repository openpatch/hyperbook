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

/** Shows a generated password the one time it is available. */
export function SecretDialog({
  secret,
  title,
  description,
  onClose,
}: {
  secret: string | null;
  title: string;
  description: React.ReactNode;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={secret !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <p
          className="rounded-md bg-muted p-3 text-center font-mono text-lg select-all"
          data-testid="secret"
        >
          {secret}
        </p>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => secret && navigator.clipboard?.writeText(secret)}
          >
            {t("common.copy")}
          </Button>
          <Button onClick={onClose}>{t("common.done")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
