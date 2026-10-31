import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * One file in the list, memoized on primitives: choosing or hovering changes
 * the selected rows only, not the whole list.
 */
const QuickOpenRow = memo(function QuickOpenRow({
  path,
  index,
  isSelected,
  isOpen,
  openLabel,
  onHover,
  onChoose,
}: {
  path: string;
  index: number;
  isSelected: boolean;
  isOpen: boolean;
  /** What the "open already" badge says, so rows need no translator. */
  openLabel: string;
  onHover: (index: number) => void;
  onChoose: (path: string) => void;
}) {
  return (
    <li
      role="option"
      aria-selected={isSelected}
      className={cn(
        "cursor-pointer truncate rounded-sm px-2 py-1.5 font-mono text-sm",
        isSelected ? "bg-accent font-medium text-primary" : "hover:bg-accent",
      )}
      onMouseMove={() => onHover(index)}
      onClick={() => onChoose(path)}
    >
      {path}
      {isOpen && (
        <span className="ml-2 rounded-sm bg-secondary px-1 font-sans text-xs text-muted-foreground">
          {openLabel}
        </span>
      )}
    </li>
  );
});

/**
 * The "open a file" popup (Ctrl/Cmd+P): type to filter the book's files,
 * arrows to choose, Enter to open. Files that are open already come first.
 */
export function QuickOpen({
  open,
  files,
  tabs,
  onClose,
  onOpen,
}: {
  open: boolean;
  /** All paths in the book. */
  files: string[];
  /** The open tabs' paths. */
  tabs: string[];
  onClose: () => void;
  onOpen: (path: string) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const list = useRef<HTMLUListElement>(null);

  // Every opening starts fresh.
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
    }
  }, [open]);

  const openTabs = useMemo(() => new Set(tabs), [tabs]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return files
      .map((path) => ({
        path,
        at: needle === "" ? 0 : path.toLowerCase().indexOf(needle),
      }))
      .filter(({ at }) => at >= 0)
      .sort(
        (a, b) =>
          Number(openTabs.has(b.path)) - Number(openTabs.has(a.path)) ||
          a.at - b.at ||
          a.path.localeCompare(b.path),
      )
      .slice(0, 100)
      .map((match) => match.path);
  }, [files, openTabs, query]);

  // The selection follows the matches; the chosen item scrolls into view.
  useEffect(() => setSelected(0), [query]);
  useEffect(() => {
    list.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [selected, matches]);

  // Stable, so the memoized rows re-render only when their own props change.
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const choose = useCallback((path: string) => {
    onOpenRef.current(path);
    onCloseRef.current();
  }, []);
  const hover = useCallback((index: number) => setSelected(index), []);

  const openLabel = t("editor.quickOpen.open");

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent
        className="top-[10vh] max-w-md translate-y-0 gap-0 overflow-hidden p-0"
        showCloseButton={false}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">
          {t("editor.quickOpen.title")}
        </DialogTitle>
        <Input
          autoFocus
          value={query}
          spellCheck={false}
          placeholder={t("editor.quickOpen.placeholder")}
          aria-label={t("editor.quickOpen.aria")}
          aria-controls="quick-open-list"
          className="h-11 rounded-none border-0 border-b border-border font-mono text-sm focus-visible:ring-0"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setSelected((i) =>
                Math.min(
                  Math.max(i + (e.key === "ArrowDown" ? 1 : -1), 0),
                  matches.length - 1,
                ),
              );
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (matches[selected]) choose(matches[selected]);
            } else if (e.key === "Home" || e.key === "End") {
              e.preventDefault();
              setSelected(e.key === "Home" ? 0 : matches.length - 1);
            }
          }}
        />
        <ul
          ref={list}
          id="quick-open-list"
          role="listbox"
          aria-label={t("editor.quickOpen.files")}
          className="max-h-80 overflow-auto p-1"
        >
          {matches.map((path, i) => (
            <QuickOpenRow
              key={path}
              path={path}
              index={i}
              isSelected={i === selected}
              isOpen={openTabs.has(path)}
              openLabel={openLabel}
              onHover={hover}
              onChoose={choose}
            />
          ))}
          {matches.length === 0 && (
            <li className="px-2 py-6 text-center text-sm text-muted-foreground">
              {t("editor.quickOpen.noMatches")}
            </li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
