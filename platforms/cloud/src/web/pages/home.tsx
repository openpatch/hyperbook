import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { createBookInput } from "../../shared/schemas";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api, unwrap } from "@/lib/api";
import { FormError, TextAreaField, TextField, applyServerError, useZodForm } from "@/lib/form";
import { useInstance, useUser } from "@/lib/session";
import { slugify } from "@/lib/slugify";

export function HomePage() {
  const { t } = useTranslation();
  const user = useUser();
  const { data: books } = useQuery({
    queryKey: ["books"],
    queryFn: () => unwrap(api.books.$get()),
  });

  return (
    <>
      <PageHeader
        title={t("books.title")}
        description={user.role === "admin" ? t("books.descriptionAdmin") : t("books.description")}
        actions={<CreateBookButton />}
      />
      {books?.length === 0 && (
        <p className="text-muted-foreground">{t("books.empty")}</p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {books?.map((book) => (
          <li key={book.id}>
            <Link
              to={`/books/${book.id}`}
              className="block h-full rounded-lg border p-4 shadow-xs transition-colors hover:border-primary"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-semibold break-words">{book.title}</h2>
                {book.visibility === "private" && <Badge variant="secondary">{t("books.private")}</Badge>}
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {book.url.replace(/^https?:\/\//, "")}
              </p>
              {book.description && <p className="mt-2 line-clamp-2 text-sm">{book.description}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function CreateBookButton() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: instance } = useInstance();
  const user = useUser();
  const suffixed = instance?.slugSuffix && user.role !== "admin";
  const [open, setOpen] = useState(false);
  const form = useZodForm(createBookInput, {
    defaultValues: { title: "", slug: "", description: "" },
  });
  // The address follows the title until it is edited by hand.
  const [slugTouched, setSlugTouched] = useState(false);
  const slug = form.watch("slug");

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const book = await unwrap(api.books.$post({ json: values }));
      await queryClient.invalidateQueries({ queryKey: ["books"] });
      setOpen(false);
      navigate(`/books/${book.id}`);
    } catch (error) {
      applyServerError(form, error);
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          form.reset();
          setSlugTouched(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>{t("books.new")}</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{t("books.new")}</DialogTitle>
            <DialogDescription>{t("books.newDescription")}</DialogDescription>
          </DialogHeader>
          <TextField
            form={form}
            name="title"
            label={t("books.titleField")}
            autoFocus
            onChange={(e) => {
              if (!slugTouched) {
                form.setValue("slug", slugify(e.target.value), { shouldValidate: false });
              }
            }}
          />
          <TextField
            form={form}
            name="slug"
            label={t("books.address")}
            hint={
              <>
                {t("books.addressWillBeAt")}{" "}
                <span className="font-mono">
                  {slug || "…"}
                  {suffixed && "-····"}.{instance?.booksDomain}
                </span>
                {suffixed && t("books.addressSuffixHint")}
              </>
            }
            onChange={() => setSlugTouched(true)}
          />
          <TextAreaField form={form} name="description" label={t("books.descriptionField")} />
          <FormError form={form} />
          <DialogFooter>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {t("books.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
