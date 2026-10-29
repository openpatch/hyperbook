import { useCallback, useEffect, useState } from "react";

/** A font the editor can use; the Monaspace family ships with the editor. */
export type EditorFont = {
  /** The stored choice. */
  key: string;
  /** The name in the menu. */
  label: string;
  /** The CSS font-family stack (the @font-face rules are in app.css). */
  stack: string;
};

/** The editor's font choices: the system's monospace and GitHub's Monaspace. */
export const FONTS: EditorFont[] = [
  {
    key: "system",
    label: "System",
    stack: "var(--font-code, ui-monospace, monospace)",
  },
  {
    key: "neon",
    label: "Monaspace Neon",
    stack: '"Monaspace Neon", ui-monospace, monospace',
  },
  {
    key: "argon",
    label: "Monaspace Argon",
    stack: '"Monaspace Argon", ui-monospace, monospace',
  },
  {
    key: "xenon",
    label: "Monaspace Xenon",
    stack: '"Monaspace Xenon", ui-monospace, monospace',
  },
  {
    key: "radon",
    label: "Monaspace Radon",
    stack: '"Monaspace Radon", ui-monospace, monospace',
  },
  {
    key: "krypton",
    label: "Monaspace Krypton",
    stack: '"Monaspace Krypton", ui-monospace, monospace',
  },
];

/** The font a stored choice names; an unknown key is the system's font. */
export const fontOf = (key: string): EditorFont =>
  FONTS.find((font) => font.key === key) ?? FONTS[0]!;

/** The editor's look, as its teacher chose it; kept in the browser. */
export type EditorSettings = {
  /** The editor's font (see FONTS). */
  font: string;
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
  font: "system",
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
      font: FONTS.some((font) => font.key === value?.font)
        ? value!.font!
        : DEFAULTS.font,
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
