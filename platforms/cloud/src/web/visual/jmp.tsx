import { MemoryPlaygroundEditor, initialMemory, setPersistence } from "@java-memory-playground/java-memory-playground";
import "@java-memory-playground/java-memory-playground/index.css";
import { useEffect } from "react";
import type { VisualEditorProps } from "./protocol";

// The file in the book is the document, not the address bar.
setPersistence(false);

const serialize = (memory: unknown) => JSON.stringify(memory, null, 2) + "\n";

/**
 * The teacher's Java Memory Playground of the version books render with. It
 * reports real edits only (not loading, panning or zooming); its own Save
 * button saves the file.
 */
export default function JmpEditor({ text, language, onChange, onSave }: VisualEditorProps) {
  const empty = !text.trim();
  // A new, empty file gets the playground's starting diagram.
  useEffect(() => {
    if (empty) onChange(serialize(initialMemory));
  }, [empty]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ height: "100%" }}>
      <MemoryPlaygroundEditor
        memory={empty ? initialMemory : text}
        language={language}
        persistence={false}
        onEdit={(memory) => onChange(serialize(memory))}
        // Its own save button saves the file.
        onChange={(memory) => {
          onChange(serialize(memory));
          onSave();
        }}
      />
    </div>
  );
}
