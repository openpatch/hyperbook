import { useQuery, useQueryClient } from "@tanstack/react-query";
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

/**
 * Publishes the saved state of the book. Says whether the live book is
 * behind the newest save.
 */
export function PublishButton({
  bookId,
  commit,
  builds,
  hasUnsaved,
  onPublish,
}: {
  bookId: string;
  commit: string | null;
  builds: Build[] | undefined;
  hasUnsaved: boolean;
  /** Called first, so unsaved changes can be saved or kept out. */
  onPublish: (publish: () => Promise<void>) => void;
}) {
  const queryClient = useQueryClient();
  const live = builds?.find((b) => b.published);
  const publishing = builds?.find((b) => b.publish && active(b));
  const upToDate = !!live && live.commit === commit;

  const publish = async () => {
    try {
      const res = await unwrap(api.books[":id"].publish.$post({ param: { id: bookId } }));
      toast.success(res.published ? "Published." : "Building the book; it goes live when the build is done.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["books", bookId, "builds"] }),
        queryClient.invalidateQueries({ queryKey: ["books", bookId], exact: true }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish");
    }
  };

  const label = publishing ? "Publishing…" : upToDate && !hasUnsaved ? "Published" : "Publish";
  return (
    <Button
      size="sm"
      variant={upToDate && !hasUnsaved ? "outline" : "default"}
      disabled={!commit || !!publishing || (upToDate && !hasUnsaved)}
      title={upToDate ? "Students see the newest saved version" : "Students see an older version"}
      onClick={() => onPublish(publish)}
    >
      {label}
    </Button>
  );
}
