import { ExternalLinkIcon, RotateCwIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, unwrap } from "@/lib/api";
import { type Build, buildStatus } from "./publish";

/** A one-time hand-off into the book's preview host, landing on `page`. */
async function previewUrl(bookId: string, page: string) {
  const { url } = await unwrap(api.books[":id"]["preview-code"].$post({ param: { id: bookId } }));
  return `${url}&next=${encodeURIComponent(page)}`;
}

/**
 * The newest build of the book, framed from its preview host. It follows the
 * page of the open file and reloads when the build of the newest save is
 * ready. The frame logs in once through a hand-off; later loads go straight
 * to the page.
 */
export function PreviewPane({
  bookId,
  page,
  build,
  onShowLog,
}: {
  bookId: string;
  page: string;
  /** The build of the newest save, if any. */
  build: Build | undefined;
  onShowLog: (buildId: number) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const origin = useRef<string | null>(null);
  const [reloads, setReloads] = useState(0);

  const handOff = useCallback(
    async (to: string) => {
      try {
        const url = await previewUrl(bookId, to);
        origin.current = new URL(url).origin;
        setSrc(url);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not open the preview");
      }
    },
    [bookId],
  );

  // Log in on the first load; afterwards just navigate.
  useEffect(() => {
    if (origin.current) setSrc(`${origin.current}${page}`);
    else void handOff(page);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  // A new build is ready: show it.
  const latestPage = useRef(page);
  latestPage.current = page;
  const ready = build?.status === "succeeded" ? build.id : null;
  useEffect(() => {
    if (ready === null || !origin.current) return;
    // Never the hand-off address again: its code works once.
    setSrc(`${origin.current}${latestPage.current}`);
    setReloads((n) => n + 1);
  }, [ready]);

  const openInTab = async () => {
    const url = await previewUrl(bookId, page);
    window.open(url, "_blank", "noopener");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1 text-sm">
        <span className="font-medium">Preview</span>
        {build && build.status !== "succeeded" && (
          <Badge
            variant={build.status === "failed" ? "destructive" : "secondary"}
            className="cursor-pointer"
            onClick={() => onShowLog(build.id)}
          >
            {build.status === "failed" ? "Build failed – show log" : build.status === "canceled" ? "Canceled" : buildStatus(build)}
          </Badge>
        )}
        <span className="flex-1" />
        <Button variant="ghost" size="icon" className="size-7" aria-label="Reload preview" onClick={() => void handOff(page)}>
          <RotateCwIcon className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="size-7" aria-label="Open preview in a new tab" onClick={() => void openInTab()}>
          <ExternalLinkIcon className="size-4" />
        </Button>
      </div>
      {src && (
        <iframe
          key={`${src}#${reloads}`}
          src={src}
          title="Preview"
          className="min-h-0 w-full flex-1 bg-white"
        />
      )}
    </div>
  );
}
