import { ExternalLinkIcon, RotateCwIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, unwrap } from "@/lib/api";

/** A one-time hand-off into the book's preview host, landing on `page`. */
async function previewUrl(bookId: string, page: string) {
  const { url } = await unwrap(api.books[":id"]["preview-code"].$post({ param: { id: bookId } }));
  return `${url}&next=${encodeURIComponent(page)}`;
}

type Rendered = { ok: true; href: string; log: string } | { ok: false; error: string; log: string };

/** How long typing pauses before the page renders again. */
const DEBOUNCE_MS = 400;

/**
 * The open page as readers will see it, framed from the book's preview host.
 * Nothing is built: the page renders on its own, with its unsaved text,
 * shortly after each change, and the frame reloads in place. Links in the
 * frame render the pages they lead to. The frame logs in once through a
 * hand-off; later loads go straight to the page.
 */
export function PreviewPane({
  bookId,
  file,
  text,
  commit,
}: {
  bookId: string;
  /** The page open in the editor, with its current text; null for other files. */
  file: string | null;
  text: string | null;
  /** The newest save: other pages may have changed with it. */
  commit: string | null;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const origin = useRef<string | null>(null);
  const [reloads, setReloads] = useState(0);
  const [rendered, setRendered] = useState<Rendered | null>(null);
  const [rendering, setRendering] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const shown = useRef<string | null>(null);
  // Until the hand-off page has logged the frame in, its address must not
  // load again (its code works once): what to show waits here.
  const ready = useRef(false);
  const pending = useRef<string | null>(null);

  const handOff = useCallback(
    async (to: string) => {
      try {
        const url = await previewUrl(bookId, to);
        origin.current = new URL(url).origin;
        ready.current = false;
        pending.current = null;
        shown.current = to;
        setSrc(url);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not open the preview");
      }
    },
    [bookId],
  );

  /** Shows `href`: reloads the frame if it shows it already. */
  const show = useCallback(
    (href: string) => {
      if (!origin.current) return void handOff(href);
      if (!ready.current) {
        pending.current = href;
        return;
      }
      // Never the hand-off address again (its code works once), and a new
      // frame each time, which reloads it even at the same address.
      shown.current = href;
      setSrc(`${origin.current}${href}`);
      setReloads((n) => n + 1);
    },
    [handOff],
  );

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin.current || e.data?.hyperbookPreview !== "ready") return;
      ready.current = true;
      const next = pending.current;
      pending.current = null;
      // Rendered while logging in: show the newest state.
      if (next) {
        shown.current = next;
        setSrc(`${origin.current}${next}`);
        setReloads((n) => n + 1);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Render the open page after a pause in typing, and after every save.
  const latest = useRef(0);
  useEffect(() => {
    if (file === null || text === null) return;
    const timer = setTimeout(async () => {
      const ticket = ++latest.current;
      setRendering(true);
      try {
        const res = await unwrap(
          api.books[":id"].files.render.$post({ param: { id: bookId }, json: { path: file, text } }),
        );
        if (ticket !== latest.current) return;
        setRendered(res);
        if (res.ok) show(res.href);
      } catch (error) {
        if (ticket !== latest.current) return;
        setRendered({ ok: false, error: error instanceof Error ? error.message : "Could not render the page", log: "" });
      } finally {
        if (ticket === latest.current) setRendering(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [bookId, file, text, commit, show]);

  // Another file is open: a save may still change what the frame shows.
  useEffect(() => {
    if (file === null && origin.current && ready.current) show(shown.current ?? "/");
  }, [commit]); // eslint-disable-line react-hooks/exhaustive-deps

  // Nothing open yet: start on the book's first page.
  useEffect(() => {
    if (!origin.current && file === null) void handOff("/");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openInTab = async () => {
    const url = await previewUrl(bookId, shown.current ?? "/");
    window.open(url, "_blank", "noopener");
  };

  const log = rendered?.log.trim() ?? "";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1 text-sm">
        <span className="font-medium">Preview</span>
        {rendering && <span className="text-xs text-muted-foreground">Updating…</span>}
        {rendered && !rendered.ok && (
          <Badge variant="destructive" className="cursor-pointer" onClick={() => setShowLog(true)}>
            Could not show the page
          </Badge>
        )}
        {rendered?.ok && log && (
          <Badge variant="secondary" className="cursor-pointer" onClick={() => setShowLog((s) => !s)}>
            Notes on this page
          </Badge>
        )}
        <span className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Reload preview"
          onClick={() => void handOff(shown.current ?? "/")}
        >
          <RotateCwIcon className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="size-7" aria-label="Open preview in a new tab" onClick={() => void openInTab()}>
          <ExternalLinkIcon className="size-4" />
        </Button>
      </div>
      {showLog && rendered && (rendered.ok ? log : true) && (
        <div className="max-h-48 shrink-0 overflow-auto border-b border-border bg-sidebar px-3 py-2 text-xs">
          <div className="mb-1 flex items-center">
            <span className="flex-1 font-medium">{rendered.ok ? "Notes from rendering the page" : rendered.error}</span>
            <Button variant="ghost" size="sm" className="h-6" onClick={() => setShowLog(false)}>
              Close
            </Button>
          </div>
          {log && <pre className="whitespace-pre-wrap font-mono">{log}</pre>}
        </div>
      )}
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
