import { useCallback, useEffect, useState } from "react";

/** The editor's look, as its teacher chose it; kept in the browser. */
export type EditorSettings = {
  /** CodeMirror's font size in px. */
  fontSize: number;
  /** The editor's line height, relative to the font size. */
  lineHeight: number;
  /** Whether the editor shows line numbers. */
  lineNumbers: boolean;
  /** Whether pages are spell checked. */
  spellCheck: boolean;
};

const STORAGE_KEY = "editor-settings";
export const FONT_SIZES = [12, 13, 14, 16, 18, 20, 24];
export const LINE_HEIGHTS = [1.2, 1.6, 2];
const DEFAULTS: EditorSettings = {
  fontSize: 14,
  lineHeight: 1.6,
  lineNumbers: true,
  spellCheck: true,
};

function stored(): EditorSettings {
  try {
    const value = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "null",
    ) as Partial<EditorSettings> | null;
    return {
      fontSize: FONT_SIZES.includes(value?.fontSize ?? 14)
        ? value!.fontSize!
        : DEFAULTS.fontSize,
      lineHeight: LINE_HEIGHTS.includes(value?.lineHeight ?? 1.6)
        ? value!.lineHeight!
        : DEFAULTS.lineHeight,
      lineNumbers: value?.lineNumbers ?? DEFAULTS.lineNumbers,
      spellCheck: value?.spellCheck ?? DEFAULTS.spellCheck,
    };
  } catch {
    return DEFAULTS;
  }
}

/** Reads and keeps the editor settings; a change applies while editing. */
export function useEditorSettings() {
  const [settings, setSettings] = useState<EditorSettings>(stored);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Remembered for this page only.
    }
  }, [settings]);
  const update = useCallback(
    (patch: Partial<EditorSettings>) =>
      setSettings((current) => ({ ...current, ...patch })),
    [],
  );
  return [settings, update] as const;
}
