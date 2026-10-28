import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { createStudentInput, generateStudentsInput, groupInput } from "../../shared/schemas";
import { ConfirmButton } from "@/components/confirm-button";
import { PageHeader, Section } from "@/components/page-header";
import { SecretDialog } from "@/components/secret-dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, unwrap } from "@/lib/api";
import { FormError, TextField, applyServerError, useZodForm } from "@/lib/form";

export function GroupPage() {
  const id = useParams().id!;
  const { data: group } = useQuery({
    queryKey: ["groups", id],
    queryFn: () => unwrap(api.groups[":id"].$get({ param: { id } })),
  });
  const { data: students } = useQuery({
    queryKey: ["groups", id, "students"],
    queryFn: () => unwrap(api.groups[":id"].students.$get({ param: { id } })),
  });

  if (!group) return null;

  return (
    <>
      <PageHeader
        title={group.name}
        description={
          <Link to={`/books/${group.book.id}`} className="text-primary hover:underline">
            {group.book.title}
          </Link>
        }
        actions={
          <>
            <Button asChild variant={students?.length ? "default" : "outline"}>
              <Link to={`/groups/${id}/print`}>Print login cards</Link>
            </Button>
            <GenerateButton groupId={id} />
          </>
        }
      />
      <Section
        title="Students"
        description="Accounts are anonymous: write the real names on your printed list, not here."
      >
        {students?.length === 0 ? (
          <p className="text-muted-foreground">
            No students yet. Use “Create accounts” to make a set of accounts for this group.
          </p>
        ) : (
          <StudentsTable groupId={id} students={students ?? []} />
        )}
        <AddStudentForm groupId={id} />
      </Section>
      <GroupSettings groupId={id} name={group.name} bookId={group.book.id} hasStudents={!!students?.length} />
    </>
  );
}

type Student = { id: number; username: string; lastLoginAt: number | null; lastSavedAt: number | null };

/**
 * Opens the student's book read-only in a new tab. The tab is opened right
 * away, inside the click, so popup blockers allow it; the address follows
 * once the server has made the one-time link.
 */
async function viewAsStudent(studentId: number) {
  const tab = window.open("", "_blank");
  try {
    const { url } = await unwrap(api.students[":id"].impersonate.$post({ param: { id: String(studentId) } }));
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else {
      window.location.href = url;
    }
  } catch (error) {
    tab?.close();
    toast.error(error instanceof Error ? error.message : "Something went wrong");
  }
}

function StudentsTable({ groupId, students }: { groupId: string; students: Student[] }) {
  const queryClient = useQueryClient();
  const [secret, setSecret] = useState<{ username: string; password: string } | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["groups", groupId] });

  const act = async (action: () => Promise<unknown>, done?: string) => {
    try {
      await action();
      await refresh();
      if (done) toast.success(done);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    }
  };

  return (
    <>
      <Table className="mb-6">
        <TableHeader>
          <TableRow>
            <TableHead>Username</TableHead>
            <TableHead>Last login</TableHead>
            <TableHead>Last saved</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-mono">{s.username}</TableCell>
              <TableCell className="text-muted-foreground">
                {s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleString() : "never"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {s.lastSavedAt ? new Date(s.lastSavedAt).toLocaleString() : "nothing yet"}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" aria-label={`Actions for ${s.username}`}>
                      …
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => viewAsStudent(s.id)}>View as student</DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href={`/api/students/${s.id}/data`} download>
                        Download saved data
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        act(async () => {
                          const res = await unwrap(
                            api.students[":id"].password.$put({
                              param: { id: String(s.id) },
                              json: {},
                            }),
                          );
                          setSecret({ username: s.username, password: res.password });
                        })
                      }
                    >
                      New password
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        act(
                          () =>
                            unwrap(
                              api.students[":id"]["login-key"].regenerate.$post({
                                param: { id: String(s.id) },
                              }),
                            ),
                          `New QR code for ${s.username}. The old card no longer works.`,
                        )
                      }
                    >
                      New QR code
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() =>
                        act(
                          () => unwrap(api.students[":id"].$delete({ param: { id: String(s.id) } })),
                          `${s.username} deleted`,
                        )
                      }
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <SecretDialog
        secret={secret?.password ?? null}
        title="New password"
        description={`The new password for ${secret?.username}. It also appears on the printed cards.`}
        onClose={() => setSecret(null)}
      />
    </>
  );
}

function GenerateButton({ groupId }: { groupId: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const form = useZodForm(generateStudentsInput, {
    defaultValues: { count: 25, prefix: "student", passwordLength: 6 },
  });
  const prefix = form.watch("prefix");

  const onSubmit = form.handleSubmit(async (json) => {
    try {
      await unwrap(api.groups[":id"].students.generate.$post({ param: { id: groupId }, json }));
      await queryClient.invalidateQueries({ queryKey: ["groups", groupId] });
      setOpen(false);
      navigate(`/groups/${groupId}/print`);
    } catch (error) {
      applyServerError(form, error);
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Create accounts</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Create student accounts</DialogTitle>
            <DialogDescription>
              Each account gets a username, a short password and a QR code for quick login.
              Afterwards you can print them.
            </DialogDescription>
          </DialogHeader>
          <TextField form={form} name="count" label="How many" type="number" min={1} max={200} autoFocus />
          <TextField
            form={form}
            name="prefix"
            label="Username prefix"
            hint={`Usernames will be ${prefix || "student"}01, ${prefix || "student"}02, …`}
          />
          <TextField
            form={form}
            name="passwordLength"
            label="Password length"
            type="number"
            min={4}
            max={20}
          />
          <FormError form={form} />
          <DialogFooter>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Create accounts
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddStudentForm({ groupId }: { groupId: string }) {
  const queryClient = useQueryClient();
  const form = useZodForm(createStudentInput.pick({ username: true }), {
    defaultValues: { username: "" },
  });
  const onSubmit = form.handleSubmit(async (json) => {
    try {
      await unwrap(api.groups[":id"].students.$post({ param: { id: groupId }, json }));
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ["groups", groupId] });
    } catch (error) {
      applyServerError(form, error);
    }
  });
  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-wrap items-end gap-2" noValidate>
      <TextField
        form={form}
        name="username"
        label="Add one account"
        placeholder="username"
        hint="Gets a generated password and QR code."
        className="min-w-48 flex-1"
      />
      <Button type="submit" variant="outline" className="mb-6" disabled={form.formState.isSubmitting}>
        Add
      </Button>
      <div className="basis-full">
        <FormError form={form} />
      </div>
    </form>
  );
}

function GroupSettings({
  groupId,
  name,
  bookId,
  hasStudents,
}: {
  groupId: string;
  name: string;
  bookId: number;
  hasStudents: boolean;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const form = useZodForm(groupInput, { defaultValues: { name } });
  const onSubmit = form.handleSubmit(async (json) => {
    try {
      await unwrap(api.groups[":id"].$patch({ param: { id: groupId }, json }));
      await queryClient.invalidateQueries({ queryKey: ["groups", groupId] });
      await queryClient.invalidateQueries({ queryKey: ["books", String(bookId), "groups"] });
      toast.success("Saved");
    } catch (error) {
      applyServerError(form, error);
    }
  });

  return (
    <Section title="Group">
      <form onSubmit={onSubmit} className="mb-6 flex max-w-xl flex-wrap items-end gap-2" noValidate>
        <TextField form={form} name="name" label="Name" className="min-w-48 flex-1" />
        <Button type="submit" variant="outline" disabled={form.formState.isSubmitting}>
          Rename
        </Button>
        <div className="basis-full">
          <FormError form={form} />
        </div>
      </form>
      <div className="flex flex-wrap gap-2">
        {hasStudents && (
          <ConfirmButton
            variant="default"
            title="New QR codes for everyone?"
            description="All printed QR codes of this group stop working. Passwords stay the same. Print the cards again afterwards."
            confirmLabel="Make new QR codes"
            onConfirm={async () => {
              await unwrap(api.groups[":id"]["login-keys"].regenerate.$post({ param: { id: groupId } }));
              toast.success("New QR codes made. Print the cards again.");
            }}
          >
            New QR codes for everyone
          </ConfirmButton>
        )}
        <ConfirmButton
          title={`Delete group “${name}”?`}
          description="The group and all its student accounts, with everything they saved, are deleted. This cannot be undone."
          confirmLabel="Delete group"
          onConfirm={async () => {
            await unwrap(api.groups[":id"].$delete({ param: { id: groupId } }));
            await queryClient.invalidateQueries({ queryKey: ["books", String(bookId), "groups"] });
            navigate(`/books/${bookId}`);
          }}
        >
          Delete group
        </ConfirmButton>
      </div>
    </Section>
  );
}
