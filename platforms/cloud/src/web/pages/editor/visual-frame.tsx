import { useEffect, useRef, useState } from "react";
import type { FromFrame, ToFrame, VisualKind } from "../../visual/protocol";

// The file-type registry and the save check live in visual-kinds.ts, so
// files.ts can ask them without an import cycle.
export { visualKind, visualProblem } from "./visual-kinds";

/**
 * A visual editor in a same-origin frame, so its CSS stays out of the admin
 * app. It gets the document once when it is ready and reports every change.
 */
export function VisualFrame({
  kind,
  text,
  onChange,
  onSave,
  language = navigator.language.slice(0, 2),
}: {
  kind: VisualKind;
  /** The document when the frame was (re)mounted; later changes come from the frame. */
  text: string;
  onChange: (text: string) => void;
  onSave: () => void;
  /** The editor's language; struktolab takes the book's, for its keywords. */
  language?: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const initial = useRef(text);
  const latest = useRef({ onChange, onSave });
  latest.current = { onChange, onSave };
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onMessage = (e: MessageEvent<FromFrame>) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      const message = e.data;
      if (message.type === "ready") {
        const load: ToFrame = { type: "load", text: initial.current, language };
        frame.current!.contentWindow!.postMessage(load, location.origin);
      } else if (message.type === "change") {
        latest.current.onChange(message.text);
      } else if (message.type === "save") {
        latest.current.onSave();
      } else if (message.type === "error") {
        setError(message.message);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div className="relative h-full">
      <iframe
        ref={frame}
        src={`/visual.html?kind=${kind}`}
        title={`${kind} editor`}
        className="h-full w-full border-0 bg-white"
      />
      {error && (
        <p className="absolute right-2 bottom-2 left-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          The editor reported a problem: {error}. Switch to Source to fix the file.
        </p>
      )}
    </div>
  );
}
