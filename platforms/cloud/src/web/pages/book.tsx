import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import { addMemberInput, updateBookInput } from "../../shared/schemas";
import { ConfirmButton } from "@/components/confirm-button";
import { PageHeader, Section } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, unwrap } from "@/lib/api";
import { type Book, useBook } from "@/lib/books";
import { FormError, TextAreaField, TextField, applyServerError, useZodForm } from "@/lib/form";
import { useInstance, useUser } from "@/lib/session";
import { AddressSection } from "./address";
import { DomainSection } from "./domain";
import { GroupsSection } from "./groups";
import { PublishingSection } from "./publishing";

/**
 * The book as a grid of cards: wide ones for what needs the width (publishing,
 * people, delete), two side by side for the forms. Narrow screens keep one
 * column. The margin of every card is given back to the grid's own gaps.
 */
export function BookPage() {
  const id = useParams().id!;
  const { data: book } = useBook(id);
  const user = useUser();
  if (!book) return null;
  const isOwner = book.role === "owner";
  const mayUseDomain = user.entitlements.custom_domain || book.domain !== null;
  return (
    <>
      <PageHeader
        title={book.title}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <a href={book.url} className="text-primary hover:underline" target="_blank" rel="noreferrer">
              {book.url.replace(/^https?:\/\//, "")}
            </a>
            {book.source === "hosted" &&
              (book.publishedAt ? (
                <Badge>Published</Badge>
              ) : (
                <Badge variant="secondary">Not published</Badge>
              ))}
          </span>
        }
        actions={
          <>
            {book.visibility === "private" && <Badge variant="secondary">Private</Badge>}
            {book.source === "hosted" && (
              <Button asChild>
                <Link to={`/books/${book.id}/edit`}>Edit book</Link>
              </Button>
            )}
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 [&_section]:mb-0">
        {book.source === "hosted" && (
          <div className="lg:col-span-2">
            <PublishingSection book={book} />
          </div>
        )}
        <GroupsSection book={book} />
        <SettingsSection book={book} />
        <AddressSection book={book} />
        {book.source === "hosted" && isOwner && mayUseDomain && <DomainSection book={book} />}
        <div className="lg:col-span-2">
          <MembersSection book={book} />
        </div>
        {isOwner && (
          <div className="lg:col-span-2">
            <DeleteSection book={book} />
          </div>
        )}
      </div>
    </>
  );
}

const settingsSchema = updateBookInput
  .pick({ title: true, slug: true, description: true })
  .required()
  .extend({
    visibility: z.enum(["public", "private"]),
    external: z.boolean(),
    externalUrl: z.string().trim(),
  })
  .refine((v) => !v.external || z.url().safeParse(v.externalUrl).success, {
    path: ["externalUrl"],
    message: "Enter a full URL, starting with https://",
  });

function SettingsSection({ book }: { book: Book }) {
  const queryClient = useQueryClient();
  const user = useUser();
  const { data: instance } = useInstance();
  const isOwner = book.role === "owner";
  const suffixed = instance?.slugSuffix && user.role !== "admin";
  const mayRename = isOwner && !(suffixed && book.slugGranted);
  const mayBePrivate = user.entitlements.private_books || book.visibility === "private";
  const form = useZodForm(settingsSchema, {
    defaultValues: {
      title: book.title,
      slug: book.slug,
      description: book.description,
      visibility: book.visibility,
      external: book.externalUrl !== null,
      externalUrl: book.externalUrl ?? "",
    },
  });
  const slug = form.watch("slug");
  const external = form.watch("external");
  const visibility = form.watch("visibility");

  const onSubmit = form.handleSubmit(async (values) => {
    const json = isOwner
      ? {
          title: values.title,
          description: values.description,
          slug: values.slug,
          visibility: values.visibility,
          externalUrl: values.external ? values.externalUrl : null,
        }
      : { title: values.title, description: values.description };
    try {
      const updated = await unwrap(
        api.books[":id"].$patch({ param: { id: String(book.id) }, json }),
      );
      queryClient.setQueryData(["books", String(book.id)], updated);
      await queryClient.invalidateQueries({ queryKey: ["books"], exact: true });
      form.reset({ ...values });
      toast.success("Saved");
    } catch (error) {
      applyServerError(form, error);
    }
  });

  return (
    <Section title="Settings">
      <form onSubmit={onSubmit} className="grid max-w-xl gap-4" noValidate>
        <TextField form={form} name="title" label="Title" />
        <TextAreaField form={form} name="description" label="Description" />
        <TextField
          form={form}
          name="slug"
          label="Address"
          disabled={!mayRename}
          hint={
            suffixed && book.slugGranted ? (
              "An admin gave the book this address. Ask an admin to change it."
            ) : (
              <>
                <span className="font-mono">
                  {suffixed && book.slugSuffix && !slug.endsWith(`-${book.slugSuffix}`)
                    ? `${slug}-${book.slugSuffix}`
                    : slug}
                  .{instance?.booksDomain}
                </span>
                . Changing it keeps the old address working as a redirect.
                {suffixed && " The ending stays the book's own."}
              </>
            )
          }
        />
        <div className="grid gap-1.5">
          <Label htmlFor="book-visibility">Visibility</Label>
          <Select
            value={visibility}
            disabled={!isOwner}
            onValueChange={(v) =>
              form.setValue("visibility", v as "public" | "private", { shouldDirty: true })
            }
          >
            <SelectTrigger id="book-visibility" className="w-72" aria-describedby="book-visibility-hint">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public: anyone with the link</SelectItem>
              <SelectItem value="private" disabled={!mayBePrivate}>
                Private: only logged-in students
              </SelectItem>
            </SelectContent>
          </Select>
          <p id="book-visibility-hint" className="text-sm text-muted-foreground">
            {mayBePrivate
              ? "Private books ask students to log in before they can read anything."
              : "Your account may not make books private. Ask an admin."}
          </p>
        </div>
        <div className="grid gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="book-external"
              checked={external}
              disabled={!isOwner}
              onCheckedChange={(v) => form.setValue("external", v === true, { shouldDirty: true })}
            />
            <Label htmlFor="book-external">This book is hosted elsewhere</Label>
          </div>
          {external && (
            <TextField
              form={form}
              name="externalUrl"
              label="Address of the book"
              type="url"
              placeholder="https://example.github.io/physics/"
              disabled={!isOwner}
              hint="For example on GitHub Pages. Student accounts work there too."
            />
          )}
        </div>
        <FormError form={form} />
        <div>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            Save
          </Button>
        </div>
      </form>
    </Section>
  );
}

function MembersSection({ book }: { book: Book }) {
  const user = useUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const id = String(book.id);
  const isOwner = book.role === "owner";
  const key = ["books", id, "members"];
  const { data: members } = useQuery({
    queryKey: key,
    queryFn: () => unwrap(api.books[":id"].members.$get({ param: { id } })),
  });

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: key });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    }
  };

  return (
    <Section
      title="People"
      description="Owners manage everything. Editors work on the book and its students."
    >
      <Table className="mb-4">
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members?.map((m) => (
            <TableRow key={m.userId}>
              <TableCell>{m.email}</TableCell>
              <TableCell>{m.displayName}</TableCell>
              <TableCell>
                {isOwner ? (
                  <Select
                    value={m.role}
                    onValueChange={(role) =>
                      run(() =>
                        unwrap(
                          api.books[":id"].members[":userId"].$patch({
                            param: { id, userId: String(m.userId) },
                            json: { role: role as "owner" | "editor" },
                          }),
                        ),
                      )
                    }
                  >
                    <SelectTrigger size="sm" aria-label={`Role of ${m.email}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                    </SelectContent>
                  </Select>
                ) : m.role === "owner" ? (
                  "Owner"
                ) : (
                  "Editor"
                )}
              </TableCell>
              <TableCell className="text-right">
                {(isOwner || m.userId === user.id) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      run(async () => {
                        await unwrap(
                          api.books[":id"].members[":userId"].$delete({
                            param: { id, userId: String(m.userId) },
                          }),
                        );
                        if (m.userId === user.id && user.role !== "admin") {
                          await queryClient.invalidateQueries({ queryKey: ["books"] });
                          navigate("/");
                        }
                      })
                    }
                  >
                    {m.userId === user.id ? "Leave" : "Remove"}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {isOwner && <AddMemberForm bookId={id} onAdded={() => queryClient.invalidateQueries({ queryKey: key })} />}
    </Section>
  );
}

function AddMemberForm({ bookId, onAdded }: { bookId: string; onAdded: () => void }) {
  const form = useZodForm(addMemberInput, { defaultValues: { email: "", role: "editor" } });
  const onSubmit = form.handleSubmit(async (json) => {
    try {
      await unwrap(api.books[":id"].members.$post({ param: { id: bookId }, json }));
      form.reset();
      onAdded();
    } catch (error) {
      applyServerError(form, error);
    }
  });
  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-wrap items-end gap-2" noValidate>
      <TextField
        form={form}
        name="email"
        label="Add a teacher by email"
        type="email"
        className="min-w-60 flex-1"
      />
      <Button type="submit" variant="outline" disabled={form.formState.isSubmitting}>
        Add as editor
      </Button>
      <div className="basis-full">
        <FormError form={form} />
      </div>
    </form>
  );
}

function DeleteSection({ book }: { book: Book }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return (
    <Section
      title="Delete book"
      description="The book, its groups and all its student accounts are deleted. This cannot be undone."
      className="border-destructive/40"
    >
      <ConfirmButton
        title={`Delete “${book.title}”?`}
        description="The book, its groups and all its student accounts are deleted. This cannot be undone."
        confirmLabel="Delete book"
        onConfirm={async () => {
          await unwrap(api.books[":id"].$delete({ param: { id: String(book.id) } }));
          await queryClient.invalidateQueries({ queryKey: ["books"] });
          navigate("/");
        }}
      >
        Delete book
      </ConfirmButton>
    </Section>
  );
}
