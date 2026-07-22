import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const css = fs
  .readFileSync(path.join(__dirname, "..", "assets", "shell.css"), "utf8")
  // Comments sit between rules and would otherwise be read as part of the
  // following selector.
  .replace(/\/\*[\s\S]*?\*\//g, "");

/** Selectors of every rule in the stylesheet. */
const selectors = [...css.matchAll(/([^{}]+)\{[^{}]*\}/g)]
  .map((m) => m[1].trim())
  .filter((s) => !s.startsWith("@"))
  .flatMap((s) => s.split(",").map((part) => part.trim()))
  .filter(Boolean);

/**
 * Navigation sections nest, so any rule that styles a section by its *kind*
 * has to be scoped to that section's own summary with a child combinator. A
 * descendant selector leaks into subsections: a subsection with content sitting
 * inside an empty section was rendered in italics as though it had no page.
 */
describe("shell.css navigation sections", () => {
  const kindSelectors = selectors.filter(
    (s) => s.includes(".section.empty") || s.includes(".section:not(.empty)"),
  );

  it("has rules that distinguish the two kinds of section", () => {
    expect(kindSelectors.length).toBeGreaterThan(0);
  });

  it("scopes every one of them to the section's own summary", () => {
    for (const selector of kindSelectors) {
      // Everything after the `.section...` part must be reached with `>`.
      const tail = selector.replace(
        /^.*\.section(?::not\(\.empty\)|\.empty)/,
        "",
      );
      expect(
        tail.includes(" ") === false || /^\s*>/.test(tail),
        `"${selector}" uses a descendant combinator, so it also styles subsections`,
      ).toBe(true);
      expect(tail.replace(/\s+/g, "")).toMatch(/^>summary(\.name)?>/);
    }
  });

  it("keeps the active highlight on the details element", () => {
    // `active` moved from the <summary> to the <details>; a rule looking for
    // `.name.active` silently stops matching and the current section loses its
    // highlight entirely.
    const stale = selectors.filter(
      (s) => /\.name\.active/.test(s) || /\.name\.empty/.test(s),
    );
    expect(stale).toEqual([]);
  });
});
