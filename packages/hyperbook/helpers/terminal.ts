import readline from "readline";

/**
 * In-place progress counters, and the line bookkeeping they need.
 *
 * Progress is drawn by rewriting one line, so the cursor is left mid-line
 * between ticks. Anything else that prints in the meantime — a diagnostic from
 * the page currently being built — would otherwise land on the end of that
 * line, producing output like:
 *
 *     [My Book] Building book: [1/7]info /path/to/page.md:3:1
 *
 * `breakProgressLine` closes the pending line first, and is a no-op when
 * nothing is pending, so no stray blank lines appear either.
 *
 * Under CI there is no cursor to rewind, so each tick gets its own line and
 * nothing is ever left pending.
 */

/** True while the cursor sits at the end of an unterminated progress line. */
let pending = false;

/** Draws one progress tick, replacing the previous one. */
export function writeProgress(text: string): void {
  if (process.env.CI) {
    process.stdout.write(`${text}\n`);
    return;
  }

  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);
  process.stdout.write(text);
  pending = true;
}

/** Terminates a pending progress line. Safe to call when none is pending. */
export function breakProgressLine(): void {
  if (!pending) return;
  process.stdout.write("\n");
  pending = false;
}

/**
 * Ends a progress run, leaving the cursor on a fresh line.
 *
 * Unlike {@link breakProgressLine} this always emits the newline, matching the
 * blank-line spacing the build used before progress was centralized here.
 */
export function endProgress(): void {
  process.stdout.write("\n");
  pending = false;
}
