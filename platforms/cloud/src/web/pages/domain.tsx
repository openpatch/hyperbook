import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { toast } from "sonner";
import { bookDomainInput } from "../../shared/schemas";
import { ConfirmButton } from "@/components/confirm-button";
import { Section } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, unwrap } from "@/lib/api";
import type { Book } from "@/lib/books";
import { FormError, TextField, applyServerError, useZodForm } from "@/lib/form";

/** For owners of hosted books whose account may use custom domains (M5). */
export function DomainSection({ book }: { book: Book }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const id = String(book.id);
  const domain = book.domain;
  const [checking, setChecking] = useState(false);
  const [httpsChecking, setHttpsChecking] = useState(false);
  // The HTTPS check is stateless on the server; the result lives here.
  const [httpsProblem, setHttpsProblem] = useState<string | null | undefined>();
  const form = useZodForm(bookDomainInput, { defaultValues: { domain: domain?.name ?? "" } });

  const show = (updated: Book) => {
    queryClient.setQueryData(["books", id], updated);
    return queryClient.invalidateQueries({ queryKey: ["books"], exact: true });
  };

  const onSubmit = form.handleSubmit(async (json) => {
    try {
      const updated = await unwrap(api.books[":id"].domain.$put({ param: { id }, json }));
      await show(updated);
      form.reset({ domain: updated.domain?.name ?? "" });
    } catch (error) {
      applyServerError(form, error);
    }
  });

  const check = async () => {
    setChecking(true);
    try {
      const updated = await unwrap(api.books[":id"].domain.check.$post({ param: { id } }));
      await show(updated);
      if (updated.domain?.active)
        toast.success(t("book.domain.nowAtToast", { domain: updated.domain.name }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.somethingWrong"));
    } finally {
      setChecking(false);
    }
  };

  const checkHttps = async () => {
    setHttpsChecking(true);
    try {
      const { problem } = await unwrap(api.books[":id"].domain["https-check"].$post({ param: { id } }));
      setHttpsProblem(problem);
      if (problem === null) toast.success(t("book.domain.httpsWorks"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.somethingWrong"));
    } finally {
      setHttpsChecking(false);
    }
  };

  return (
    <Section
      title={t("book.domain.title")}
      description={t("book.domain.description")}
    >
      <form onSubmit={onSubmit} className="flex max-w-xl flex-wrap items-end gap-2" noValidate>
        <TextField
          form={form}
          name="domain"
          label={t("book.domain.field")}
          placeholder="buch.schule.de"
          hint={t("book.domain.fieldHint")}
          className="min-w-60 flex-1"
        />
        <Button type="submit" variant="outline" disabled={form.formState.isSubmitting}>
          {domain ? t("book.domain.change") : t("book.domain.set")}
        </Button>
        <div className="basis-full">
          <FormError form={form} />
        </div>
      </form>

      {domain && (
        <div className="mt-4 grid max-w-3xl gap-3">
          <p className="flex flex-wrap items-center gap-2">
            {domain.active ? (
              <Badge>{t("book.domain.active")}</Badge>
            ) : (
              <Badge variant="secondary">{t("book.domain.waiting")}</Badge>
            )}
            <span className="font-mono">{domain.name}</span>
            {domain.checkedAt && (
              <span className="text-sm text-muted-foreground">
                {t("book.domain.checkedAt", {
                  when: new Date(domain.checkedAt).toLocaleString(),
                })}
              </span>
            )}
          </p>
          {domain.active ? (
            <>
              <p className="text-sm text-muted-foreground">{t("book.domain.activeHint")}</p>
              {httpsProblem !== undefined &&
                (httpsProblem === null ? (
                  <Badge>{t("book.domain.httpsWorks")}</Badge>
                ) : (
                  <p className="text-sm text-destructive">{httpsProblem}</p>
                ))}
            </>
          ) : (
            <>
              <p className="text-sm">{t("book.domain.recordHint")}</p>
              {domain.problem && <p className="text-sm text-destructive">{domain.problem}</p>}
            </>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("book.domain.type")}</TableHead>
                <TableHead>{t("book.domain.name")}</TableHead>
                <TableHead>{t("book.domain.value")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>CNAME</TableCell>
                <TableCell className="font-mono break-all">{domain.name}</TableCell>
                <TableCell className="font-mono break-all">{domain.target}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p className="text-sm text-muted-foreground">{t("book.domain.subdomainHint")}</p>
          <div className="flex flex-wrap gap-2">
            {!domain.active && (
              <Button onClick={check} disabled={checking}>
                {checking ? t("book.domain.checking") : t("book.domain.checkAgain")}
              </Button>
            )}
            {domain.active && (
              <Button variant="outline" onClick={checkHttps} disabled={httpsChecking}>
                {httpsChecking ? t("book.domain.checking") : t("book.domain.checkHttps")}
              </Button>
            )}
            <ConfirmButton
              title={t("book.domain.removeTitle", { domain: domain.name })}
              description={t("book.domain.removeDescription", {
                slug: book.slug,
                domain: domain.name,
              })}
              confirmLabel={t("book.domain.remove")}
              onConfirm={async () => {
                await show(await unwrap(api.books[":id"].domain.$delete({ param: { id } })));
                form.reset({ domain: "" });
              }}
            >
              {t("book.domain.remove")}
            </ConfirmButton>
          </div>
        </div>
      )}
    </Section>
  );
}
