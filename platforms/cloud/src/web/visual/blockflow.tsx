import type { VisualEditorProps } from "./protocol";
import BlockflowEmbed from "./blockflow-embed";

/**
 * A `.sb3` file in blockflow's embed editor (embed-editor.html), served at
 * /blockflow/ — the same runtime bundle the books render with. The document
 * travels as base64 of the .sb3 zip, so saving writes the file with
 * encoding "base64" (see workspace.ts).
 */
export default function BlockflowEditor(props: VisualEditorProps) {
  return <BlockflowEmbed {...props} page="embed-editor.html" encoding="base64" />;
}
