/*
 * The editor talks to a visual editor frame (visual.html, same origin) by
 * postMessage. The frame keeps each element's own CSS away from the admin
 * app; the document travels as text both ways.
 *
 *   frame  → editor  { type: "ready" }               loaded, send the document
 *   editor → frame   { type: "load", text, language } show this document
 *   frame  → editor  { type: "change", text }        the document now is this
 *   frame  → editor  { type: "error", message }      the document cannot be shown
 *   frame  → editor  { type: "save" }                Ctrl/⌘+S inside the frame
 */

/**
 * struktolab: a .struktolab file (JSON tree); struktolab-pseudocode: a block inside a page.
 * blockflow: a .sb3 file — binary, so the frame gets it base64-encoded.
 * blockflow-project: a .blockflow project file (the generator's JSON).
 */
export type VisualKind =
  | "learningmap"
  | "excalidraw"
  | "jmp"
  | "bitflow"
  | "struktolab"
  | "struktolab-pseudocode"
  | "blockflow"
  | "blockflow-project";

export type ToFrame = { type: "load"; text: string; language: string };

export type FromFrame =
  | { type: "ready" }
  | { type: "change"; text: string }
  | { type: "error"; message: string }
  | { type: "save" };

/** Props every visual editor in the frame gets. */
export type VisualEditorProps = {
  text: string;
  language: string;
  /** Called with the whole new document, as the text of its file. */
  onChange: (text: string) => void;
  /** The editor's own save button: save the file. */
  onSave: () => void;
};
