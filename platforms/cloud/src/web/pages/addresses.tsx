import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { PageHeader, Section } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api, unwrap } from "@/lib/api";

const load = () => unwrap(api["slug-requests"].$get());

type Request = Awaited<ReturnType<typeof load>>["pending"][number];

/** Admins decide which books get addresses without an ending (suffix mode). */
export function AddressesPage() {
  const { data } = useQuery({ queryKey: ["slug-requests"], queryFn: load });
  return (
    <>
      <PageHeader
        title="Addresses"
        description="Teachers ask for short addresses without their book's ending. Look at the book, then decide."
      />
      <Section title="Requests">
        {data && data.pending.length === 0 && <p className="text-muted-foreground">No open requests.</p>}
        <div className="grid gap-4">
          {data?.pending.map((request) => <RequestCard key={request.id} request={request} />)}
        </div>
      </Section>
      <Section
        title="Granted addresses"
        description="To take one back, open the book."
      >
        {data && data.granted.length === 0 ? (
          <p className="text-muted-foreground">None yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Address</TableHead>
                <TableHead>Book</TableHead>
                <TableHead>Since</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.granted.map((book) => (
                <TableRow key={book.id}>
                  <TableCell>
                    <a href={book.url} target="_blank" rel="noreferrer" className="font-mono text-primary hover:underline">
                      {book.slug}
                    </a>
                  </TableCell>
                  <TableCell>
                    <Link to={`/books/${book.id}`} className="text-primary hover:underline">
                      {book.title}
                    </Link>
                  </TableCell>
                  <TableCell>{new Date(book.grantedAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </>
  );
}

function RequestCard({ request }: { request: Request }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const noteId = `note-${request.id}`;

  const decide = async (decision: "approve" | "decline") => {
    setBusy(true);
    try {
      const param = { id: String(request.id) };
      await unwrap(
        decision === "approve"
          ? api["slug-requests"][":id"].approve.$post({ param, json: { note } })
          : api["slug-requests"][":id"].decline.$post({ param, json: { note } }),
      );
      await queryClient.invalidateQueries({ queryKey: ["slug-requests"] });
      await queryClient.invalidateQueries({ queryKey: ["books"] });
      toast.success(decision === "approve" ? `${request.slug} granted` : "Declined");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="grid max-w-3xl gap-3 rounded-lg border bg-card p-4" aria-label={`Request for ${request.slug}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-mono text-lg">{request.slug}</h3>
        <span className="text-sm text-muted-foreground">
          {request.requestedBy?.displayName || request.requestedBy?.email || "Deleted account"},{" "}
          {new Date(request.createdAt).toLocaleDateString()}
        </span>
      </div>
      <p className="text-sm">
        For{" "}
        <Link to={`/books/${request.book.id}`} className="text-primary hover:underline">
          {request.book.title}
        </Link>
        , now at{" "}
        <a href={request.book.url} target="_blank" rel="noreferrer" className="font-mono text-primary hover:underline">
          {request.book.url.replace(/^https?:\/\//, "")}
        </a>
      </p>
      <p className="text-sm whitespace-pre-wrap">{request.description}</p>
      {request.takenBy && (
        <p className="text-sm text-destructive">
          “{request.takenBy.title}” has this address now. Approving works once it is free.
        </p>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor={noteId}>Note to the teacher (optional)</Label>
        <Textarea id={noteId} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || request.takenBy !== null} onClick={() => decide("approve")}>
          Grant {request.slug}
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => decide("decline")}>
          Decline
        </Button>
      </div>
    </article>
  );
}
