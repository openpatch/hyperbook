import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { createUserInput } from "../../shared/schemas";
import { PageHeader } from "@/components/page-header";
import { SecretDialog } from "@/components/secret-dialog";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/confirm-button";
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
import { FormError, TextField, applyServerError, useZodForm } from "@/lib/form";
import { useInstance } from "@/lib/session";

export function UsersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => unwrap(api.users.$get()),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["users"] });
  const run = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action();
      toast.success(done);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.somethingWrong"));
    }
  };

  return (
    <>
      <PageHeader
        title={t("users.title")}
        description={t("users.description")}
        actions={<CreateUserButton />}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("users.email")}</TableHead>
            <TableHead>{t("users.name")}</TableHead>
            <TableHead>{t("users.role")}</TableHead>
            <TableHead>
              <span className="sr-only">{t("common.actions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users?.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <Link to={`/users/${user.id}`} className="text-primary hover:underline">
                  {user.email}
                </Link>
              </TableCell>
              <TableCell>{user.displayName}</TableCell>
              <TableCell className="space-x-1">
                <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                  {user.role === "admin" ? t("users.admin") : t("users.teacher")}
                </Badge>
                {user.disabled && <Badge variant="outline">{t("users.disabled")}</Badge>}
                {user.pending && <Badge variant="destructive">{t("users.pending")}</Badge>}
                {user.unverified && <Badge variant="outline">{t("users.unverified")}</Badge>}
              </TableCell>
              <TableCell className="space-x-1 text-right whitespace-nowrap">
                {user.pending && (
                  <>
                    <Button
                      size="sm"
                      onClick={() =>
                        run(
                          () => unwrap(api.users[":id"].approve.$post({ param: { id: String(user.id) } })),
                          t("users.approvedToast", { email: user.email }),
                        )
                      }
                    >
                      {t("users.approve")}
                    </Button>
                    <ConfirmButton
                      size="sm"
                      title={t("users.declineTitle", { email: user.email })}
                      description={t("users.declineDescription")}
                      confirmLabel={t("users.decline")}
                      onConfirm={async () => {
                        await unwrap(api.users[":id"].$delete({ param: { id: String(user.id) } }));
                        await refresh();
                      }}
                    >
                      {t("users.decline")}
                    </ConfirmButton>
                  </>
                )}
                {user.unverified && !user.pending && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      run(
                        () => unwrap(api.users[":id"].invite.$post({ param: { id: String(user.id) } })),
                        t("users.invitedToast", { email: user.email }),
                      )
                    }
                  >
                    {t("users.inviteAgain")}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}

function CreateUserButton() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const form = useZodForm(createUserInput, {
    defaultValues: { email: "", displayName: "", role: "teacher" },
  });
  const role = form.watch("role");
  const { data: instance } = useInstance();
  const invites = instance?.emailEnabled ?? false;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const res = await unwrap(api.users.$post({ json: values }));
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      setOpen(false);
      form.reset();
      if (res.password) setCreated({ email: res.user.email, password: res.password });
      if (res.invited) toast.success(t("users.inviteSentToast", { email: res.user.email }));
    } catch (error) {
      applyServerError(form, error);
    }
  });

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>{t("users.add")}</Button>
        </DialogTrigger>
        <DialogContent>
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <DialogHeader>
              <DialogTitle>{t("users.add")}</DialogTitle>
              <DialogDescription>
                {invites ? t("users.addDescriptionEmail") : t("users.addDescriptionPassword")}
              </DialogDescription>
            </DialogHeader>
            <TextField form={form} name="email" label={t("users.email")} type="email" autoFocus />
            <TextField form={form} name="displayName" label={t("users.name")} />
            <div className="grid gap-1.5">
              <Label htmlFor="new-user-role">{t("users.role")}</Label>
              <Select
                value={role}
                onValueChange={(v) => form.setValue("role", v as "admin" | "teacher")}
              >
                <SelectTrigger id="new-user-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">{t("users.teacher")}</SelectItem>
                  <SelectItem value="admin">{t("users.admin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <FormError form={form} />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {t("users.add")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <SecretDialog
        secret={created?.password ?? null}
        title={t("users.createdTitle")}
        description={t("users.createdDescription", { email: created?.email ?? "" })}
        onClose={() => setCreated(null)}
      />
    </>
  );
}
