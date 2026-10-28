import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
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
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    }
  };

  return (
    <>
      <PageHeader
        title="Users"
        description="Teachers and admins of this instance. Students are managed per book."
        actions={<CreateUserButton />}
      />
      <Table>
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
                  {user.role === "admin" ? "Admin" : "Teacher"}
                </Badge>
                {user.disabled && <Badge variant="outline">Disabled</Badge>}
                {user.pending && <Badge variant="destructive">Waits for approval</Badge>}
                {user.unverified && <Badge variant="outline">Email not confirmed</Badge>}
              </TableCell>
              <TableCell className="space-x-1 text-right whitespace-nowrap">
                {user.pending && (
                  <>
                    <Button
                      size="sm"
                      onClick={() =>
                        run(
                          () => unwrap(api.users[":id"].approve.$post({ param: { id: String(user.id) } })),
                          `${user.email} is approved.`,
                        )
                      }
                    >
                      Approve
                    </Button>
                    <ConfirmButton
                      size="sm"
                      title={`Decline ${user.email}?`}
                      description="The account is deleted."
                      confirmLabel="Decline"
                      onConfirm={async () => {
                        await unwrap(api.users[":id"].$delete({ param: { id: String(user.id) } }));
                        await refresh();
                      }}
                    >
                      Decline
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
                        `A new invitation went to ${user.email}.`,
                      )
                    }
                  >
                    Invite again
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
      if (res.invited) toast.success(`An invitation went to ${res.user.email}.`);
    } catch (error) {
      applyServerError(form, error);
    }
  });

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>Add user</Button>
        </DialogTrigger>
        <DialogContent>
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <DialogHeader>
              <DialogTitle>Add user</DialogTitle>
              <DialogDescription>
                {invites
                  ? "They get an email with a link to choose their password."
                  : "A password is generated and shown once. Give it to the person; they can change it under “Your account”."}
              </DialogDescription>
            </DialogHeader>
            <TextField form={form} name="email" label="Email" type="email" autoFocus />
            <TextField form={form} name="displayName" label="Name" />
            <div className="grid gap-1.5">
              <Label htmlFor="new-user-role">Role</Label>
              <Select
                value={role}
                onValueChange={(v) => form.setValue("role", v as "admin" | "teacher")}
              >
                <SelectTrigger id="new-user-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <FormError form={form} />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Add user
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <SecretDialog
        secret={created?.password ?? null}
        title="User added"
        description={`The password for ${created?.email} is shown only now.`}
        onClose={() => setCreated(null)}
      />
    </>
  );
}
