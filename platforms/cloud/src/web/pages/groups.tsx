import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { groupInput } from "../../shared/schemas";
import { Section } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { api, unwrap } from "@/lib/api";
import type { Book } from "@/lib/books";
import { FormError, TextField, applyServerError, useZodForm } from "@/lib/form";

/** The book's groups (classes), each with its anonymous student accounts. */
export function GroupsSection({ book }: { book: Book }) {
  const { t } = useTranslation();
  const id = String(book.id);
  const queryClient = useQueryClient();
  const { data: groups } = useQuery({
    queryKey: ["books", id, "groups"],
    queryFn: () => unwrap(api.books[":id"].groups.$get({ param: { id } })),
  });
  const form = useZodForm(groupInput, { defaultValues: { name: "" } });

  const onSubmit = form.handleSubmit(async (json) => {
    try {
      await unwrap(api.books[":id"].groups.$post({ param: { id }, json }));
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ["books", id, "groups"] });
    } catch (error) {
      applyServerError(form, error);
    }
  });

  return (
    <Section
      title={t("groups.title")}
      description={t("groups.description")}
    >
      {groups && groups.length > 0 && (
        <ul className="mb-4 grid grid-cols-2 gap-2">
          {groups.map((g) => (
            <li key={g.id}>
              <Link
                to={`/groups/${g.id}`}
                className="block rounded-lg border p-3 shadow-xs transition-colors hover:border-primary"
              >
                <span className="font-semibold">{g.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {t("groups.studentCount", { count: g.studentCount })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={onSubmit} className="flex max-w-xl flex-wrap items-end gap-2" noValidate>
        <TextField
          form={form}
          name="name"
          label={t("groups.new")}
          placeholder={t("groups.newPlaceholder")}
          className="min-w-48 flex-1"
        />
        <Button type="submit" variant="outline" disabled={form.formState.isSubmitting}>
          {t("groups.add")}
        </Button>
        <div className="basis-full">
          <FormError form={form} />
        </div>
      </form>
    </Section>
  );
}
