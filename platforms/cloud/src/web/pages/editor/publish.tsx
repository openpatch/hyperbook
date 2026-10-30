import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, unwrap } from "@/lib/api";

export type Build = Awaited<ReturnType<typeof fetchBuilds>>[number];

const fetchBuilds = (id: string) => unwrap(api.books[":id"].builds.$get({ param: { id } }));

const active = (b: Build) => b.status === "queued" || b.status === "running";

/** The book's latest builds, followed while one is waiting or running. */
export function useBuilds(bookId: string) {
  return useQuery({
    queryKey: ["books", bookId, "builds"],
    queryFn: () => fetchBuilds(bookId),
    refetchInterval: (query) => (query.state.data?.some(active) ? 1500 : false),
  });
}

/** "12 / 340 pages" while a build counts its pages, else what it is doing. */
export function buildStatus(build: Build): string {
  if (build.status === "queued") return "Waiting to build…";
  const p = build.progress;
  if (!p) return "Building…";
  return `${p.done} / ${p.total} ${p.step === "glossary" ? "glossary entries" : "pages"}`;
}

/**
 * Publishes the saved state of the book. Says whether the live book is
 * behind the newest save, and follows a build that is to go live: how far it
 * is, its log on a click, and a note when it is live or failed.
 */
export function PublishButton({
  bookId,
  commit,
  builds,
  hasUnsaved,
  onPublish,
  onShowLog,
}: {
  bookId: string;
  commit: string | null;
  builds: Build[] | undefined;
  hasUnsaved: boolean;
  /** Called first, so unsaved changes can be saved or kept out. */
  onPublish: (publish: () => Promise<void>) => void;
  onShowLog: (buildId: number) => void;
}) {
  const queryClient = useQueryClient();
  const live = builds?.find((b) => b.published);
  const publishing = builds?.find((b) => b.publish && active(b));
  const upToDate = !!live && live.commit === commit;

  // The build followed here, to tell how it ended once it has.
  const followed = useRef<number | null>(null);
  if (publishing) followed.current = publishing.id;
  const ended = builds?.find((b) => b.id === followed.current && !active(b));
  useEffect(() => {
    if (!ended) return;
    followed.current = null;
    void queryClient.invalidateQueries({ queryKey: ["books", bookId], exact: true });
    if (ended.status === "succeeded") toast.success("Published. Students see the new version.");
    else if (ended.status === "failed") {
      toast.error("Publishing failed: the build did not succeed.", {
        action: { label: "Show log", onClick: () => onShowLog(ended.id) },
      });
    }
  }, [ended?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const publish = async () => {
    try {
      const res = await unwrap(api.books[":id"].publish.$post({ param: { id: bookId }, json: {} }));
      if (res.published) toast.success("Published.");
      else followed.current = res.build.id;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["books", bookId, "builds"] }),
        queryClient.invalidateQueries({ queryKey: ["books", bookId], exact: true }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish");
    }
  };

  if (publishing) {
    const p = publishing.progress;
    return (
      <Button
        size="sm"
        variant="secondary"
        className="relative overflow-hidden"
        title="The book goes live when this build is done. Click to see its log."
        onClick={() => onShowLog(publishing.id)}
      >
        <Loader2Icon className="size-4 animate-spin" />
        Publishing… <span className="text-muted-foreground tabular-nums">{buildStatus(publishing)}</span>
        {p && p.total > 0 && (
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-primary transition-transform"
            style={{ transform: `scaleX(${p.done / p.total})` }}
          />
        )}
      </Button>
    );
  }

  const label = upToDate && !hasUnsaved ? "Published" : "Publish";
  return (
    <Button
      size="sm"
      variant={upToDate && !hasUnsaved ? "outline" : "default"}
      disabled={!commit || (upToDate && !hasUnsaved)}
      title={upToDate ? "Students see the newest saved version" : "Students see an older version"}
      onClick={() => onPublish(publish)}
    >
      {label}
    </Button>
  );
}
