import type { Renderers } from "./renders";

/*
 * "Check all pages": every page of a book's newest save rendered once by the
 * preview's renderer, so a broken page shows up before publishing instead of
 * only when someone visits it (or the publish build fails on it). One check
 * per book at a time, kept in memory: it is a hint for the teacher, not a
 * record, and a restart simply forgets it.
 */

export type CheckProblem = { file: string; error: string };

export type CheckState = {
  /** The commit being (or that was) checked; null until the renderer started. */
  commit: string | null;
  status: "running" | "done" | "changed" | "failed";
  done: number;
  total: number;
  problems: CheckProblem[];
  /** Why the check itself could not run (status "failed"). */
  error: string | null;
  startedAt: number;
  finishedAt: number | null;
};

/** Problems kept per check; a book that broke everywhere needs no more. */
const MAX_PROBLEMS = 200;

export class BookChecks {
  private checks = new Map<number, CheckState>();
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
      error: null,
      startedAt: Date.now(),
      finishedAt: null,
    };
    this.checks.set(bookId, state);
    const abort = new AbortController();
    this.aborts.set(bookId, abort);
    void this.renders
      .checkPages(
        bookId,
        ({ done, total, commit }, problem) => {
          state.commit = commit;
          state.done = done;
          state.total = total;
          if (problem && state.problems.length < MAX_PROBLEMS) state.problems.push(problem);
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
  }

  stopAll() {
    for (const abort of this.aborts.values()) abort.abort();
  }
}
