import { useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  const id = String(book.id);
  const domain = book.domain;
  const [checking, setChecking] = useState(false);
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
      if (updated.domain?.active) toast.success(`The book is now at ${updated.domain.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setChecking(false);
    }
  };

  return (
    <Section
      title="Custom domain"
      description="Serve the book at an address of your own, e.g. a subdomain of your school's website."
    >
      <form onSubmit={onSubmit} className="flex max-w-xl flex-wrap items-end gap-2" noValidate>
        <TextField
          form={form}
          name="domain"
          label="Domain"
          placeholder="buch.schule.de"
          hint="A subdomain of a domain you manage."
          className="min-w-60 flex-1"
        />
        <Button type="submit" variant="outline" disabled={form.formState.isSubmitting}>
          {domain ? "Change" : "Set domain"}
        </Button>
        <div className="basis-full">
          <FormError form={form} />
        </div>
      </form>

      {domain && (
        <div className="mt-4 grid max-w-3xl gap-3">
          <p className="flex flex-wrap items-center gap-2">
            {domain.active ? (
              <Badge>Active</Badge>
            ) : (
              <Badge variant="secondary">Waiting for DNS</Badge>
            )}
            <span className="font-mono">{domain.name}</span>
            {domain.checkedAt && (
              <span className="text-sm text-muted-foreground">
                checked {new Date(domain.checkedAt).toLocaleString()}
              </span>
            )}
          </p>
          {domain.active ? (
            <p className="text-sm text-muted-foreground">
              The book's address on this platform now redirects here. Keep the DNS record.
            </p>
          ) : (
            <>
              <p className="text-sm">
                Create this record where your domain's DNS is managed, then check again. Changes can
                take a while to show.
              </p>
              {domain.problem && <p className="text-sm text-destructive">{domain.problem}</p>}
            </>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Value</TableHead>
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
          <p className="text-sm text-muted-foreground">
            Use a subdomain such as buch.schule.de: a domain on its own (like schule.de) cannot have a CNAME
            record.
          </p>
          <div className="flex flex-wrap gap-2">
            {!domain.active && (
              <Button onClick={check} disabled={checking}>
                {checking ? "Checking…" : "Check again"}
              </Button>
            )}
            <ConfirmButton
              title={`Remove ${domain.name}?`}
              description={`The book is served at ${book.slug} on this platform again. Printed login links that use ${domain.name} stop working.`}
              confirmLabel="Remove domain"
              onConfirm={async () => {
                await show(await unwrap(api.books[":id"].domain.$delete({ param: { id } })));
                form.reset({ domain: "" });
              }}
            >
              Remove domain
            </ConfirmButton>
          </div>
        </div>
      )}
    </Section>
  );
}
