import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const open = new Set(tabs);
    return files
      .map((path) => ({
        path,
        at: needle === "" ? 0 : path.toLowerCase().indexOf(needle),
      }))
      .filter(({ at }) => at >= 0)
      .sort(
        (a, b) =>
          Number(open.has(b.path)) - Number(open.has(a.path)) ||
          a.at - b.at ||
          a.path.localeCompare(b.path),
      )
      .slice(0, 100)
      .map((match) => match.path);
  }, [files, tabs, query]);

  // The selection follows the matches; the chosen item scrolls into view.
  useEffect(() => setSelected(0), [query]);
  useEffect(() => {
    list.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [selected, matches]);

  const choose = (path: string) => {
    onOpen(path);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent
        className="top-[10vh] max-w-md translate-y-0 gap-0 overflow-hidden p-0"
        showCloseButton={false}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{t("editor.quickOpen.title")}</DialogTitle>
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
            <li
              key={path}
              role="option"
              aria-selected={i === selected}
              className={cn(
                "cursor-pointer truncate rounded-sm px-2 py-1.5 font-mono text-sm",
                i === selected
                  ? "bg-accent font-medium text-primary"
                  : "hover:bg-accent",
              )}
              onMouseMove={() => setSelected(i)}
              onClick={() => choose(path)}
            >
              {path}
              {tabs.includes(path) && (
                <span className="ml-2 rounded-sm bg-secondary px-1 font-sans text-xs text-muted-foreground">
                  {t("editor.quickOpen.open")}
                </span>
              )}
            </li>
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
