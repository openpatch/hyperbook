import type { EditorView } from "@codemirror/view";
import {
  BoldIcon,
  CodeIcon,
  HeadingIcon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  type LucideIcon,
  PlusIcon,
  TableIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { FORMATS, type FormatId, type Syntax, applyFormat, example } from "./format";

const ICONS: Record<FormatId, LucideIcon> = {
  heading: HeadingIcon,
  bold: BoldIcon,
  italic: ItalicIcon,
  bullets: ListIcon,
  numbers: ListOrderedIcon,
  link: LinkIcon,
  image: ImageIcon,
  table: TableIcon,
  code: CodeIcon,
};

/** Where the toolbar groups its buttons with a gap. */
const GAP_AFTER: ReadonlySet<FormatId> = new Set(["heading", "italic", "numbers"]);

/**
 * Above a page or a Typst file: headings, bold, lists, links, images and
 * tables in the file's own syntax, which each button's tooltip shows; on
 * pages also "Insert element".
 */
export function FormatToolbar({
  syntax,
  view,
  onInsertElement,
}: {
  syntax: Syntax;
  /** The file's editor, read when a button is clicked. */
  view: () => EditorView | null;
  /** Pages: opens the list of elements. */
  onInsertElement?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="toolbar"
      aria-label={t("editor.format.toolbar")}
      className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b bg-muted/40 px-1.5 py-1"
    >
      {FORMATS.map((id) => {
        const Icon = ICONS[id];
        const label = t(`editor.format.${id}`);
        return (
          <span key={id} className="contents">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title={`${label}: ${example(id, syntax)}`}
              aria-label={label}
              // Keeps the editor's selection, which the format applies to.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                const v = view();
                if (v) applyFormat(v, id, syntax);
              }}
            >
              <Icon />
            </Button>
            {GAP_AFTER.has(id) && <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />}
          </span>
        );
      })}
      {onInsertElement && (
        <>
          <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            title={t("editor.insert.hint")}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onInsertElement}
          >
            <PlusIcon /> {t("editor.insert.button")}
          </Button>
        </>
      )}
    </div>
  );
}
