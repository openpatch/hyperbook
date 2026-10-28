import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { slugRequestInput } from "../../shared/schemas";
import { ConfirmButton } from "@/components/confirm-button";
import { Section } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, unwrap } from "@/lib/api";
import type { Book } from "@/lib/books";
import { FormError, TextAreaField, TextField, applyServerError, useZodForm } from "@/lib/form";
import { useInstance, useUser } from "@/lib/session";

/**
 * Suffix mode: owners ask for an address without the book's ending, and
 * admins can take a granted one back here.
 */
export function AddressSection({ book }: { book: Book }) {
  const user = useUser();
  const { data: instance } = useInstance();
  if (!instance?.slugSuffix || book.source !== "hosted") return null;
  if (user.role === "admin") return book.slugGranted ? <RevokeSection book={book} /> : null;
  if (book.role !== "owner" || book.slugGranted) return null;
  return <RequestSection book={book} />;
}

const STATUS = {
  pending: { label: "Waiting for an admin", variant: "secondary" },
  approved: { label: "Granted", variant: "default" },
  declined: { label: "Declined", variant: "destructive" },
  withdrawn: { label: "Withdrawn", variant: "outline" },
} as const;

function RequestSection({ book }: { book: Book }) {
  const queryClient = useQueryClient();
  const { data: instance } = useInstance();
  const id = String(book.id);
  const key = ["books", id, "slug-request"];
  const { data: request } = useQuery({
    queryKey: key,
    queryFn: () => unwrap(api.books[":id"]["slug-request"].$get({ param: { id } })),
  });
  const suffix = book.slugSuffix ? `-${book.slugSuffix}` : "";
  const form = useZodForm(slugRequestInput, {
    defaultValues: { slug: suffix && book.slug.endsWith(suffix) ? book.slug.slice(0, -suffix.length) : book.slug, description: "" },
  });
  const wanted = form.watch("slug");

  const onSubmit = form.handleSubmit(async (json) => {
    try {
      await unwrap(api.books[":id"]["slug-request"].$post({ param: { id }, json }));
      await queryClient.invalidateQueries({ queryKey: key });
      form.reset({ slug: json.slug, description: "" });
      toast.success("Sent to the admins");
    } catch (error) {
      applyServerError(form, error);
    }
  });

  const pending = request?.status === "pending";
  return (
    <Section
      title="Address without ending"
      description={`Short addresses like ${wanted || "physik"}.${instance?.booksDomain} are given by an admin, for books that are ready to be found by everyone.`}
    >
      {request && (
        <div className="mb-4 grid max-w-xl gap-1">
          <p className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS[request.status].variant}>{STATUS[request.status].label}</Badge>
            <span className="font-mono">{request.slug}</span>
            <span className="text-sm text-muted-foreground">
              asked {new Date(request.createdAt).toLocaleDateString()}
            </span>
          </p>
          {request.note && <p className="text-sm">Admin: {request.note}</p>}
          {pending && (
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await unwrap(api.books[":id"]["slug-request"].$delete({ param: { id } }));
                  await queryClient.invalidateQueries({ queryKey: key });
                }}
              >
                Withdraw request
              </Button>
            </div>
          )}
        </div>
      )}
      {!pending && (
        <form onSubmit={onSubmit} className="grid max-w-xl gap-4" noValidate>
          <TextField
            form={form}
            name="slug"
            label="Address you would like"
            hint={
              <span className="font-mono">
                {wanted || "…"}.{instance?.booksDomain}
              </span>
            }
          />
          <TextAreaField
            form={form}
            name="description"
            label="What is the book about?"
            hint="For the admin who decides, e.g. subject, grades, how complete it is. The admin also looks at the book."
          />
          <FormError form={form} />
          <div>
            <Button type="submit" variant="outline" disabled={form.formState.isSubmitting}>
              Ask for this address
            </Button>
          </div>
        </form>
      )}
    </Section>
  );
}

function RevokeSection({ book }: { book: Book }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const id = String(book.id);
  return (
    <Section
      title="Granted address"
      description={`An admin gave this book ${book.slug}. Taking it back moves the book to ${book.slug}-${book.slugSuffix ?? "…"}; the owners get an email.`}
    >
      <div className="mb-3 grid max-w-xl gap-1.5">
        <Label htmlFor="revoke-note">Note to the owners (optional)</Label>
        <Textarea id="revoke-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <ConfirmButton
        title={`Take ${book.slug} back?`}
        description="The book moves to its address with ending, and the old one redirects there until it is given to another book."
        confirmLabel="Take address back"
        onConfirm={async () => {
          try {
            await unwrap(api.books[":id"].slug.revoke.$post({ param: { id }, json: { note } }));
            await queryClient.invalidateQueries({ queryKey: ["books"] });
            setNote("");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Something went wrong");
          }
        }}
      >
        Take address back
      </ConfirmButton>
    </Section>
  );
}
