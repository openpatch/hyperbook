import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
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
  const user = useUser();
  const { data: books } = useQuery({
    queryKey: ["books"],
    queryFn: () => unwrap(api.books.$get()),
  });

  return (
    <>
      <PageHeader
        title="Books"
        description={user.role === "admin" ? "All books of this instance." : "Books you work on."}
        actions={<CreateBookButton />}
      />
      {books?.length === 0 && (
        <p className="text-muted-foreground">
          No books yet. Create one to get an address for it and student accounts.
        </p>
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
                {book.visibility === "private" && <Badge variant="secondary">Private</Badge>}
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
        <Button>New book</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>New book</DialogTitle>
            <DialogDescription>You can change all of this later.</DialogDescription>
          </DialogHeader>
          <TextField
            form={form}
            name="title"
            label="Title"
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
            label="Address"
            hint={
              <>
                The book will be at{" "}
                <span className="font-mono">
                  {slug || "…"}
                  {suffixed && "-····"}.{instance?.booksDomain}
                </span>
                {suffixed && (
                  <>
                    . The ending is the book's own; you can ask for an address without it on the book's
                    page.
                  </>
                )}
              </>
            }
            onChange={() => setSlugTouched(true)}
          />
          <TextAreaField form={form} name="description" label="Description" />
          <FormError form={form} />
          <DialogFooter>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Create book
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
