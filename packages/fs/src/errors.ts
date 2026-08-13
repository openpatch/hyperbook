/**
 * An error caused by how a project is set up rather than by a bug.
 *
 * The CLI renders anything carrying a `reason` as a plain message instead of a
 * stack trace, so a misplaced working directory or a malformed config reads as
 * instructions rather than as a crash. Genuine faults keep their stack.
 */
export class UserError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = "UserError";
    this.reason = reason;
  }
}
