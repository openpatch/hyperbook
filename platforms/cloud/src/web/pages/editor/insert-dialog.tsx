import { SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { INSERT_GROUPS, INSERT_ITEMS, type InsertItem, groupLabel, itemDescription, itemLabel } from "./insert";

/** Lowercase without accents, so "uberschrift" finds "Überschrift". */
const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * "Insert element": the page's elements, grouped by what they do, each with
 * a sentence on what it is for; a search narrows them down.
 */
export function InsertDialog({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (item: InsertItem) => void;
}) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    const matches = (item: InsertItem) => {
      const text = fold(`${itemLabel(item)} ${itemDescription(item)} ${item.directive}`);
      return words.every((w) => text.includes(w));
    };
    return INSERT_GROUPS.map((group) => ({
      group,
      items: INSERT_ITEMS.filter((item) => item.group === group && matches(item)),
    })).filter((g) => g.items.length > 0);
    // The names follow the app's language.
  }, [query, i18n.language]); // eslint-disable-line react-hooks/exhaustive-deps
  const first = groups[0]?.items[0];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
          setQuery("");
        }
      }}
    >
      <DialogContent className="flex max-h-[85vh] flex-col gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("editor.insert.title")}</DialogTitle>
          <DialogDescription>{t("editor.insert.description")}</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Enter takes the first match.
              if (e.key === "Enter" && first) {
                e.preventDefault();
                onPick(first);
                setQuery("");
              }
            }}
            placeholder={t("editor.insert.search")}
            aria-label={t("editor.insert.search")}
            className="pl-8"
          />
        </div>
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          {groups.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t("editor.insert.none")}</p>}
          {groups.map(({ group, items }) => (
            <section key={group} className="mb-4" aria-labelledby={`insert-group-${group}`}>
              <h3 id={`insert-group-${group}`} className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {groupLabel(group)}
              </h3>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onPick(item);
                        setQuery("");
                      }}
                      className="flex h-full w-full flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <span className="text-sm font-medium">{itemLabel(item)}</span>
                      <span className="text-xs text-muted-foreground">{itemDescription(item)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
