import { ExternalLinkIcon, RotateCwIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, unwrap } from "@/lib/api";
import { type Theme, useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** `href` with the editor's theme, for the preview host to show the page in (see books/preview.ts). */
function withTheme(href: string, theme: Theme) {
  const url = new URL(href, "http://preview");
  url.searchParams.set("hb-theme", theme);
  return url.href.slice(url.origin.length);
}

/** A one-time hand-off into the book's preview host, landing on `page`. */
async function previewUrl(bookId: string, page: string) {
  const { url } = await unwrap(api.books[":id"]["preview-code"].$post({ param: { id: bookId } }));
  return `${url}&next=${encodeURIComponent(page)}`;
}

type Rendered = { ok: true; href: string; log: string } | { ok: false; error: string; log: string };

/** How long typing pauses before the page renders again. */
const DEBOUNCE_MS = 400;
/** How long a loaded page may take to say it is shown before it is put on view anyway. */
const SHOWN_FALLBACK_MS = 1500;

/** A page in the frame; `id` makes each load a new frame, even at the same address. */
type Frame = { id: number; src: string };

/**
 * The open page as readers will see it, framed from the book's preview host.
 * Nothing is built: the page renders on its own, with its unsaved text,
 * shortly after each change. The new page loads in a second frame underneath
 * the shown one and takes its place once it says it is shown (back at the
 * reader's place, painted; see books/preview.ts), so the preview neither goes
 * blank nor jumps. A frame hidden instead of covered would not paint, nor
 * load its fonts, until it is revealed. The page follows the editor's light or
 * dark theme. Links in the frame open their files in the editor (onNavigate);
 * those that no file makes render here. The frame logs in once through a
 * hand-off; later loads go straight to the page.
 */
export function PreviewPane({
  bookId,
  file,
  text,
  commit,
  onNavigate,
}: {
  bookId: string;
  /** The page open in the editor, with its current text; null for other files. */
  file: string | null;
  text: string | null;
  /** The newest save: other pages may have changed with it. */
  commit: string | null;
  /** A link in the frame was clicked: opens its file, if there is one. */
  onNavigate?: (href: string) => boolean;
}) {
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;
  const theme = useTheme();
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const [frames, setFrames] = useState<Frame[]>([]);
  /** The frame on view: the newest one that has loaded. */
  const [shownFrame, setShownFrame] = useState<number | null>(null);
  const frameIds = useRef(0);
  const shownRef = useRef<number | null>(null);
  shownRef.current = shownFrame;
  const elements = useRef(new Map<number, HTMLIFrameElement>());
  const origin = useRef<string | null>(null);
  /** Puts frame `id` on view and drops the ones before it. */
  const promote = useCallback((id: number) => {
    if (id <= (shownRef.current ?? 0)) return;
    shownRef.current = id;
    setShownFrame(id);
    setFrames((all) => all.filter((f) => f.id >= id));
  }, []);
  /** Loads `src` in a new frame underneath the shown one. */
  const load = useCallback((src: string, replace = false) => {
    const frame = { id: ++frameIds.current, src };
    if (replace) {
      setShownFrame(null);
      return setFrames([frame]);
    }
    // Keep only the shown frame: one still loading is outdated now.
    setFrames((all) => [...all.filter((f) => f.id === shownRef.current), frame]);
  }, []);
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
        const url = await previewUrl(bookId, withTheme(to, themeRef.current));
        origin.current = new URL(url).origin;
        ready.current = false;
        pending.current = null;
        shown.current = to;
        // The hand-off page is no page of the book: nothing to keep behind it.
        load(url, true);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not open the preview");
      }
    },
    [bookId, load],
  );

  /** Shows `href`: reloads the frame if it shows it already. */
  const show = useCallback(
    (href: string) => {
      if (!origin.current) return void handOff(href);
      if (!ready.current) {
        pending.current = href;
        return;
      }
      // Never the hand-off address again (its code works once).
      shown.current = href;
      load(`${origin.current}${withTheme(href, themeRef.current)}`);
    },
    [handOff, load],
  );

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin.current) return;
      if (e.data?.hyperbookPreview === "navigate" && typeof e.data.href === "string" && e.data.href.startsWith("/")) {
        if (!onNavigateRef.current?.(e.data.href)) show(e.data.href);
        return;
      }
      if (e.data?.hyperbookPreview === "shown") {
        for (const [id, element] of elements.current) {
          if (element.contentWindow === e.source) promote(id);
        }
        return;
      }
      if (e.data?.hyperbookPreview !== "ready") return;
      ready.current = true;
      const next = pending.current;
      pending.current = null;
      // Rendered while logging in: show the newest state.
      if (next) {
        shown.current = next;
        load(`${origin.current}${withTheme(next, themeRef.current)}`);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [load, promote, show]);

  // The theme changed: the pages switch in place, without loading again.
  useEffect(() => {
    if (!origin.current) return;
    for (const element of elements.current.values()) {
      element.contentWindow?.postMessage({ hyperbookTheme: theme }, origin.current);
    }
  }, [theme]);

  // Render the open page after a pause in typing, and after every save. One
  // render at a time: the server renders a book's pages one after another, so
  // overlapping requests would only queue up there, each one already
  // outdated. What changes meanwhile renders once the running one is done.
  const latest = useRef(0);
  const running = useRef<Promise<void> | null>(null);
  useEffect(() => {
    if (file === null || text === null) return;
    const ticket = ++latest.current;
    const timer = setTimeout(async () => {
      while (running.current) await running.current;
      if (ticket !== latest.current) return;
      setRendering(true);
      running.current = (async () => {
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
        }
      })();
      await running.current;
      running.current = null;
      if (ticket === latest.current) setRendering(false);
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
    const url = await previewUrl(bookId, withTheme(shown.current ?? "/", themeRef.current));
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
      <div className="relative min-h-0 flex-1">
        {frames.map((frame) => {
          // Until one has been shown, the first frame is on view as it loads.
          const onView = frame.id === (shownFrame ?? frames[0]?.id);
          return (
            <iframe
              key={frame.id}
              ref={(element) => {
                if (element) elements.current.set(frame.id, element);
                else elements.current.delete(frame.id);
              }}
              src={frame.src}
              title="Preview"
              aria-hidden={!onView}
              tabIndex={onView ? undefined : -1}
              // In the theme from the start: a frame's own light or dark
              // follows the color scheme of the element framing it.
              style={{ colorScheme: theme }}
              className={cn("absolute inset-0 size-full bg-background", onView ? "z-10" : "pointer-events-none z-0")}
              // Pages that never say they are shown (an error page, a file):
              // on view a moment after they have loaded.
              onLoad={() => setTimeout(() => promote(frame.id), SHOWN_FALLBACK_MS)}
            />
          );
        })}
      </div>
    </div>
  );
}
