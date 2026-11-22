import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

/**
 * One page of `items` at a time. The page is clamped when the list shrinks
 * (a filter, a deleted row), so it never points past the end.
 */
export function usePaged<T>(items: readonly T[], size: number) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pages - 1);
  useEffect(() => {
    if (page !== current) setPage(current);
  }, [page, current]);
  return {
    rows: items.slice(current * size, (current + 1) * size),
    page: current,
    pages,
    setPage,
    from: items.length === 0 ? 0 : current * size + 1,
    to: Math.min(items.length, (current + 1) * size),
    total: items.length,
  };
}

export type PagerState = {
  page: number;
  pages: number;
  setPage: (page: number) => void;
  from: number;
  to: number;
  total: number;
};

/** The pager's state for a list paged on the server: `total` rows, `size` a page. */
export function serverPaged(page: number, size: number, total: number, setPage: (page: number) => void): PagerState {
  return {
    page,
    pages: Math.max(1, Math.ceil(total / size)),
    setPage,
    from: total === 0 ? 0 : page * size + 1,
    to: Math.min(total, (page + 1) * size),
    total,
  };
}

/** "11–20 of 57" with previous/next; nothing while everything fits on one page. */
export function Pager({ paged }: { paged: PagerState }) {
  const { t } = useTranslation();
  if (paged.pages <= 1) return null;
  return (
    <div className="mt-2 flex items-center justify-end gap-2 text-sm text-muted-foreground">
      <span aria-live="polite">{t("common.pager.range", { from: paged.from, to: paged.to, total: paged.total })}</span>
      <Button
        variant="ghost"
        size="sm"
        disabled={paged.page === 0}
        onClick={() => paged.setPage(paged.page - 1)}
        aria-label={t("common.pager.previous")}
      >
        <ChevronLeftIcon aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={paged.page >= paged.pages - 1}
        onClick={() => paged.setPage(paged.page + 1)}
        aria-label={t("common.pager.next")}
      >
        <ChevronRightIcon aria-hidden />
      </Button>
    </div>
  );
}
