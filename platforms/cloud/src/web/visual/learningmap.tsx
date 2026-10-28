import { LearningMapEditor, type RoadmapData, setPersistence, useEditorStore } from "@learningmap/learningmap";
import "@learningmap/learningmap/index.css";
import { useEffect, useMemo } from "react";
import type { VisualEditorProps } from "./protocol";

// The file in the book is the document, not the browser's storage.
setPersistence(false);

const serialize = (data: RoadmapData) => JSON.stringify(data, null, 2) + "\n";

/**
 * The learning map editor of the version books render with. It reports the
 * whole map whenever it differs from what was loaded; back at the start it
 * reports the original text, so the file counts as unchanged again.
 */
export default function LearningmapEditor({ text, language, onChange }: VisualEditorProps) {
  const data = useMemo(() => (text.trim() ? (JSON.parse(text) as RoadmapData) : undefined), [text]);

  // What the editor makes of the file before anyone changes it: loading
  // fills in defaults, which alone is no change.
  const baseline = useMemo(() => {
    const store = useEditorStore.getState();
    store.reset();
    if (data) store.loadRoadmapData(data);
    const settings = useEditorStore.getState().settings;
    if (!settings?.language) store.setSettings({ ...settings, language: "auto" });
    return serialize(useEditorStore.getState().getRoadmapData());
  }, [data]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useEditorStore.subscribe(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const now = serialize(useEditorStore.getState().getRoadmapData());
        onChange(now === baseline ? text : now);
      }, 200);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [baseline, text, onChange]);

  return (
    <LearningMapEditor
      roadmapData={data}
      language={language}
      disablePersist
      disableSharing
      disableFileOperations
    />
  );
}
