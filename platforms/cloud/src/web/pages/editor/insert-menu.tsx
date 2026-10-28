import type { EditorView } from "@codemirror/view";
import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Elements whose content is a file of its own; new ones are kept in public/. */
export const FILE_ELEMENTS = {
  learningmap: { label: "Learning map", name: "map", directive: (src: string) => `::learningmap{src="${src}" height="600px"}` },
  excalidraw: { label: "Drawing", name: "drawing", directive: (src: string) => `::excalidraw{src="${src}"}` },
  jmp: { label: "Java memory diagram", name: "memory", directive: (src: string) => `::jmp{src="${src}" height="600px"}` },
  bitflow: { label: "Flow (assessment)", name: "flow", directive: (src: string) => `::bitflow{src="${src}" height="600px"}` },
  struktolab: { label: "Structogram", name: "structogram", directive: (src: string) => `::struktolab{src="${src}"}` },
} as const;

export type FileElement = keyof typeof FILE_ELEMENTS;

/** Puts `text` at the cursor, on lines of its own. */
export function insertAtCursor(view: EditorView, text: string) {
  const { from, to } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const before = from === line.from ? (line.number > 1 ? "\n" : "") : "\n\n";
  const insert = `${before}${text}\n`;
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length },
    scrollIntoView: true,
  });
  view.focus();
}

/** "Insert" above a page: elements with a starter file, or uploaded H5P content. */
export function InsertMenu({
  view,
  onFileElement,
  onH5P,
}: {
  view: () => EditorView | null;
  onFileElement: (kind: FileElement, view: EditorView) => void;
  /** Upload a .h5p (made elsewhere) and show it in the page. */
  onH5P: (view: EditorView) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          Insert <ChevronDownIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {(Object.keys(FILE_ELEMENTS) as FileElement[]).map((kind) => (
          <DropdownMenuItem
            key={kind}
            onSelect={() => {
              const v = view();
              if (v) onFileElement(kind, v);
            }}
          >
            {FILE_ELEMENTS[kind].label}…
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem
          onSelect={() => {
            const v = view();
            if (v) onH5P(v);
          }}
        >
          H5P content (upload)…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
