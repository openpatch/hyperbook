import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
  pending: { label: "book.addressRequest.statusPending", variant: "secondary" },
  approved: { label: "book.addressRequest.statusApproved", variant: "default" },
  declined: { label: "book.addressRequest.statusDeclined", variant: "destructive" },
  withdrawn: { label: "book.addressRequest.statusWithdrawn", variant: "outline" },
} as const;

function RequestSection({ book }: { book: Book }) {
  const { t } = useTranslation();
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
      toast.success(t("book.addressRequest.sentToast"));
    } catch (error) {
      applyServerError(form, error);
    }
  });

  const pending = request?.status === "pending";
  return (
    <Section
      title={t("book.addressRequest.title")}
      description={t("book.addressRequest.description", {
        example: wanted || "physik",
        domain: instance?.booksDomain ?? "",
      })}
    >
      {request && (
        <div className="mb-4 grid max-w-xl gap-1">
          <p className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS[request.status].variant}>{t(STATUS[request.status].label)}</Badge>
            <span className="font-mono">{request.slug}</span>
            <span className="text-sm text-muted-foreground">
              {t("book.addressRequest.askedOn", {
                date: new Date(request.createdAt).toLocaleDateString(),
              })}
            </span>
          </p>
          {request.note && (
            <p className="text-sm">{t("book.addressRequest.adminNote", { note: request.note })}</p>
          )}
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
                {t("book.addressRequest.withdraw")}
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
            label={t("book.addressRequest.wanted")}
            hint={
              <span className="font-mono">
                {wanted || "…"}.{instance?.booksDomain}
              </span>
            }
          />
          <TextAreaField
            form={form}
            name="description"
            label={t("book.addressRequest.about")}
            hint={t("book.addressRequest.aboutHint")}
          />
          <FormError form={form} />
          <div>
            <Button type="submit" variant="outline" disabled={form.formState.isSubmitting}>
              {t("book.addressRequest.askFor")}
            </Button>
          </div>
        </form>
      )}
    </Section>
  );
}

function RevokeSection({ book }: { book: Book }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const id = String(book.id);
  return (
    <Section
      title={t("book.addressRequest.grantedTitle")}
      description={t("book.addressRequest.grantedDescription", {
        slug: book.slug,
        target: `${book.slug}-${book.slugSuffix ?? "…"}`,
      })}
    >
      <div className="mb-3 grid max-w-xl gap-1.5">
        <Label htmlFor="revoke-note">{t("book.addressRequest.noteToOwners")}</Label>
        <Textarea id="revoke-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <ConfirmButton
        title={t("book.addressRequest.takeBackTitle", { slug: book.slug })}
        description={t("book.addressRequest.takeBackDescription")}
        confirmLabel={t("book.addressRequest.takeBack")}
        onConfirm={async () => {
          try {
            await unwrap(api.books[":id"].slug.revoke.$post({ param: { id }, json: { note } }));
            await queryClient.invalidateQueries({ queryKey: ["books"] });
            setNote("");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : t("common.somethingWrong"));
          }
        }}
      >
        {t("book.addressRequest.takeBack")}
      </ConfirmButton>
    </Section>
  );
}
