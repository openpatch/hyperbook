import { useQuery, useQueryClient } from "@tanstack/react-query";
import i18next from "i18next";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  createStudentInput,
  generateStudentsInput,
  groupInput,
} from "../../shared/schemas";
import { ConfirmButton, ConfirmDialog } from "@/components/confirm-button";
import { PageHeader, Section } from "@/components/page-header";
import { QueryState } from "@/components/query-state";
import { SecretDialog } from "@/components/secret-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, unwrap } from "@/lib/api";
import { FormError, TextField, applyServerError, useZodForm } from "@/lib/form";

export function GroupPage() {
  const { t } = useTranslation();
  const id = useParams().id!;
  const groupQuery = useQuery({
    queryKey: ["groups", id],
    queryFn: () => unwrap(api.groups[":id"].$get({ param: { id } })),
  });
  const { data: students } = useQuery({
    queryKey: ["groups", id, "students"],
    queryFn: () => unwrap(api.groups[":id"].students.$get({ param: { id } })),
  });
  const group = groupQuery.data;

  if (!group) return <QueryState error={groupQuery.error} retry={groupQuery.refetch} />;

  return (
    <>
      <PageHeader
        title={group.name}
        description={
          <Link
            to={`/books/${group.book.id}`}
            className="text-primary hover:underline"
          >
            {group.book.title}
          </Link>
        }
        actions={
          <>
            <Button asChild variant={students?.length ? "default" : "outline"}>
              <Link to={`/groups/${id}/print`}>{t("group.print")}</Link>
            </Button>
            <GenerateButton groupId={id} />
          </>
        }
      />
      <Section
        title={t("group.students")}
        description={t("group.studentsDescription")}
      >
        {students?.length === 0 ? (
          <p className="text-muted-foreground">{t("group.noStudents")}</p>
        ) : (
          <StudentsTable
            groupId={id}
            bookId={group.book.id}
            students={students ?? []}
          />
        )}
        <AddStudentForm groupId={id} />
      </Section>
      <GroupSettings
        groupId={id}
        name={group.name}
        bookId={group.book.id}
        hasStudents={!!students?.length}
      />
    </>
  );
}

type Student = {
  id: number;
  username: string;
  lastLoginAt: number | null;
  lastSavedAt: number | null;
};

/**
 * Opens the student's book read-only in a new tab. The tab is opened right
 * away, inside the click, so popup blockers allow it; the address follows
 * once the server has made the one-time link.
 */
async function viewAsStudent(studentId: number) {
  const tab = window.open("", "_blank");
  try {
    const { url } = await unwrap(
      api.students[":id"].impersonate.$post({
        param: { id: String(studentId) },
      }),
    );
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else {
      window.location.href = url;
    }
  } catch (error) {
    tab?.close();
    toast.error(
      error instanceof Error
        ? error.message
        : i18next.t("common.somethingWrong"),
    );
  }
}

const printPath = (groupId: string, ids: number[]) =>
  `/groups/${groupId}/print?students=${ids.join(",")}`;

/** Which dialog is open, and for which students. */
type Pending =
  | { kind: "delete"; students: Student[] }
  | { kind: "move"; students: Student[] }
  | null;

function StudentsTable({
  groupId,
  bookId,
  students,
}: {
  groupId: string;
  bookId: number;
  students: Student[];
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [secret, setSecret] = useState<{
    username: string;
    password: string;
  } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, setPending] = useState<Pending>(null);
  const { data: groups } = useQuery({
    queryKey: ["books", String(bookId), "groups"],
    queryFn: () =>
      unwrap(api.books[":id"].groups.$get({ param: { id: String(bookId) } })),
  });
  const otherGroups = (groups ?? []).filter((g) => String(g.id) !== groupId);

  // A selection never names students that are gone (deleted, moved away).
  const chosen = students.filter((s) => selected.has(s.id));
  const allChosen = students.length > 0 && chosen.length === students.length;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["groups", groupId] });
    await queryClient.invalidateQueries({
      queryKey: ["books", String(bookId), "groups"],
    });
  };

  const act = async (action: () => Promise<unknown>, done?: string) => {
    try {
      await action();
      await refresh();
      if (done) toast.success(done);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("common.somethingWrong"),
      );
    }
  };

  const newQrCodes = (list: Student[]) =>
    act(async () => {
      for (const s of list) {
        await unwrap(
          api.students[":id"]["login-key"].regenerate.$post({
            param: { id: String(s.id) },
          }),
        );
      }
      // The old cards stopped working: offer the new ones right away.
      toast.success(
        list.length === 1
          ? t("group.qrToast", { username: list[0]!.username })
          : t("group.newQrSelectedToast", { count: list.length }),
        {
          action: {
            label: list.length === 1 ? t("group.printCard") : t("group.printSelected"),
            onClick: () => navigate(printPath(groupId, list.map((s) => s.id))),
          },
        },
      );
    });

  const toggle = (id: number, on: boolean) =>
    setSelected((old) => {
      const next = new Set(old);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <>
      {chosen.length > 0 && (
        <div
          role="toolbar"
          aria-label={t("group.selected", { count: chosen.length })}
          className="mb-3 flex flex-wrap items-center gap-2 rounded-md bg-muted px-3 py-2"
        >
          <span className="mr-auto text-sm font-medium">
            {t("group.selected", { count: chosen.length })}
          </span>
          <Button asChild size="sm" variant="outline">
            <Link to={printPath(groupId, chosen.map((s) => s.id))}>
              {t("group.printSelected")}
            </Link>
          </Button>
          <Button size="sm" variant="outline" onClick={() => newQrCodes(chosen)}>
            {t("group.newQrSelected")}
          </Button>
          {otherGroups.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPending({ kind: "move", students: chosen })}
            >
              {t("group.moveSelected")}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="text-destructive"
            onClick={() => setPending({ kind: "delete", students: chosen })}
          >
            {t("group.deleteSelected")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            {t("group.clearSelection")}
          </Button>
        </div>
      )}
      <Table className="mb-6">
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <Checkbox
                aria-label={t("group.selectAll")}
                checked={allChosen ? true : chosen.length > 0 ? "indeterminate" : false}
                onCheckedChange={(on) =>
                  setSelected(on === true ? new Set(students.map((s) => s.id)) : new Set())
                }
              />
            </TableHead>
            <TableHead>{t("group.username")}</TableHead>
            <TableHead>{t("group.lastLogin")}</TableHead>
            <TableHead>{t("group.lastSaved")}</TableHead>
            <TableHead>
              <span className="sr-only">{t("common.actions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((s) => (
            <TableRow key={s.id} data-state={selected.has(s.id) ? "selected" : undefined}>
              <TableCell>
                <Checkbox
                  aria-label={t("group.selectStudent", { username: s.username })}
                  checked={selected.has(s.id)}
                  onCheckedChange={(on) => toggle(s.id, on === true)}
                />
              </TableCell>
              <TableCell className="font-mono">{s.username}</TableCell>
              <TableCell className="text-muted-foreground">
                {s.lastLoginAt
                  ? new Date(s.lastLoginAt).toLocaleString()
                  : t("common.never")}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {s.lastSavedAt
                  ? new Date(s.lastSavedAt).toLocaleString()
                  : t("group.nothingYet")}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t("group.actionsFor", {
                        username: s.username,
                      })}
                    >
                      …
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => viewAsStudent(s.id)}>
                      {t("group.viewAs")}
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={printPath(groupId, [s.id])}>{t("group.printCard")}</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href={`/api/students/${s.id}/data`} download>
                        {t("group.downloadData")}
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() =>
                        act(async () => {
                          const res = await unwrap(
                            api.students[":id"].password.$put({
                              param: { id: String(s.id) },
                              json: {},
                            }),
                          );
                          setSecret({
                            username: s.username,
                            password: res.password,
                          });
                        })
                      }
                    >
                      {t("group.newPassword")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => newQrCodes([s])}>
                      {t("group.newQr")}
                    </DropdownMenuItem>
                    {otherGroups.length > 0 && (
                      <DropdownMenuItem
                        onSelect={() => setPending({ kind: "move", students: [s] })}
                      >
                        {t("group.moveTo")}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setPending({ kind: "delete", students: [s] })}
                    >
                      {t("group.deleteStudent")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ConfirmDialog
        open={pending?.kind === "delete"}
        onOpenChange={(open) => !open && setPending(null)}
        title={t("group.deleteStudentTitle", {
          count: pending?.students.length ?? 1,
          username: pending?.students[0]?.username ?? "",
        })}
        description={t("group.deleteStudentDescription", {
          count: pending?.students.length ?? 1,
        })}
        confirmLabel={t("group.deleteStudentConfirm", {
          count: pending?.students.length ?? 1,
        })}
        onConfirm={async () => {
          const list = pending?.students ?? [];
          for (const s of list) {
            await unwrap(api.students[":id"].$delete({ param: { id: String(s.id) } }));
          }
          setSelected(new Set());
          await refresh();
          toast.success(
            list.length === 1
              ? t("group.deletedToast", { username: list[0]!.username })
              : t("group.deletedManyToast", { count: list.length }),
          );
        }}
      />
      <MoveDialog
        students={pending?.kind === "move" ? pending.students : null}
        groups={otherGroups}
        onClose={() => setPending(null)}
        onMoved={async () => {
          setSelected(new Set());
          await refresh();
        }}
      />
      <SecretDialog
        secret={secret?.password ?? null}
        title={t("group.newDialogTitle")}
        description={t("group.newDialogDescription", {
          username: secret?.username ?? "",
        })}
        onClose={() => setSecret(null)}
      />
    </>
  );
}

/** Moves students to another group of the same book; their work stays. */
function MoveDialog({
  students,
  groups,
  onClose,
  onMoved,
}: {
  students: Student[] | null;
  groups: { id: number; name: string }[];
  onClose: () => void;
  onMoved: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const count = students?.length ?? 1;
  const move = async () => {
    const group = groups.find((g) => String(g.id) === target);
    if (!students || !group) return;
    setBusy(true);
    try {
      for (const s of students) {
        await unwrap(
          api.students[":id"].$patch({
            param: { id: String(s.id) },
            json: { groupId: group.id },
          }),
        );
      }
      await onMoved();
      toast.success(t("group.movedToast", { count, group: group.name }));
      setTarget("");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={students !== null}
      onOpenChange={(open) => {
        if (!open) {
          setTarget("");
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("group.moveTitle", { count, username: students?.[0]?.username ?? "" })}
          </DialogTitle>
          <DialogDescription>{t("group.moveDescription")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="move-target">{t("group.moveTarget")}</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger id="move-target" className="w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.id} value={String(g.id)}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!target || busy} onClick={move}>
            {t("group.moveConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GenerateButton({ groupId }: { groupId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const form = useZodForm(generateStudentsInput, {
    defaultValues: { count: 25, prefix: "student", passwordLength: 6 },
  });
  const prefix = form.watch("prefix");

  const onSubmit = form.handleSubmit(async (json) => {
    try {
      await unwrap(
        api.groups[":id"].students.generate.$post({
          param: { id: groupId },
          json,
        }),
      );
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
        <Button variant="outline">{t("group.create")}</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{t("group.createTitle")}</DialogTitle>
            <DialogDescription>
              {t("group.createDescription")}
            </DialogDescription>
          </DialogHeader>
          <TextField
            form={form}
            name="count"
            label={t("group.count")}
            type="number"
            min={1}
            max={200}
            autoFocus
          />
          <TextField
            form={form}
            name="prefix"
            label={t("group.prefix")}
            hint={t("group.prefixHint", { prefix: prefix || "student" })}
          />
          <TextField
            form={form}
            name="passwordLength"
            label={t("group.passwordLength")}
            type="number"
            min={4}
            max={20}
          />
          <FormError form={form} />
          <DialogFooter>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {t("group.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddStudentForm({ groupId }: { groupId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const form = useZodForm(createStudentInput.pick({ username: true }), {
    defaultValues: { username: "" },
  });
  const onSubmit = form.handleSubmit(async (json) => {
    try {
      await unwrap(
        api.groups[":id"].students.$post({ param: { id: groupId }, json }),
      );
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ["groups", groupId] });
    } catch (error) {
      applyServerError(form, error);
    }
  });
  return (
    <form
      onSubmit={onSubmit}
      className="flex max-w-xl flex-wrap items-end gap-2"
      noValidate
    >
      <TextField
        form={form}
        name="username"
        label={t("group.addOne")}
        placeholder="username"
        hint={t("group.addOneHint")}
        className="min-w-48 flex-1"
      />
      <Button
        type="submit"
        variant="outline"
        className="mb-6"
        disabled={form.formState.isSubmitting}
      >
        {t("group.add")}
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
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const form = useZodForm(groupInput, { defaultValues: { name } });
  const onSubmit = form.handleSubmit(async (json) => {
    try {
      await unwrap(api.groups[":id"].$patch({ param: { id: groupId }, json }));
      await queryClient.invalidateQueries({ queryKey: ["groups", groupId] });
      await queryClient.invalidateQueries({
        queryKey: ["books", String(bookId), "groups"],
      });
      toast.success(t("common.saved"));
    } catch (error) {
      applyServerError(form, error);
    }
  });

  return (
    <Section title={t("group.settings")}>
      <form
        onSubmit={onSubmit}
        className="mb-6 flex max-w-xl flex-wrap items-end gap-2"
        noValidate
      >
        <TextField
          form={form}
          name="name"
          label={t("group.name")}
          className="min-w-48 flex-1"
        />
        <Button
          type="submit"
          variant="outline"
          disabled={form.formState.isSubmitting}
        >
          {t("group.rename")}
        </Button>
        <div className="basis-full">
          <FormError form={form} />
        </div>
      </form>
      <div className="flex flex-wrap gap-2">
        {hasStudents && (
          <ConfirmButton
            variant="default"
            title={t("group.newQrAllTitle")}
            description={t("group.newQrAllDescription")}
            confirmLabel={t("group.newQrAllConfirm")}
            onConfirm={async () => {
              await unwrap(
                api.groups[":id"]["login-keys"].regenerate.$post({
                  param: { id: groupId },
                }),
              );
              toast.success(t("group.newQrAllToast"));
            }}
          >
            {t("group.newQrAll")}
          </ConfirmButton>
        )}
        <ConfirmButton
          title={t("group.deleteTitle", { name })}
          description={t("group.deleteDescription")}
          confirmLabel={t("group.delete")}
          onConfirm={async () => {
            await unwrap(api.groups[":id"].$delete({ param: { id: groupId } }));
            await queryClient.invalidateQueries({
              queryKey: ["books", String(bookId), "groups"],
            });
            navigate(`/books/${bookId}`);
          }}
        >
          {t("group.delete")}
        </ConfirmButton>
      </div>
    </Section>
  );
}
