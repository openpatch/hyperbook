import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  breakProgressLine,
  endProgress,
  writeProgress,
} from "../helpers/terminal";

/** Captures everything written to stdout during a test. */
let written: string[];
let restoreCI: string | undefined;

beforeEach(() => {
  written = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: any) => {
    written.push(String(chunk));
    return true;
  });
  restoreCI = process.env.CI;
});

afterEach(() => {
  // Drain any pending line while stdout is still captured, so the module's
  // state does not leak into the next test and the newline does not leak into
  // the test runner's own output.
  endProgress();
  vi.restoreAllMocks();
  if (restoreCI === undefined) delete process.env.CI;
  else process.env.CI = restoreCI;
});

describe("progress line bookkeeping (interactive)", () => {
  beforeEach(() => {
    delete process.env.CI;
    // Clear any state carried over from a previous test.
    endProgress();
    written = [];
  });

  it("closes a pending progress line before other output", () => {
    writeProgress("Building book: [1/7]");
    breakProgressLine();

    // The newline is what stops a diagnostic landing on the progress line.
    expect(written.join("")).toContain("Building book: [1/7]");
    expect(written.join("").endsWith("\n")).toBe(true);
  });

  it("is a no-op when no progress line is pending", () => {
    breakProgressLine();
    expect(written.join("")).toBe("");
  });

  it("does not emit a second newline for repeated breaks", () => {
    writeProgress("Copying emojis: [3/9]");
    breakProgressLine();
    const afterFirst = written.join("");

    breakProgressLine();
    breakProgressLine();

    expect(written.join("")).toBe(afterFirst);
  });

  it("clears the pending state so a later break stays a no-op", () => {
    writeProgress("Building book: [1/7]");
    endProgress();
    written = [];

    breakProgressLine();
    expect(written.join("")).toBe("");
  });
});

describe("progress line bookkeeping (CI)", () => {
  beforeEach(() => {
    process.env.CI = "true";
    endProgress();
    written = [];
  });

  it("gives every tick its own line", () => {
    writeProgress("Building book: [1/7]");
    expect(written.join("")).toBe("Building book: [1/7]\n");
  });

  it("never leaves a line pending, so breaks add nothing", () => {
    writeProgress("Building book: [1/7]");
    written = [];

    breakProgressLine();
    expect(written.join("")).toBe("");
  });
});
