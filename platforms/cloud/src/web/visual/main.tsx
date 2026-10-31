import { type ComponentType, StrictMode, Suspense, lazy, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
// The frame follows the app's theme, not only at load (theme.js, injected by
// the theme() plugin, sets .dark before the first paint) but when the toggle
// in the editor around it changes it: lib/theme keeps the class in step with
// the parent's choice, which reaches the frame as a storage event. The class
// is what theme.css and the dark tokens key on, so every editor — whatever
// its mechanism, tokens or a theme prop like Excalidraw's — follows along.
import "@/lib/theme";
import "./theme.css";
import type { FromFrame, ToFrame, VisualEditorProps, VisualKind } from "./protocol";

/** Each editor is its own chunk, loaded only when a file of its kind is opened. */
const EDITORS: Record<VisualKind, () => Promise<{ default: ComponentType<VisualEditorProps> }>> = {
  learningmap: () => import("./learningmap"),
  excalidraw: () => import("./excalidraw"),
  jmp: () => import("./jmp"),
  bitflow: () => import("./bitflow"),
  struktolab: () => import("./struktolab"),
  "struktolab-pseudocode": () => import("./struktolab-pseudocode"),
  blockflow: () => import("./blockflow"),
  "blockflow-project": () => import("./blockflow-project"),
};

const kind = new URLSearchParams(location.search).get("kind") as VisualKind;

function send(message: FromFrame) {
  // Only ever to the editor that framed us, on the same origin.
  window.parent.postMessage(message, location.origin);
}

const Editor = EDITORS[kind] ? lazy(EDITORS[kind]) : null;

function App() {
  const [doc, setDoc] = useState<ToFrame | null>(null);

  useEffect(() => {
    const onMessage = (e: MessageEvent<ToFrame>) => {
      if (e.origin !== location.origin || e.source !== window.parent) return;
      if (e.data?.type === "load") setDoc(e.data);
    };
    window.addEventListener("message", onMessage);
    send({ type: "ready" });
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!Editor) return <p>Unknown editor: {kind}</p>;
  if (!doc) return null;
  return (
    <Suspense fallback={null}>
      <Editor
        text={doc.text}
        language={doc.language} onChange={(text) => send({ type: "change", text })}
        onSave={() => send({ type: "save" })}
      />
    </Suspense>
  );
}

window.addEventListener("error", (e) => send({ type: "error", message: e.message }));
// Saving belongs to the editor around the frame.
window.addEventListener(
  "keydown",
  (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      // Saving is the platform's: no element's own save shortcut runs as well.
      e.stopImmediatePropagation();
      // After the editors' own change reports (debounced up to 200 ms).
      setTimeout(() => send({ type: "save" }), 250);
    }
  },
  true,
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
