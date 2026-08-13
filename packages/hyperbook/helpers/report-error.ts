import chalk from "chalk";

/**
 * Prints a build failure.
 *
 * Errors raised from the markdown pipeline are VFileMessages, whose default
 * console rendering is a large object dump that buries the actual reason. When
 * one of those comes through, show the file, the position and the reason
 * instead.
 */
export function reportError(e: unknown): void {
  const message = e as {
    reason?: string;
    file?: string;
    line?: number | null;
    column?: number | null;
  };

  if (message && typeof message.reason === "string") {
    const where = [message.file, message.line, message.column]
      .filter((part) => part !== undefined && part !== null)
      .join(":");
    if (where) {
      console.error(`${chalk.red("error")} ${where}`);
    } else {
      console.error(chalk.red("error"));
    }
    console.error(message.reason);
    return;
  }

  console.error(e);
}
