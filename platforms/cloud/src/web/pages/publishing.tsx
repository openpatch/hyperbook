import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DownloadIcon, UploadIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/confirm-button";
import { Section } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError, api, unwrap } from "@/lib/api";
import type { Book } from "@/lib/books";
import { cn } from "@/lib/utils";

type Build = Awaited<ReturnType<typeof fetchBuilds>>[number];

const fetchBuilds = (id: string) => unwrap(api.books[":id"].builds.$get({ param: { id } }));

const STATUS: Record<Build["status"], { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }> = {
  queued: { label: "Waiting", variant: "secondary" },
  running: { label: "Building", variant: "secondary" },
  succeeded: { label: "Built", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
  canceled: { label: "Canceled", variant: "outline" },
};

const TRIGGER: Record<Build["trigger"], string> = {
  upload: "upload",
  rebuild: "rebuild",
  edit: "save (preview)",
  publish: "publish",
  upgrade: "Hyperbook update",
};

const active = (b: Build) => b.status === "queued" || b.status === "running";

function duration(b: Build): string {
  if (!b.startedAt) return "";
  const ms = (b.finishedAt ?? Date.now()) - b.startedAt;
  return ms < 60_000 ? `${Math.round(ms / 1000)} s` : `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s`;
}

type UploadResult = { files: number; changed: boolean; skipped: string[]; build: Build };

/** The upload goes as multipart, which the typed client does not model. */
function uploadZip(bookId: string, file: File, onProgress: (fraction: number) => void) {
  return new Promise<UploadResult>((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/books/${bookId}/source`);
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.onload = () => {
      const body = (xhr.response ?? {}) as UploadResult & { error?: string };
      if (xhr.status === 200) resolve(body);
      else reject(new ApiError(body.error ?? `Request failed (${xhr.status})`, xhr.status));
    };
    xhr.send(form);
  });
}

export function PublishingSection({ book }: { book: Book }) {
  const queryClient = useQueryClient();
  const id = String(book.id);
  const key = ["books", id, "builds"];
  const { data: builds } = useQuery({
    queryKey: key,
    queryFn: () => fetchBuilds(id),
    // Follow builds while one is waiting or running.
    refetchInterval: (query) => (query.state.data?.some(active) ? 1500 : false),
  });
  const [logFor, setLogFor] = useState<number | null>(null);

  // A finished build may have changed what is published.
  const latest = builds?.[0];
  const latestState = latest ? `${latest.id}:${latest.status}` : "";
  useEffect(() => {
    if (latest && !active(latest)) void queryClient.invalidateQueries({ queryKey: ["books", id], exact: true });
  }, [latestState]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    }
  };

  const hasSource = (builds?.length ?? 0) > 0;

  return (
    <Section
      title="Publishing"
      description="Edit the book in the browser and publish it when it is ready, or upload it as a zip, which is built and published right away."
    >
      <p className="mb-4">
        {book.publishedAt ? (
          <>
            Published {new Date(book.publishedAt).toLocaleString()} at{" "}
            <a href={book.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              {book.url.replace(/^https?:\/\//, "")}
            </a>
          </>
        ) : (
          <span className="text-muted-foreground">Not published yet.</span>
        )}
      </p>

      <UploadZone bookId={id} onUploaded={refresh} onLog={setLogFor} />

      <div className="my-4 flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={!hasSource}
          onClick={() => run(() => unwrap(api.books[":id"].builds.$post({ param: { id } })))}
        >
          Rebuild
        </Button>
        <Button variant="outline" disabled={!hasSource} asChild={hasSource}>
          {hasSource ? <a href={`/api/books/${id}/source.zip`}>Download source</a> : <span>Download source</span>}
        </Button>
        {book.publishedAt && (
          <ConfirmButton
            title={`Unpublish “${book.title}”?`}
            description="The address shows “not published” until the next build. Nothing is deleted."
            confirmLabel="Unpublish"
            onConfirm={async () => {
              await unwrap(api.books[":id"].unpublish.$post({ param: { id } }));
              await queryClient.invalidateQueries({ queryKey: ["books", id], exact: true });
              await refresh();
            }}
          >
            Unpublish
          </ConfirmButton>
        )}
      </div>

      {hasSource && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Build</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Started by</TableHead>
              <TableHead>When</TableHead>
              <TableHead>Took</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {builds!.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  #{b.id} {TRIGGER[b.trigger]}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS[b.status].variant}>
                      {STATUS[b.status].label}
                      {b.progress && ` ${b.progress.done}/${b.progress.total}`}
                    </Badge>
                    {b.published && <Badge variant="outline">Live</Badge>}
                    {b.status === "succeeded" && (
                      <a
                        href={`/api/books/${id}/builds/${b.id}/site.zip`}
                        className="text-sm text-primary hover:underline"
                        title="Download the built book as a ZIP archive, to host it elsewhere. Student logins only work on this platform."
                      >
                        Download
                      </a>
                    )}
                  </div>
                  {b.error && <p className="mt-1 max-w-sm text-sm whitespace-normal text-destructive">{b.error}</p>}
                </TableCell>
                <TableCell>{b.requestedBy ?? ""}</TableCell>
                <TableCell>{new Date(b.createdAt).toLocaleString()}</TableCell>
                <TableCell>{duration(b)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => setLogFor(b.id)}>
                    Log
                  </Button>
                  {active(b) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        run(() => unwrap(api.builds[":id"].cancel.$post({ param: { id: String(b.id) } })))
                      }
                    >
                      Cancel
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <LogDialog buildId={logFor} onClose={() => setLogFor(null)} />
    </Section>
  );
}

function UploadZone({
  bookId,
  onUploaded,
  onLog,
}: {
  bookId: string;
  onUploaded: () => void;
  onLog: (buildId: number) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  // How much of the zip was sent; 1 means the server is now unpacking it.
  const [progress, setProgress] = useState(0);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast.error("Choose a .zip file");
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      const result = await uploadZip(bookId, file, setProgress);
      toast.success(
        result.changed
          ? `Uploaded ${result.files} files. The book is being built.`
          : "Nothing changed since the last upload. The book is being built again.",
      );
      if (result.skipped.length > 0) {
        const shown = result.skipped.slice(0, 3).join(", ");
        toast.warning(`Left out ${result.skipped.length} link(s): ${shown}${result.skipped.length > 3 ? ", …" : ""}`, {
          // The whole list is in the build's log.
          action: { label: "View log", onClick: () => onLog(result.build.id) },
        });
      }
      onUploaded();
    } catch (error) {
      toast.error(error instanceof ApiError || error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <label
      className={cn(
        "flex max-w-xl cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center transition-colors",
        dragging && "border-primary bg-secondary",
        busy && "pointer-events-none opacity-60",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void upload(e.dataTransfer.files[0]);
      }}
    >
      <UploadIcon className="size-6 text-muted-foreground" aria-hidden />
      <span>
        {busy ? (progress < 1 ? `Uploading… ${Math.round(progress * 100)}%` : "Unpacking…") : "Drop a zip of your book here, or click to choose one"}
      </span>
      <span className="text-sm text-muted-foreground">
        It must contain your hyperbook.json. A zip from GitHub (“Download ZIP”) works as it is.
      </span>
      {busy && (
        <div
          role="progressbar"
          aria-label="Upload progress"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-secondary"
        >
          <div
            className={cn("h-full rounded-full bg-primary transition-[width] duration-150", progress >= 1 && "animate-pulse")}
            style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }}
          />
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept=".zip,application/zip"
        className="sr-only"
        aria-label="Upload a zip of your book"
        onChange={(e) => void upload(e.target.files?.[0])}
      />
    </label>
  );
}

export function LogDialog({ buildId, onClose }: { buildId: number | null; onClose: () => void }) {
  const { data: build } = useQuery({
    queryKey: ["builds", buildId],
    queryFn: () => unwrap(api.builds[":id"].$get({ param: { id: String(buildId) } })),
    enabled: buildId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "queued" || status === "running" ? 1000 : false;
    },
  });
  const pre = useRef<HTMLPreElement>(null);
  useEffect(() => {
    // Stay at the end while the log grows.
    pre.current?.scrollTo({ top: pre.current.scrollHeight });
  }, [build?.log]);

  const downloadLog = () => {
    if (!build?.log || buildId === null) return;
    const url = URL.createObjectURL(new Blob([build.log], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `hyperbook-build-${buildId}.log`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={buildId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Build #{buildId}</DialogTitle>
          <DialogDescription>
            {build
              ? `${STATUS[build.status].label}${build.hyperbookVersion ? ` with Hyperbook ${build.hyperbookVersion}` : ""}, commit ${build.commit.slice(0, 12)}`
              : "Loading…"}
          </DialogDescription>
        </DialogHeader>
        <pre
          ref={pre}
          className="max-h-[60vh] overflow-auto rounded-md bg-secondary p-3 font-mono text-xs whitespace-pre-wrap"
        >
          {build?.log || (build?.status === "queued" ? "Waiting for its turn…" : "")}
        </pre>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={downloadLog} disabled={!build?.log}>
            <DownloadIcon aria-hidden /> Download log
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
