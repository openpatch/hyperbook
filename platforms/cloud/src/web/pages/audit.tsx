import { useInfiniteQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, unwrap } from "@/lib/api";

const ACTIONS: Record<string, string> = {
  login: "logged in",
  "password.change": "changed their password",
  "password.reset": "reset their password by email",
  "instance.update": "changed the settings",
  "user.create": "added a user",
  "user.update": "changed a user",
  "user.delete": "deleted a user",
  "user.password.set": "set a new password for a user",
  "user.entitlements.set": "changed a user's entitlements",
  "book.create": "created a book",
  "book.update": "changed a book",
  "book.delete": "deleted a book",
  "book.member.add": "added someone to a book",
  "book.member.update": "changed someone's role in a book",
  "book.member.remove": "removed someone from a book",
  "book.upload": "uploaded a book",
  "book.rebuild": "rebuilt a book",
  "book.publish": "published a book",
  "book.unpublish": "unpublished a book",
  "book.build.cancel": "canceled a build",
  "group.create": "added a group",
  "group.rename": "renamed a group",
  "group.delete": "deleted a group",
  "student.create": "added a student",
  "student.generate": "created student accounts",
  "student.update": "changed a student",
  "student.delete": "deleted a student",
  "student.password.reset": "set a new student password",
  "student.login-key.regenerate": "made a new QR code for a student",
  "student.login-keys.regenerate": "made new QR codes for a group",
  "student.credentials.view": "viewed or printed student passwords",
  "student.impersonate": "viewed a student's work",
  "student.data.download": "downloaded a student's saved data",
};

/** A short readable summary of the stored details. */
function details(data: Record<string, unknown> | null): string {
  if (!data) return "";
  return Object.entries(data)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(", ");
}

export function AuditPage() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["audit"],
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) =>
      unwrap(
        api.audit.$get({
          query: pageParam ? { before: String(pageParam), limit: "50" } : { limit: "50" },
        }),
      ),
    getNextPageParam: (last) => last.next ?? undefined,
  });
  const entries = data?.pages.flatMap((p) => p.entries) ?? [];

  return (
    <>
      <PageHeader
        title="Activity"
        description="Who changed what, and who looked at student passwords."
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Who</TableHead>
            <TableHead>What</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {new Date(e.createdAt).toLocaleString()}
              </TableCell>
              <TableCell>{e.actorEmail ?? "deleted user"}</TableCell>
              <TableCell>
                {ACTIONS[e.action] ?? e.action}
                {e.targetId !== null && (
                  <span className="text-muted-foreground">
                    {" "}
                    ({e.targetType} {e.targetId})
                  </span>
                )}
              </TableCell>
              <TableCell className="max-w-xs truncate text-sm text-muted-foreground" title={details(e.data)}>
                {details(e.data)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {hasNextPage && (
        <Button variant="outline" className="mt-4" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
          Show older
        </Button>
      )}
    </>
  );
}
