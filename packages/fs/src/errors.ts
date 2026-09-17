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

/**
 * Frontmatter that exists but is not valid YAML.
 *
 * gray-matter rethrows the YAML parser's exception untouched, so the author
 * used to get a bare "incomplete explicit mapping pair" with no hint at which
 * of a few hundred pages it came from. Carries the same `file`/`line`/`column`
 * shape as {@link JsonParseError} so the CLI and the dev overlay can point at
 * the offending line.
 */
export class FrontmatterParseError extends UserError {
  readonly file: string;
  readonly line?: number;
  readonly column?: number;

  constructor(
    file: string,
    reason: string,
    position?: { line: number; column: number },
  ) {
    super(reason);
    const where = position
      ? `${file}:${position.line}:${position.column}`
      : file;
    this.message = `${where}\n${reason}`;
    this.name = "FrontmatterParseError";
    this.file = file;
    this.line = position?.line;
    this.column = position?.column;
  }
}
