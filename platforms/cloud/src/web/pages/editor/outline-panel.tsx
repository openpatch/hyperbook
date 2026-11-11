import { EditorView } from "@codemirror/view";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { currentHeading, outlineKind, parseOutline, subscribeView } from "./outline";

/**
 * The sidebar's Outline view: the open file's headings, indented by level,
 * the one the cursor is under marked. Choosing one moves the cursor there.
 */
export function OutlinePanel({
  path,
  view,
  active,
  onChosen,
}: {
  /** Whether the view is shown; hidden, it follows nothing. */
  active: boolean;
  /** The active file. */
  path: string | null;
  /** Its code editor, if it has one. */
  view: EditorView | undefined;
  /** After a heading was chosen (a phone closes the drawer). */
  onChosen?: () => void;
}) {
  const { t } = useTranslation();
  const kind = path ? outlineKind(path) : null;
  // Every change of the text or the cursor gives a new state.
  const watched = active ? view : undefined;
  const state = useSyncExternalStore(
    useCallback((listener) => (watched ? subscribeView(watched, listener) : () => {}), [watched]),
    () => watched?.state,
  );
  // Typing comes first; the outline follows when there is time.
  const doc = useDeferredValue(state?.doc);
  const headings = useMemo(() => (doc && kind ? parseOutline(doc, kind) : []), [doc, kind]);
  const current = state ? currentHeading(headings, state.selection.main.head) : -1;
  const minLevel = headings.reduce((min, h) => Math.min(min, h.level), 6);

  // The current heading stays in sight in a long outline.
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    list.current?.querySelector('[aria-current="location"]')?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const choose = (from: number) => {
    if (!view) return;
    view.dispatch({
      selection: { anchor: from },
      effects: EditorView.scrollIntoView(from, { y: "start", yMargin: 24 }),
    });
    view.focus();
    onChosen?.();
  };

  let message: string | null = null;
  if (!path) message = t("editor.outline.noFile");
  else if (!kind || !view) message = t("editor.outline.unsupported");
  else if (headings.length === 0) message = t("editor.outline.empty");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-9 items-baseline gap-2 border-b border-sidebar-border px-2 py-1.5 pointer-coarse:min-h-11">
        <h2 className="shrink-0 text-sm font-medium">{t("editor.outline.title")}</h2>
        {path && (
          <span dir="rtl" className="min-w-0 truncate text-xs text-muted-foreground" title={path}>
            {path.split("/").pop()}
          </span>
        )}
      </div>
      {message ? (
        <p className="p-3 text-sm text-muted-foreground">{message}</p>
      ) : (
        <ul ref={list} className="min-h-0 flex-1 overflow-y-auto p-1" aria-label={t("editor.outline.title")}>
          {headings.map((heading, i) => (
            <li key={`${heading.from}-${i}`}>
              <button
                type="button"
                aria-current={i === current ? "location" : undefined}
                title={heading.title}
                className={cn(
                  "block w-full truncate rounded-sm py-0.5 pr-2 text-left text-sm hover:bg-accent pointer-coarse:py-2",
                  i === current ? "bg-accent font-medium text-primary" : "text-foreground",
                  heading.level === minLevel && "font-semibold",
                )}
                style={{ paddingLeft: `${0.5 + (heading.level - minLevel) * 0.875}rem` }}
                onClick={() => choose(heading.from)}
              >
                {heading.title || t("editor.outline.untitled")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
