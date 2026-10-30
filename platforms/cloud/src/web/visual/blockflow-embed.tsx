import { useEffect, useRef } from "react";
import type { VisualEditorProps } from "./protocol";

/*
 * blockflow's embed entries (embed-editor.html, embed-generator.html, blockflow
 * >= 0.2.0), served by the platform itself at /blockflow/ (see
 * src/server/admin/blockflow.ts) — the same runtime bundle the books of this
 * instance render with. The frame is same-origin, so we can postMessage it:
 *
 *   embed  → us   { type: "ready", version, entry }   send `load` with the document
 *   us     → embed { type: "load", content, encoding, locale }
 *   embed  → us   { type: "change", content, encoding }  a debounced edit
 *   us     → embed { type: "save" }                      Ctrl/⌘+S in the editor
 *   embed  → us   { type: "saved", content, encoding }   fresh document; we save it
 *   embed  → us   { type: "error", message }
 */

type EmbedMessage =
  | { type: "ready"; version: string; entry: string }
  | { type: "change"; content: string; encoding: string }
  | { type: "saved"; content: string; encoding: string }
  | { type: "error"; message: string }
  | { type: "preview"; url: string };

type HostMessage = {
  type: "load" | "update" | "save";
  content?: string;
  encoding?: "base64" | "utf8";
  locale?: string;
};

/**
 * One blockflow embed page framed same-origin. `page` is the bundle entry,
 * `encoding` how the document travels ("base64" for a .sb3 zip, "utf8" for a
 * .blockflow project file).
 */
export default function BlockflowEmbed({
  page,
  encoding,
  text,
  language,
  onChange,
  onSave,
}: VisualEditorProps & { page: "embed-editor.html" | "embed-generator.html"; encoding: "base64" | "utf8" }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef({ text, language, onChange, onSave });
  latest.current = { text, language, onChange, onSave };

  useEffect(() => {
    const iframe = frame.current!;
    // Report to the editor around this frame, like main.tsx does.
    const fail = (message: string) => window.parent.postMessage({ type: "error", message }, location.origin);
    const post = (message: HostMessage) => iframe.contentWindow?.postMessage(message, location.origin);
    let ready = false;
    const readyTimer = window.setTimeout(() => {
      if (!ready)
        fail("The blockflow editor did not answer: the served bundle needs blockflow v0.2.0+ (embed entries).");
    }, 30_000);
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== iframe.contentWindow) return;
      const m = e.data as EmbedMessage;
      if (m.type === "ready") {
        ready = true;
        window.clearTimeout(readyTimer);
        post({ type: "load", content: latest.current.text, encoding, locale: latest.current.language });
      } else if (m.type === "change") {
        latest.current.onChange(m.content);
      } else if (m.type === "saved") {
        // The document freshly serialized at save time; onChange first, so
        // the save that follows picks it up.
        latest.current.onChange(m.content);
        latest.current.onSave();
      } else if (m.type === "error") {
        fail(m.message);
      }
      // "preview" (generator) is not used: the book's pages play the project.
    };
    // Saving belongs to the platform: Ctrl/⌘+S in the nested editor asks the
    // embed for the current document, whose "saved" answer saves the file.
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        post({ type: "save" });
      }
    };
    const onLoad = () => iframe.contentWindow?.addEventListener("keydown", onKey, true);
    window.addEventListener("message", onMessage);
    iframe.addEventListener("load", onLoad);
    if (iframe.contentDocument?.readyState === "complete") onLoad();
    return () => {
      window.clearTimeout(readyTimer);
      window.removeEventListener("message", onMessage);
      iframe.removeEventListener("load", onLoad);
      iframe.contentWindow?.removeEventListener("keydown", onKey, true);
    };
    // The document comes once when the frame is mounted; later changes come
    // from the embed itself (see VisualFrame).
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <iframe
      ref={frame}
      src={`/blockflow/${page}`}
      title={`blockflow ${page}`}
      className="h-full w-full border-0 bg-white"
    />
  );
}
