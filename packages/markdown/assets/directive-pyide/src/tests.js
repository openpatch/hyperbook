import { executeScript } from "./execution.js";
import { appendFriendlyError, appendOutput, setOutputTarget } from "./output.js";
import { assertionDetail, testOutcome } from "./test-outcome.js";

const t = (key, values) => hyperbook.i18n.get(key, values);

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** A failed assert: its statement, and its message below. */
const appendAssertion = (body, { statement, message }) => {
  const box = el("div", "pyide-test-assert");
  if (statement) box.appendChild(el("code", "pyide-test-assert-statement", statement));
  if (message) box.appendChild(el("div", "pyide-test-assert-message", message));
  if (!statement && !message) box.textContent = "AssertionError";
  body.appendChild(box);
};

/**
 * The report of a test run, in place of the output: a summary with a bar of
 * one segment per test, and a row per test with its status and what it
 * printed.
 */
const mountReport = (output, tests) => {
  const report = el("div", "pyide-tests");
  const summary = el("div", "pyide-tests-summary");
  summary.setAttribute("role", "status");
  const title = el("span", "pyide-tests-title");
  summary.append(title);

  const bar = el("div", "pyide-tests-bar");
  bar.setAttribute("aria-hidden", "true");
  const list = el("ol", "pyide-tests-list");

  const rows = tests.map((test) => {
    const segment = el("span", "pyide-tests-segment");
    bar.appendChild(segment);

    const row = el("li", "pyide-test");
    const head = el("div", "pyide-test-head");
    const icon = el("span", "pyide-test-icon");
    icon.setAttribute("aria-hidden", "true");
    const name = el("span", "pyide-test-name", test.path);
    const status = el("span", "pyide-test-status");
    head.append(icon, name, status);
    const body = el("div", "pyide-test-output");
    row.append(head, body);
    list.appendChild(row);

    const set = (value) => {
      row.dataset.status = value;
      segment.dataset.status = value;
      status.textContent = t(`pyide-test-${value}`);
      body.hidden = !body.hasChildNodes();
    };
    set("pending");
    return { row, body, set };
  });

  report.append(summary, bar, list);
  output.replaceChildren(report);

  return {
    rows,
    /** @param {number} current The test running, from 1. */
    running(current) {
      report.dataset.status = "running";
      title.textContent = t("pyide-tests-running", {
        current: `${current}`,
        total: `${tests.length}`,
      });
    },
    /** @param {string[]} outcomes */
    done(outcomes) {
      const passed = outcomes.filter((o) => o === "passed").length;
      const all = passed === tests.length;
      report.dataset.status = all ? "passed" : "failed";
      title.textContent = all
        ? t("pyide-tests-all-passed", { total: `${tests.length}` })
        : t("pyide-tests-some-passed", {
            passed: `${passed}`,
            total: `${tests.length}`,
          });
    },
  };
};

/**
 * Runs every test file, one after the other, each as one program: the
 * reader's script is pasted in where the test says #SCRIPT#.
 *
 * @param {{
 *   id: string,
 *   output: HTMLElement,
 *   tests: { path: string, content?: string }[],
 *   script: string,
 *   files: object[],
 *   packages: string[],
 *   state: { stopRequested: boolean },
 * }} options
 */
export const runTests = async ({
  id,
  output,
  tests,
  script,
  files,
  packages,
  state,
}) => {
  const report = mountReport(output, tests);
  const outcomes = [];
  try {
    for (const [index, test] of tests.entries()) {
      const row = report.rows[index];
      if (state.stopRequested) break;
      report.running(index + 1);
      row.set("running");
      row.body.hidden = false;

      const testCode = (test.content ?? "").replace("#SCRIPT#", script);
      // What the test prints goes to its own row.
      setOutputTarget(id, row.body);
      let run;
      try {
        run = await executeScript(id, testCode, { files }, packages);
      } finally {
        setOutputTarget(id, null);
      }
      if (state.stopRequested) break;

      const { results, error } = run;
      if (results !== undefined && results !== null) {
        appendOutput(row.body, results);
      }
      const outcome = testOutcome({ error, text: row.body.textContent });
      if (error && outcome === "failed") {
        appendAssertion(row.body, assertionDetail(error, testCode));
      } else if (error) {
        appendFriendlyError(row.body, error, testCode);
      }
      outcomes.push(outcome);
      row.set(outcome);
    }
  } finally {
    for (const row of report.rows.slice(outcomes.length)) row.set("stopped");
    report.done(outcomes);
  }
};
