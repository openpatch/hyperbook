import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import i18next from "i18next";
import { CheckIcon, CopyIcon, DownloadIcon, KeyRoundIcon, UploadIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/confirm-button";
import { Section } from "@/components/page-header";
import { SecretDialog } from "@/components/secret-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError, api, unwrap } from "@/lib/api";
import type { Book } from "@/lib/books";
import { useInstance } from "@/lib/session";
import { cn } from "@/lib/utils";

type Build = Awaited<ReturnType<typeof fetchBuilds>>[number];

const fetchBuilds = (id: string) => unwrap(api.books[":id"].builds.$get({ param: { id } }));

const STATUS: Record<
  Build["status"],
  { label: "publishing.statusQueued" | "publishing.statusRunning" | "publishing.statusSucceeded" | "publishing.statusFailed" | "publishing.statusCanceled"; variant: React.ComponentProps<typeof Badge>["variant"] }
> = {
  queued: { label: "publishing.statusQueued", variant: "secondary" },
  running: { label: "publishing.statusRunning", variant: "secondary" },
  succeeded: { label: "publishing.statusSucceeded", variant: "default" },
  failed: { label: "publishing.statusFailed", variant: "destructive" },
  canceled: { label: "publishing.statusCanceled", variant: "outline" },
};

const TRIGGER: Record<Build["trigger"], string> = {
  upload: "publishing.triggerUpload",
  rebuild: "publishing.triggerRebuild",
  edit: "publishing.triggerEdit",
  push: "publishing.triggerPush",
  publish: "publishing.triggerPublish",
  rollback: "publishing.triggerRollback",
  upgrade: "publishing.triggerUpgrade",
};

const active = (b: Build) => b.status === "queued" || b.status === "running";

/** The version tag of a build that a rollback can go back to. */
const versionTag = (b: Build) => b.tags?.find((t) => /^v\d+$/.test(t));

/** How many commits main has on top of a build. */
const aheadOf = (book: Book, b: Build | undefined) =>
  b ? Math.max(0, book.commitCount - b.commitCount) : null;

function duration(b: Build, t: ReturnType<typeof useTranslation>["t"]): string {
  if (!b.startedAt) return "";
  const ms = (b.finishedAt ?? Date.now()) - b.startedAt;
  return ms < 60_000
    ? t("publishing.durationSeconds", { seconds: Math.round(ms / 1000) })
    : t("publishing.durationMinutes", {
        minutes: Math.floor(ms / 60_000),
        seconds: Math.round((ms % 60_000) / 1000),
      });
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
    xhr.onerror = () => reject(new Error(i18next.t("publishing.upload.uploadFailed")));
    xhr.onload = () => {
      const body = (xhr.response ?? {}) as UploadResult & { error?: string };
      if (xhr.status === 200) resolve(body);
      else reject(new ApiError(body.error ?? `Request failed (${xhr.status})`, xhr.status));
    };
    xhr.send(form);
  });
}

type Version = Awaited<ReturnType<typeof fetchVersions>>[number];

const fetchVersions = (id: string) => unwrap(api.books[":id"].versions.$get({ param: { id } }));

const HISTORY_ROWS = 5;

/**
 * Live is the newest published version (a v<N> tag) and only changes by
 * publishing or rolling back; the preview is the last saved state of the book.
 */
export function PublishingSection({ book }: { book: Book }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const id = String(book.id);
  const key = ["books", id, "builds"];
  const versionsKey = ["books", id, "versions"];
  const { data: builds } = useQuery({
    queryKey: key,
    queryFn: () => fetchBuilds(id),
    // Follow builds while one is waiting or running.
    refetchInterval: (query) => (query.state.data?.some(active) ? 1500 : false),
  });
  const { data: versions } = useQuery({ queryKey: versionsKey, queryFn: () => fetchVersions(id) });
  const [logFor, setLogFor] = useState<number | null>(null);
  const [dialog, setDialog] = useState<"publish" | "upload" | "git" | "unpublish" | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [note, setNote] = useState("");

  // A finished build may have changed what is published.
  const latest = builds?.[0];
  const latestState = latest ? `${latest.id}:${latest.status}` : "";
  useEffect(() => {
    if (latest && !active(latest)) {
      void queryClient.invalidateQueries({ queryKey: ["books", id], exact: true });
      void queryClient.invalidateQueries({ queryKey: versionsKey });
    }
  }, [latestState]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: key }),
      queryClient.invalidateQueries({ queryKey: versionsKey }),
      queryClient.invalidateQueries({ queryKey: ["books", id], exact: true }),
    ]);
  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.somethingWrong"));
    }
  };

  const hasSource = (builds?.length ?? 0) > 0;
  const preview = builds?.find((b) => b.preview);
  const liveVersion = versions?.find((v) => v.live);
  const aheadPreview = aheadOf(book, preview);
  const pending = builds?.find((b) => active(b));
  // The preview is behind when main has commits no preview build has.
  const previewBehind = !preview || (aheadPreview ?? 0) > 0 || !!pending;
  const previewIsLive = !!preview && !!liveVersion && preview.commit === liveVersion.commit;
  // Nothing to publish while main is what the live version was made from.
  const upToDate = previewIsLive && !previewBehind;
  const rows = showAll ? (builds ?? []) : (builds ?? []).slice(0, HISTORY_ROWS);

  const openPreview = () => {
    // Opened first, so the popup blocker sees a click.
    const tab = window.open("about:blank", "_blank");
    void unwrap(api.books[":id"]["preview-code"].$post({ param: { id } }))
      .then(({ url }) => {
        if (tab) tab.location.href = `${url}&next=${encodeURIComponent("/")}`;
      })
      .catch((error) => {
        tab?.close();
        toast.error(error instanceof Error ? error.message : t("common.somethingWrong"));
      });
  };

  const publish = () =>
    run(async () => {
      await unwrap(api.books[":id"].publish.$post({ param: { id }, json: { note: note.trim() } }));
      setNote("");
      setDialog(null);
    });

  return (
    <Section
      title={t("publishing.title")}
      description={t("publishing.description")}
      actions={
        <div className="self-start">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">{t("publishing.moreActions")}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setDialog("upload")}>{t("publishing.uploadZip")}</DropdownMenuItem>
                <DropdownMenuItem disabled={!hasSource} asChild={hasSource}>
                  {hasSource ? (
                    <a href={`/api/books/${id}/source.zip`}>{t("publishing.downloadSource")}</a>
                  ) : (
                    <span>{t("publishing.downloadSource")}</span>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDialog("git")}>{t("publishing.git.title")}</DropdownMenuItem>
                {book.publishedAt && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setDialog("unpublish")}>
                      {t("publishing.unpublish")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      }
    >
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-4">
          <div className="mb-2 flex h-8 items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {t("publishing.live")}
              {liveVersion && <Badge>{liveVersion.tag}</Badge>}
            </div>
            {upToDate ? (
              <Badge variant="outline">{t("publishing.isLive")}</Badge>
            ) : (
              <Button size="sm" disabled={!hasSource} onClick={() => setDialog("publish")}>
                {t("publishing.publish")}
              </Button>
            )}
          </div>
          {book.publishedAt ? (
            <>
              <a href={book.url} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                {book.url.replace(/^https?:\/\//, "")}
              </a>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("publishing.since", { when: new Date(book.publishedAt).toLocaleString() })}
              </p>
              {liveVersion?.note && <p className="mt-1 text-sm">{liveVersion.note}</p>}
            </>
          ) : (
            <p className="text-muted-foreground">{t("publishing.notPublishedYet")}</p>
          )}
        </div>
        <div className="rounded-lg border p-4">
          <div className="mb-2 flex h-8 items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {t("publishing.preview")}
              {pending && <Badge variant="secondary">{t(STATUS[pending.status].label)}</Badge>}
            </div>
            {previewBehind ? (
              <Button
                size="sm"
                variant="outline"
                disabled={!hasSource || !!pending}
                onClick={() => void run(() => unwrap(api.books[":id"].builds.$post({ param: { id } })))}
              >
                {pending ? t("publishing.buildingPreview") : t("publishing.buildPreview")}
              </Button>
            ) : (
              <Badge variant="outline">{t("publishing.isLive")}</Badge>
            )}
          </div>
          {preview ? (
            <>
              <a
                href={book.previewUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary hover:underline"
                onClick={(e) => {
                  e.preventDefault();
                  openPreview();
                }}
              >
                {book.previewUrl.replace(/^https?:\/\//, "")}
              </a>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("publishing.savedAt", { when: new Date(preview.createdAt).toLocaleString() })}
              </p>
              <p className="mt-1 text-sm">
                {previewIsLive ? t("publishing.previewIsLive") : t("publishing.previewNewer")}
                {aheadPreview !== null && aheadPreview > 0 && ` · ${t("publishing.aheadPreview", { count: aheadPreview })}`}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">{t("publishing.noPreview")}</p>
          )}
        </div>
      </div>

      <Dialog open={dialog === "publish"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("publishing.publishTitle")}</DialogTitle>
            <DialogDescription>{t("publishing.publishDescription")}</DialogDescription>
          </DialogHeader>
          <Input
            placeholder={t("publishing.notePlaceholder")}
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label={t("publishing.notePlaceholder")}
          />
          <DialogFooter>
            <Button onClick={() => void publish()}>{t("publishing.publish")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "upload"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("publishing.uploadZip")}</DialogTitle>
            <DialogDescription>{t("publishing.uploadDescription")}</DialogDescription>
          </DialogHeader>
          <UploadZone
            bookId={id}
            onUploaded={() => {
              setDialog(null);
              void refresh();
            }}
            onLog={setLogFor}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "git"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("publishing.git.title")}</DialogTitle>
            <DialogDescription>{t("publishing.git.hint")} main{t("publishing.git.hint2")}</DialogDescription>
          </DialogHeader>
          <WorkLocally book={book} />
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "unpublish"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("publishing.unpublishTitle", { title: book.title })}</DialogTitle>
            <DialogDescription>{t("publishing.unpublishDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() =>
                void run(async () => {
                  await unwrap(api.books[":id"].unpublish.$post({ param: { id } }));
                  setDialog(null);
                })
              }
            >
              {t("publishing.unpublish")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <h3 className="mt-6 mb-2 font-medium">{t("publishing.versions.title")}</h3>
      {versions && versions.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("publishing.versions.version")}</TableHead>
              <TableHead>{t("publishing.when")}</TableHead>
              <TableHead>
                <span className="sr-only">{t("common.actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {versions.map((v) => (
              <VersionRow key={v.tag} version={v} bookId={id} onChanged={refresh} />
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-muted-foreground">{t("publishing.versions.empty")}</p>
      )}

      {hasSource && (
        <>
          <h3 className="mt-6 mb-2 font-medium">{t("publishing.history")}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("publishing.build")}</TableHead>
                <TableHead>{t("publishing.status")}</TableHead>
                <TableHead>{t("publishing.when")}</TableHead>
                <TableHead>
                  <span className="sr-only">{t("common.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      #{b.id} {t(TRIGGER[b.trigger] as never)}
                      {b.tags?.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS[b.status].variant}>
                        {t(STATUS[b.status].label)}
                        {b.progress && ` ${b.progress.done}/${b.progress.total}`}
                      </Badge>
                      {b.published && <Badge variant="outline">{t("publishing.live")}</Badge>}
                      {b.preview && <Badge variant="outline">{t("publishing.preview")}</Badge>}
                      <span className="text-sm text-muted-foreground">{duration(b, t)}</span>
                    </div>
                    {b.error && <p className="mt-1 max-w-sm text-sm whitespace-normal text-destructive">{b.error}</p>}
                  </TableCell>
                  <TableCell>
                    {new Date(b.createdAt).toLocaleString()}
                    {b.requestedBy && <span className="block text-xs text-muted-foreground">{b.requestedBy}</span>}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => setLogFor(b.id)}>
                      {t("publishing.log")}
                    </Button>
                    {active(b) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          run(() => unwrap(api.builds[":id"].cancel.$post({ param: { id: String(b.id) } })))
                        }
                      >
                        {t("publishing.cancel")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {(builds?.length ?? 0) > HISTORY_ROWS && (
            <Button variant="ghost" size="sm" className="mt-1" onClick={() => setShowAll((v) => !v)}>
              {showAll ? t("publishing.showLess") : t("publishing.showAll", { count: builds!.length })}
            </Button>
          )}
        </>
      )}

      <LogDialog buildId={logFor} onClose={() => setLogFor(null)} />
    </Section>
  );
}

/** A published version: its date and note, a download while its build is kept, and a roll back unless it is live. */
function VersionRow({
  version: v,
  bookId,
  onChanged,
}: {
  version: Version;
  bookId: string;
  onChanged: () => unknown;
}) {
  const { t } = useTranslation();
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge variant={v.live ? "default" : "outline"}>{v.tag}</Badge>
          {v.live && <span className="text-sm">{t("publishing.live")}</span>}
        </div>
        {v.note && <p className="mt-1 max-w-sm text-sm whitespace-normal text-muted-foreground">{v.note}</p>}
      </TableCell>
      <TableCell>{new Date(v.committedAt).toLocaleString()}</TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <span className="flex w-28 justify-end">
            {v.buildId !== null && (
              <Button variant="ghost" size="sm" asChild>
                <a
                  href={`/api/books/${bookId}/builds/${v.buildId}/site.zip`}
                  title={t("publishing.downloadSiteTitle")}
                >
                  {t("publishing.downloadSite")}
                </a>
              </Button>
            )}
          </span>
          <span className="flex w-28 justify-end">
            {!v.live && (
              <ConfirmButton
                size="sm"
                variant="outline"
                title={t("publishing.rollBackTitle", { tag: v.tag })}
                description={
                  v.buildId !== null ? t("publishing.rollBackDescription") : t("publishing.rollBackRebuildDescription")
                }
                confirmLabel={t("publishing.rollBack")}
                onConfirm={async () => {
                  await unwrap(api.books[":id"].rollback.$post({ param: { id: bookId }, json: { tag: v.tag } }));
                  await onChanged();
                }}
              >
                {t("publishing.rollBack")}
              </ConfirmButton>
            )}
          </span>
        </div>
      </TableCell>
    </TableRow>
  );
}

/**
 * "Work locally": the clone command and the per-book git tokens. A push to
 * main never triggers a publish build — only a preview build when the
 * instance setting says so.
 */
function WorkLocally({ book }: { book: Book }) {
  const { t } = useTranslation();
  const id = String(book.id);
  const { data: instance } = useInstance();
  const queryClient = useQueryClient();
  const cloneUrl = (() => {
    const url = new URL(window.location.origin);
    url.username = "git";
    return `${url.origin}/api/books/${id}/git`;
  })();
  // Without a folder name, git would clone into "git", the last part of the address.
  const cloneCommand = `git clone ${cloneUrl} ${book.slug}`;
  const { data: tokens } = useQuery({
    queryKey: ["books", id, "git", "tokens"],
    queryFn: () => unwrap(api.books[":id"].git.tokens.$get({ param: { id } })),
  });
  const [label, setLabel] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["books", id, "git", "tokens"] });

  const create = async () => {
    setBusy(true);
    try {
      const res = await unwrap(api.books[":id"].git.tokens.$post({ param: { id }, json: { label: label.trim() } }));
      setSecret(res.token);
      setLabel("");
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("publishing.git.createTokenFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (tokenId: string) => {
    try {
      await unwrap(api.books[":id"].git.tokens[":tokenId"].$delete({ param: { id, tokenId } }));
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("publishing.git.revokeFailed"));
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-xs select-all">
          {cloneCommand}
        </code>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void navigator.clipboard?.writeText(cloneCommand);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
          aria-label={t("publishing.git.copyAria")}
        >
          {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}{" "}
          {copied ? t("publishing.git.copied") : t("publishing.git.copy")}
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("publishing.git.authHint1")} <code>git</code> {t("publishing.git.authHint2")}{" "}
        <code>git config --global credential.helper store</code>
      </p>

      <div className="mt-3 flex items-center gap-2">
        <Input
          className="w-56"
          placeholder={t("publishing.git.tokenLabel")}
          maxLength={100}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          aria-label={t("publishing.git.tokenLabel")}
        />
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void create()}>
          <KeyRoundIcon aria-hidden /> {t("publishing.git.createToken")}
        </Button>
      </div>

      {tokens && tokens.length > 0 && (
        <Table className="mt-2">
          <TableHeader>
            <TableRow>
              <TableHead>{t("publishing.git.token")}</TableHead>
              <TableHead>{t("publishing.git.createdBy")}</TableHead>
              <TableHead>{t("publishing.git.lastUsed")}</TableHead>
              <TableHead>
                <span className="sr-only">{t("common.actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.map((token) => (
              <TableRow key={token.id}>
                <TableCell>
                  {token.label || <span className="text-muted-foreground">—</span>}
                  {token.revokedAt !== null && (
                    <Badge variant="outline">{t("publishing.git.revoked")}</Badge>
                  )}
                </TableCell>
                <TableCell>{token.user}</TableCell>
                <TableCell>
                  {token.lastUsedAt
                    ? new Date(token.lastUsedAt).toLocaleString()
                    : t("common.never")}
                </TableCell>
                <TableCell className="text-right">
                  {token.revokedAt === null && (
                    <ConfirmButton
                      size="sm"
                      title={t("publishing.git.revokeTitle")}
                      description={t("publishing.git.revokeDescription")}
                      confirmLabel={t("publishing.git.revoke")}
                      onConfirm={() => revoke(token.id)}
                    >
                      {t("publishing.git.revoke")}
                    </ConfirmButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <details className="mt-2 text-sm text-muted-foreground">
        <summary className="cursor-pointer">{t("publishing.git.howTitle")}</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            {t("publishing.git.rule1")} <code>main</code>. Force-pushes, other branches, deletes and tags are
            refused.
          </li>
          <li>
            {t("publishing.git.rule2")} <code>git checkout published</code>{" "}
            {t("publishing.git.rule2b")} <code>git log main ^published</code>{" "}
            {t("publishing.git.rule2c")}
          </li>
          <li>
            {instance?.gitPushUpdatesPreview
              ? t("publishing.git.pushPreviewOn")
              : t("publishing.git.pushPreviewOff")}
          </li>
          <li>{t("publishing.git.rule3")}</li>
          <li>{t("publishing.git.rule4")}</li>
          <li>
            {t("publishing.git.rule5")} <code>git config http.postBuffer 10485760</code>{" "}
            {t("publishing.git.rule5b")}
          </li>
        </ul>
      </details>

      <SecretDialog
        secret={secret}
        title={t("publishing.git.tokenTitle")}
        description={t("publishing.git.tokenDescription")}
        onClose={() => setSecret(null)}
      />
    </div>
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
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  // How much of the zip was sent; 1 means the server is now unpacking it.
  const [progress, setProgress] = useState(0);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast.error(t("publishing.upload.chooseZip"));
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      const result = await uploadZip(bookId, file, setProgress);
      toast.success(
        result.changed
          ? t("publishing.upload.uploadedToast", { files: result.files })
          : t("publishing.upload.unchangedToast"),
      );
      if (result.skipped.length > 0) {
        const shown = result.skipped.slice(0, 3).join(", ");
        toast.warning(
          t("publishing.upload.skippedToast", {
            count: result.skipped.length,
            shown: `${shown}${result.skipped.length > 3 ? ", …" : ""}`,
          }),
          {
            // The whole list is in the build's log.
            action: {
              label: t("publishing.upload.viewLog"),
              onClick: () => onLog(result.build.id),
            },
          },
        );
      }
      onUploaded();
    } catch (error) {
      toast.error(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : t("publishing.upload.uploadFailed"),
      );
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
        {busy
          ? progress < 1
            ? t("publishing.upload.uploading", { percent: Math.round(progress * 100) })
            : t("publishing.upload.unpacking")
          : t("publishing.upload.dropHere")}
      </span>
      <span className="text-sm text-muted-foreground">{t("publishing.upload.zipHint")}</span>
      {busy && (
        <div
          role="progressbar"
          aria-label={t("publishing.upload.progressAria")}
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
        aria-label={t("publishing.upload.aria")}
        onChange={(e) => void upload(e.target.files?.[0])}
      />
    </label>
  );
}

export function LogDialog({ buildId, onClose }: { buildId: number | null; onClose: () => void }) {
  const { t } = useTranslation();
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
          <DialogTitle>{t("publishing.logTitle", { id: buildId ?? 0 })}</DialogTitle>
          <DialogDescription>
            {build
              ? build.hyperbookVersion
                ? t("publishing.logDescription", {
                    status: t(STATUS[build.status].label),
                    version: build.hyperbookVersion,
                    commit: build.commit.slice(0, 12),
                  })
                : t("publishing.logDescriptionPlain", {
                    status: t(STATUS[build.status].label),
                    commit: build.commit.slice(0, 12),
                  })
              : t("publishing.logLoading")}
          </DialogDescription>
        </DialogHeader>
        <pre
          ref={pre}
          className="max-h-[60vh] overflow-auto rounded-md bg-secondary p-3 font-mono text-xs whitespace-pre-wrap"
        >
          {build?.log || (build?.status === "queued" ? t("publishing.waitingForTurn") : "")}
        </pre>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={downloadLog} disabled={!build?.log}>
            <DownloadIcon aria-hidden /> {t("publishing.downloadLog")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
