import { useQuery } from "@tanstack/react-query";
import {
  CaseSensitiveIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  RefreshCwIcon,
  RegexIcon,
  ReplaceAllIcon,
  WholeWordIcon,
} from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  type FileMatches,
  InvalidQueryError,
  type SearchMatch,
  type SearchQuery,
  type SearchResult,
  searchFiles,
} from "../../../shared/search";
import { fetchTexts } from "./files";

/** The book's text files as of `commit`, for searching (see routes/files.ts). */
export function useBookTexts(bookId: string, commit: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["books", bookId, "texts", commit],
    queryFn: () => fetchTexts(bookId),
    enabled,
    staleTime: Infinity,
  });
}

/**
 * The searched files: the saved ones, each open tab's unsaved text taking the
 * place of its saved one, and open files the listing does not know yet.
 */
export function searchedTexts(saved: { path: string; text: string }[], open: { path: string; text: string }[]) {
  const live = new Map(open.map((file) => [file.path, file.text]));
  const files = saved.map((file) => ({ path: file.path, text: live.get(file.path) ?? file.text }));
  const known = new Set(saved.map((file) => file.path));
  for (const file of open) if (!known.has(file.path)) files.push(file);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

const Toggle = ({
  label,
  pressed,
  onToggle,
  children,
}: {
  label: string;
  pressed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) => (
  <Button
    type="button"
    variant="ghost"
    size="icon"
    className={cn("size-6 pointer-coarse:size-8", pressed && "bg-accent text-primary ring-1 ring-primary/40")}
    aria-label={label}
    title={label}
    aria-pressed={pressed}
    onClick={onToggle}
  >
    {children}
  </Button>
);

/** One match: its line number and the line, the match marked. */
const MatchRow = memo(function MatchRow({
  path,
  match,
  onReveal,
}: {
  path: string;
  match: SearchMatch;
  onReveal: (path: string, match: SearchMatch) => void;
}) {
  const { preview, previewFrom, previewTo } = match;
  return (
    <li>
      <button
        type="button"
        className="flex w-full items-baseline gap-2 rounded-sm py-0.5 pr-2 pl-6 text-left text-xs hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
        onClick={() => onReveal(path, match)}
      >
        <span className="w-7 shrink-0 text-right font-mono text-muted-foreground tabular-nums">{match.line}</span>
        <span className="min-w-0 truncate font-mono whitespace-pre">
          {preview.slice(0, previewFrom)}
          <mark className="rounded-sm bg-amber-300/60 text-foreground dark:bg-amber-500/40">
            {preview.slice(previewFrom, previewTo)}
          </mark>
          {preview.slice(previewTo)}
        </span>
      </button>
    </li>
  );
});

const FileGroup = memo(function FileGroup({
  file,
  onReveal,
}: {
  file: FileMatches;
  onReveal: (path: string, match: SearchMatch) => void;
}) {
  const [open, setOpen] = useState(true);
  const slash = file.path.lastIndexOf("/");
  return (
    <li>
      <button
        type="button"
        className="flex w-full items-center gap-1 rounded-sm px-1 py-0.5 text-left text-sm hover:bg-accent"
        aria-expanded={open}
        title={file.path}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDownIcon className="size-3.5 shrink-0" aria-hidden />
        ) : (
          <ChevronRightIcon className="size-3.5 shrink-0" aria-hidden />
        )}
        <span className="shrink-0 font-medium">{file.path.slice(slash + 1)}</span>
        <span dir="rtl" className="min-w-0 truncate text-xs text-muted-foreground">
          {slash === -1 ? "" : file.path.slice(0, slash)}
        </span>
        <span className="ml-auto shrink-0 rounded-full bg-secondary px-1.5 text-xs text-muted-foreground tabular-nums">
          {file.matches.length}
        </span>
      </button>
      {open && (
        <ul>
          {file.matches.map((match) => (
            <MatchRow key={match.from} path={file.path} match={match} onReveal={onReveal} />
          ))}
        </ul>
      )}
    </li>
  );
});

/**
 * The sidebar's "Search" view (Ctrl/Cmd+Shift+F): one query over every text
 * file of the book, unsaved changes included, and replacing every match.
 */
export function SearchPanel({
  texts,
  openTexts,
  changeKey,
  readOnly,
  focusRequest,
  onReveal,
  onReplaceAll,
}: {
  /** The book's saved texts (useBookTexts). */
  texts: ReturnType<typeof useBookTexts>;
  /** The open tabs' current texts. */
  openTexts: () => { path: string; text: string }[];
  /** Changes when the open tabs' texts may have, so the search runs again. */
  changeKey: unknown;
  readOnly: boolean;
  /** Changes when the search field should take the focus (and the selection's text). */
  focusRequest: { count: number; text: string };
  onReveal: (path: string, match: SearchMatch, query: SearchQuery) => void;
  onReplaceAll: (query: SearchQuery, replacement: string, result: SearchResult) => void;
}) {
  const { t } = useTranslation();
  const [pattern, setPattern] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [regex, setRegex] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [replacement, setReplacement] = useState("");
  const [refresh, setRefresh] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusRequest.count === 0) return;
    if (focusRequest.text !== "" && !focusRequest.text.includes("\n")) setPattern(focusRequest.text);
    // After the pane shows.
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.select();
    });
  }, [focusRequest]);

  // Typing settles before the book is searched.
  const [query, setQuery] = useState<SearchQuery>({ pattern: "", caseSensitive, wholeWord, regex });
  useEffect(() => {
    const next = { pattern, caseSensitive, wholeWord, regex };
    const timer = setTimeout(() => setQuery(next), pattern.length < 3 ? 250 : 120);
    return () => clearTimeout(timer);
  }, [pattern, caseSensitive, wholeWord, regex]);

  const outcome = useMemo((): { result: SearchResult } | { error: string } | null => {
    if (!texts.data || query.pattern === "") return null;
    try {
      return { result: searchFiles(searchedTexts(texts.data.files, openTexts()), query) };
    } catch (error) {
      if (error instanceof InvalidQueryError) return { error: error.message };
      throw error;
    }
  }, [texts.data, query, changeKey, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  const reveal = useRef(onReveal);
  reveal.current = onReveal;
  const queryRef = useRef(query);
  queryRef.current = query;
  const onRevealStable = useMemo(
    () => (path: string, match: SearchMatch) => reveal.current(path, match, queryRef.current),
    [],
  );

  const result = outcome && "result" in outcome ? outcome.result : null;
  const settled =
    query.pattern === pattern &&
    query.caseSensitive === caseSensitive &&
    query.wholeWord === wholeWord &&
    query.regex === regex;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-9 items-center border-b border-sidebar-border px-2 py-1.5 pointer-coarse:min-h-11">
        <h2 className="text-sm font-medium">{t("editor.search.title")}</h2>
      </div>
      <div className="flex flex-col gap-1.5 border-b border-sidebar-border p-2">
        <div className="flex items-center gap-1">
          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 pointer-coarse:size-8"
              aria-label={t("editor.search.toggleReplace")}
              title={t("editor.search.toggleReplace")}
              aria-expanded={showReplace}
              onClick={() => setShowReplace((v) => !v)}
            >
              {showReplace ? <ChevronDownIcon className="size-3.5" /> : <ChevronRightIcon className="size-3.5" />}
            </Button>
          )}
          <Input
            ref={input}
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setRefresh((n) => n + 1);
            }}
            placeholder={t("editor.search.placeholder")}
            aria-label={t("editor.search.placeholder")}
            aria-invalid={outcome !== null && "error" in outcome}
            className="h-7 min-w-0 flex-1 text-sm pointer-coarse:h-9"
          />
        </div>
        <div className="flex items-center gap-0.5">
          <Toggle label={t("editor.search.caseSensitive")} pressed={caseSensitive} onToggle={() => setCaseSensitive((v) => !v)}>
            <CaseSensitiveIcon className="size-4" />
          </Toggle>
          <Toggle label={t("editor.search.wholeWord")} pressed={wholeWord} onToggle={() => setWholeWord((v) => !v)}>
            <WholeWordIcon className="size-4" />
          </Toggle>
          <Toggle label={t("editor.search.regex")} pressed={regex} onToggle={() => setRegex((v) => !v)}>
            <RegexIcon className="size-4" />
          </Toggle>
          <span className="flex-1" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 pointer-coarse:size-8"
            aria-label={t("editor.search.refresh")}
            title={t("editor.search.refresh")}
            onClick={() => {
              setRefresh((n) => n + 1);
              void texts.refetch();
            }}
          >
            <RefreshCwIcon className={cn("size-3.5", texts.isFetching && "animate-spin")} />
          </Button>
        </div>
        {showReplace && !readOnly && (
          <div className="flex items-center gap-1">
            <Input
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder={t("editor.search.replacePlaceholder")}
              aria-label={t("editor.search.replacePlaceholder")}
              className="h-7 min-w-0 flex-1 text-sm pointer-coarse:h-9"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-7 shrink-0 pointer-coarse:size-9"
              aria-label={t("editor.search.replaceAll")}
              title={t("editor.search.replaceAll")}
              disabled={!settled || !result || result.total === 0}
              onClick={() => result && onReplaceAll(query, replacement, result)}
            >
              <ReplaceAllIcon className="size-4" />
            </Button>
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1" aria-live="polite">
        {texts.isPending && pattern !== "" && (
          <p className="p-2 text-sm text-muted-foreground">{t("editor.search.loading")}</p>
        )}
        {texts.isError && <p className="p-2 text-sm text-destructive">{t("editor.search.loadFailed")}</p>}
        {outcome && "error" in outcome && (
          <p className="p-2 text-sm text-destructive">{t("editor.search.invalid", { message: outcome.error })}</p>
        )}
        {result && (
          <>
            <p className="px-2 py-1 text-xs text-muted-foreground">
              {result.total === 0
                ? t("editor.search.noResults")
                : `${t("editor.search.results", { count: result.total })} ${t("editor.search.inFiles", { count: result.files.length })}`}
              {result.truncated && ` ${t("editor.search.truncated")}`}
            </p>
            <ul>
              {result.files.map((file) => (
                <FileGroup key={file.path} file={file} onReveal={onRevealStable} />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
