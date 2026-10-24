/**
 * A line a test prints to say it failed: "Fail", "Failed", "Nicht bestanden"
 * or "Falsch", in any case, at the start of the line. Books print these as
 * "Fail" / "Pass" or "Nicht bestanden: …" / "Bestanden: …".
 */
const FAIL_LINE = /^\s*(?:fail(?:ed)?|nicht bestanden|falsch)\b/im;

/**
 * How a test went.
 *
 * @param {{ error?: string, text?: string }} run What the test raised (the
 *   message of a Python exception) and what it printed.
 * @returns {"passed" | "failed" | "error"} An AssertionError or a printed
 *   failure is a failed test; any other exception is an error in the code.
 */
export const testOutcome = ({ error, text = "" }) => {
  if (error) {
    const last = String(error).trim().split("\n").pop() || "";
    return /^AssertionError\b/.test(last.trim()) ? "failed" : "error";
  }
  return FAIL_LINE.test(text) ? "failed" : "passed";
};

/**
 * What a failed assert says: the assert statement of the test, found by the
 * test's last line in the traceback, and its message, if it has one. A
 * traceback into a test the reader cannot see says less than this.
 *
 * @param {string} error The message of the AssertionError, with traceback.
 * @param {string} code The test, as it ran.
 * @returns {{ statement: string, message: string }}
 */
export const assertionDetail = (error, code) => {
  const text = String(error);
  // The test is the first frame; an assert in a module it imports is not
  // one of its lines.
  const frames = [...text.matchAll(/File "([^"]+)", line (\d+)/g)];
  const own = frames.filter(([, file]) => file === frames[0]?.[1]);
  const number = own.length > 0 ? Number(own[own.length - 1][2]) : 0;
  const statement = number > 0 ? (code.split("\n")[number - 1] ?? "").trim() : "";
  const last = text.trim().split("\n").pop() || "";
  const message = last.replace(/^\s*AssertionError:?\s*/, "").trim();
  return { statement, message };
};
