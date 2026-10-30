import type { VisualEditorProps } from "./protocol";
import BlockflowEmbed from "./blockflow-embed";

/**
 * A `.blockflow` project file (the generator's JSON, what
 * `::::blockflow-editor{project="…"}` points at) in blockflow's embed
 * generator (embed-generator.html), served at /blockflow/. The document is
 * the file's JSON text.
 */
export default function BlockflowProjectEditor(props: VisualEditorProps) {
  return <BlockflowEmbed {...props} page="embed-generator.html" encoding="utf8" />;
}
