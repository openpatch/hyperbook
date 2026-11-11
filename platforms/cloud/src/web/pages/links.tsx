import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CopyIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/confirm-button";
import { Section } from "@/components/page-header";
import { SecretDialog } from "@/components/secret-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, unwrap } from "@/lib/api";
import type { Book } from "@/lib/books";

/*
 * The book page's access links (docs/cloud-platform.md, M7): named links
 * into the editor for people without an account, made and deleted by the
 * book's owners.
 */

const day = (ms: number) => new Date(ms).toLocaleDateString();
const errorText = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

export function LinksSection({ book }: { book: Book }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const id = String(book.id);
  const key = ["books", id, "links"];
  const { data: links } = useQuery({
    queryKey: key,
    queryFn: () => unwrap(api.books[":id"].links.$get({ param: { id } })),
  });
  const [name, setName] = useState("");
  const [role, setRole] = useState<"commenter" | "editor">("commenter");
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<{ name: string; role: string; url: string } | null>(null);
  const roleName = (r: "commenter" | "editor") => t(`book.${r}`);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      // The end of the chosen day, in the teacher's time zone.
      const expiresAt = expires ? new Date(`${expires}T23:59:59`).getTime() : null;
      const created = await unwrap(
        api.books[":id"].links.$post({ param: { id }, json: { name: name.trim(), role, expiresAt } }),
      );
      setShown({ name: created.name, role: roleName(created.role), url: created.url });
      setName("");
      setExpires("");
      await queryClient.invalidateQueries({ queryKey: key });
    } catch (error) {
      toast.error(errorText(error, t("common.somethingWrong")));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (linkId: number) => {
    try {
      const { url } = await unwrap(
        api.books[":id"].links[":linkId"].url.$get({ param: { id, linkId: String(linkId) } }),
      );
      await navigator.clipboard.writeText(url);
      toast.success(t("links.copied"));
    } catch (error) {
      toast.error(errorText(error, t("common.somethingWrong")));
    }
  };

  return (
    <Section title={t("links.title")} description={t("links.description")}>
      {links && links.length > 0 ? (
        <Table className="mb-4">
          <TableHeader>
            <TableRow>
              <TableHead>{t("links.name")}</TableHead>
              <TableHead>{t("links.role")}</TableHead>
              <TableHead className="max-sm:hidden">{t("links.created")}</TableHead>
              <TableHead className="max-sm:hidden">{t("links.lastUsed")}</TableHead>
              <TableHead className="max-sm:hidden">{t("links.expires")}</TableHead>
              <TableHead>
                <span className="sr-only">{t("common.actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.map((link) => (
              <TableRow key={link.id}>
                <TableCell>{link.name}</TableCell>
                <TableCell>{roleName(link.role)}</TableCell>
                <TableCell className="max-sm:hidden">{day(link.createdAt)}</TableCell>
                <TableCell className="max-sm:hidden">
                  {link.lastUsedAt ? day(link.lastUsedAt) : t("links.neverUsed")}
                </TableCell>
                <TableCell className="max-sm:hidden">
                  {link.expiresAt ? day(link.expiresAt) : t("links.expiresNever")}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`${t("links.copy")}: ${link.name}`}
                    onClick={() => void copy(link.id)}
                  >
                    <CopyIcon className="size-3.5" aria-hidden />
                    <span className="max-sm:sr-only">{t("links.copy")}</span>
                  </Button>
                  <ConfirmButton
                    variant="ghost"
                    size="sm"
                    title={t("links.deleteTitle", { name: link.name })}
                    description={t("links.deleteDescription", { name: link.name })}
                    confirmLabel={t("links.delete")}
                    onConfirm={async () => {
                      await unwrap(
                        api.books[":id"].links[":linkId"].$delete({ param: { id, linkId: String(link.id) } }),
                      );
                      await queryClient.invalidateQueries({ queryKey: key });
                    }}
                  >
                    {t("links.delete")}
                  </ConfirmButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="mb-4 text-sm text-muted-foreground">{t("links.empty")}</p>
      )}
      <form onSubmit={(e) => void create(e)} className="flex flex-wrap items-end gap-2">
        <div className="grid min-w-48 flex-1 gap-2">
          <Label htmlFor="link-name">{t("links.name")}</Label>
          <Input
            id="link-name"
            value={name}
            maxLength={80}
            placeholder={t("links.namePlaceholder")}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="link-role">{t("links.role")}</Label>
          <Select value={role} onValueChange={(v) => setRole(v as "commenter" | "editor")}>
            <SelectTrigger id="link-role" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="commenter">{t("book.commenter")}</SelectItem>
              <SelectItem value="editor">{t("book.editor")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="link-expires">{t("links.expiresOn")}</Label>
          <Input
            id="link-expires"
            type="date"
            className="w-40"
            value={expires}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setExpires(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline" disabled={busy || !name.trim()}>
          {t("links.create")}
        </Button>
      </form>
      <SecretDialog
        secret={shown?.url ?? null}
        title={t("links.newTitle", { name: shown?.name ?? "" })}
        description={t("links.newDescription", { name: shown?.name ?? "", role: shown?.role ?? "" })}
        onClose={() => setShown(null)}
      />
    </Section>
  );
}

/** A member's switch for comment emails about this book. */
export function CommentMailSwitch({ book }: { book: Book }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  if (book.commentMail === null || book.commentMail === undefined) return null;
  const id = String(book.id);
  return (
    <div className="flex items-start gap-2">
      <Checkbox
        id="comment-mail"
        checked={book.commentMail}
        onCheckedChange={async (checked) => {
          try {
            await unwrap(
              api.books[":id"]["comment-mail"].$put({ param: { id }, json: { commentMail: checked === true } }),
            );
            await queryClient.invalidateQueries({ queryKey: ["books", id] });
          } catch (error) {
            toast.error(errorText(error, t("common.somethingWrong")));
          }
        }}
      />
      <div className="grid gap-0.5">
        <Label htmlFor="comment-mail" className="font-normal">
          {t("comments.mail")}
        </Label>
        <p className="text-xs text-muted-foreground">{t("comments.mailHint")}</p>
      </div>
    </div>
  );
}
