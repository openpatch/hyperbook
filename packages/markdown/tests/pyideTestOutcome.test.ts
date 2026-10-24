import { describe, expect, it } from "vitest";
// @ts-ignore: a client module without types
import {
  assertionDetail,
  testOutcome,
} from "../assets/directive-pyide/src/test-outcome.js";

describe("testOutcome", () => {
  it("passes a test that runs and prints no failure", () => {
    expect(testOutcome({ text: "" })).toBe("passed");
    expect(testOutcome({ text: "Pass\n" })).toBe("passed");
    expect(testOutcome({ text: "Bestanden: Das Maximum ist 100\n" })).toBe(
      "passed",
    );
  });

  it("fails a test that prints a failure at the start of a line", () => {
    expect(testOutcome({ text: "Fail\n" })).toBe("failed");
    expect(testOutcome({ text: "checking\nfailed: 3 != 4\n" })).toBe("failed");
    expect(
      testOutcome({ text: "Nicht bestanden: erwartet 100, erhalten 40\n" }),
    ).toBe("failed");
    expect(testOutcome({ text: "Falsch\n" })).toBe("failed");
  });

  it("does not read failure into other words", () => {
    expect(testOutcome({ text: "Failure is not an option\n" })).toBe("passed");
    expect(testOutcome({ text: "No fail here\n" })).toBe("passed");
  });

  it("fails on an AssertionError and calls other exceptions errors", () => {
    expect(
      testOutcome({
        error:
          'Traceback (most recent call last):\n  File "main.py", line 3, in <module>\nAssertionError: maximum([1, 2]) should be 2',
      }),
    ).toBe("failed");
    expect(testOutcome({ error: "AssertionError" })).toBe("failed");
    expect(
      testOutcome({
        error:
          'Traceback (most recent call last):\n  File "main.py", line 2, in maximum\nIndexError: list index out of range',
      }),
    ).toBe("error");
  });
});

describe("assertionDetail", () => {
  const code = "def maximum(v):\n    return v[0]\nassert maximum([1, 2]) == 2, 'should be 2'\n";

  it("finds the assert of the test and its message", () => {
    expect(
      assertionDetail(
        'Traceback (most recent call last):\n  File "<exec>", line 3, in <module>\nAssertionError: should be 2',
        code,
      ),
    ).toEqual({
      statement: "assert maximum([1, 2]) == 2, 'should be 2'",
      message: "should be 2",
    });
  });

  it("has no message for a bare assert", () => {
    expect(
      assertionDetail(
        'Traceback (most recent call last):\n  File "<exec>", line 3, in <module>\nAssertionError',
        code,
      ).message,
    ).toBe("");
  });

  it("ignores lines of other files", () => {
    expect(
      assertionDetail(
        'Traceback (most recent call last):\n  File "<exec>", line 3, in <module>\n  File "/home/pyodide/helper.py", line 1, in check\nAssertionError',
        code,
      ).statement,
    ).toBe("assert maximum([1, 2]) == 2, 'should be 2'");
  });
});
