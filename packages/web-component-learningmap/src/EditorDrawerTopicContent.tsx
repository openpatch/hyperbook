import { EditorDrawerTaskContent } from "./EditorDrawerTaskContent";

// For now, topic content is the same as task content. You can customize later if needed.
export function EditorDrawerTopicContent(props: any) {
  return <EditorDrawerTaskContent {...props} />;
}
