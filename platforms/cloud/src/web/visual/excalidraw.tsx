import { Excalidraw, serializeAsJSON } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";
import { useMemo, useRef } from "react";
import { useTheme } from "@/lib/theme";
import type { VisualEditorProps } from "./protocol";

declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string;
  }
}

// Fonts come from the platform, not from a CDN (see vite.config.ts).
window.EXCALIDRAW_ASSET_PATH = "/excalidraw-assets/";

/**
 * Excalidraw of the version books render with. The file is Excalidraw's own
 * format (serializeAsJSON), which books load as it is. Excalidraw reports a
 * change on every pointer move; only a different file counts.
 */
export default function ExcalidrawEditor({ text, language, onChange }: VisualEditorProps) {
  const initialData = useMemo<ExcalidrawInitialDataState | null>(() => {
    if (!text.trim()) return null;
    const data = JSON.parse(text);
    return { ...data, scrollToContent: true, appState: { ...data.appState, collaborators: new Map() } };
  }, [text]);
  // The first serialization is the file as Excalidraw reads it.
  const baseline = useRef<string | null>(null);
  const last = useRef<string | null>(null);
  const theme = useTheme();

  return (
    <div style={{ height: "100%" }}>
      <Excalidraw
        initialData={initialData}
        langCode={language}
        theme={theme}
        UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: { saveFileToDisk: true } } }}
        onChange={(elements, appState, files) => {
          const now = serializeAsJSON(elements, appState, files, "local");
          if (baseline.current === null) baseline.current = now;
          if (now === last.current) return;
          last.current = now;
          onChange(now === baseline.current ? text : now);
        }}
      />
    </div>
  );
}
