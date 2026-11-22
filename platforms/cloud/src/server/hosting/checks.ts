import type { IndexedElement } from "../domain/overview";
import type { PageDiagnostic } from "../../shared/page-diagnostics";
import type { Renderers } from "./renders";

/*
 * "Check all pages": every page of a book's newest save rendered once by the
 * preview's renderer, so a broken page shows up before publishing instead of
 * only when someone visits it (or the publish build fails on it). One check
 * per book at a time, kept in memory: it is a hint for the teacher, not a
 * record, and a restart simply forgets it. Each page also says what
 * `hyperbook lint` finds on it (broken links, missing files, elements written
 * wrong), and the book as a whole at the end.
 */

export type CheckProblem = { file: string; error: string };

export type CheckState = {
  /** The commit being (or that was) checked; null until the renderer started. */
  commit: string | null;
  status: "running" | "done" | "changed" | "failed";
  done: number;
  total: number;
  problems: CheckProblem[];
  /** What lint found, errors first (at most MAX_FINDINGS; `counts` counts them all). */
  findings: PageDiagnostic[];
  counts: { error: number; warning: number; info: number };
  /** Why the check itself could not run (status "failed"). */
  error: string | null;
  startedAt: number;
  finishedAt: number | null;
};

/** Problems kept per check; a book that broke everywhere needs no more. */
const MAX_PROBLEMS = 200;
/** Findings kept per check: enough to work through, small enough to poll. */
const MAX_FINDINGS = 500;

const RANK = { error: 0, warning: 1, info: 2 } as const;

/** Errors first, then by file and line. */
function byWeight(a: PageDiagnostic, b: PageDiagnostic) {
  return RANK[a.severity] - RANK[b.severity] || a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0);
}

/** A page of the checked save and the tasks on it that keep a reader's work. */
export type CheckedPage = { href: string; title: string; elements: IndexedElement[] };

export class BookChecks {
  private checks = new Map<number, CheckState>();
  /**
   * The tasks of each book's checked save, kept apart from the state: the
   * state is polled while a check runs, and a big book has over a thousand.
   */
  private pages = new Map<number, CheckedPage[]>();
  private aborts = new Map<number, AbortController>();

  constructor(private readonly renders: Renderers) {}

  get(bookId: number): CheckState | null {
    return this.checks.get(bookId) ?? null;
  }

  /** Starts a check of the newest save, unless one is running already. */
  start(bookId: number): CheckState {
    const running = this.checks.get(bookId);
    if (running?.status === "running") return running;
    const state: CheckState = {
      commit: null,
      status: "running",
      done: 0,
      total: 0,
      problems: [],
      findings: [],
      counts: { error: 0, warning: 0, info: 0 },
      error: null,
      startedAt: Date.now(),
      finishedAt: null,
    };
    this.checks.set(bookId, state);
    const pages: CheckedPage[] = [];
    this.pages.set(bookId, pages);
    const abort = new AbortController();
    this.aborts.set(bookId, abort);
    void this.renders
      .checkPages(
        bookId,
        ({ progress, problem, page, diagnostics }) => {
          state.commit = progress.commit;
          state.done = progress.done;
          state.total = progress.total;
          if (problem && state.problems.length < MAX_PROBLEMS) state.problems.push(problem);
          if (page) pages.push(page);
          for (const d of diagnostics ?? []) {
            state.counts[d.severity]++;
            // Keep the weightiest: an error found late pushes out an info.
            if (state.findings.length < MAX_FINDINGS) state.findings.push(d);
            else if (byWeight(d, state.findings[state.findings.length - 1]!) < 0) {
              state.findings[state.findings.length - 1] = d;
            } else continue;
            state.findings.sort(byWeight);
          }
        },
        abort.signal,
      )
      .then(
        (outcome) => {
          state.status = outcome === "done" ? "done" : "changed";
        },
        (error: unknown) => {
          state.status = "failed";
          state.error = error instanceof Error ? error.message : String(error);
        },
      )
      .finally(() => {
        state.finishedAt = Date.now();
        if (this.aborts.get(bookId) === abort) this.aborts.delete(bookId);
      });
    return state;
  }

  /** The tasks of the book's checked save, once its check is done. */
  checkedPages(bookId: number): CheckedPage[] | null {
    return this.checks.get(bookId)?.status === "done" ? (this.pages.get(bookId) ?? null) : null;
  }

  /** Resolves once the book's check (if any) has finished; for tests. */
  async settled(bookId: number): Promise<CheckState | null> {
    while (this.checks.get(bookId)?.status === "running") {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    return this.get(bookId);
  }

  /** Forgets a book (deleted) and stops its check. */
  forget(bookId: number) {
    this.aborts.get(bookId)?.abort();
    this.aborts.delete(bookId);
    this.checks.delete(bookId);
    this.pages.delete(bookId);
  }

  stopAll() {
    for (const abort of this.aborts.values()) abort.abort();
  }
}
