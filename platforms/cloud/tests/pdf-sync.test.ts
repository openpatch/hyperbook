import { describe, expect, it } from "vitest";
import { findInSource } from "../src/web/pages/editor/pdf-sync";

const SOURCE = `= Optics

Light travels in *straight* lines,
until it meets a #emph[lens] or a mirror.

Refraction bends light at a boundary.
`;

/** The offset of the `nth` occurrence of `text`. */
const nth = (source: string, text: string, n: number) => {
  let at = -1;
  for (let i = 0; i <= n; i++) at = source.indexOf(text, at + 1);
  return at;
};

describe("findInSource", () => {
  it("finds a PDF line in the source, at the clicked word", () => {
    expect(findInSource(SOURCE, { line: "Light travels in straight lines,", wordIndex: 3 })).toBe(
      SOURCE.indexOf("straight"),
    );
    // #emph is markup, not text of the PDF.
    expect(findInSource(SOURCE, { line: "until it meets a lens or a mirror.", wordIndex: 4 })).toBe(
      SOURCE.indexOf("lens"),
    );
    expect(findInSource(SOURCE, { line: "Optics", wordIndex: 0 })).toBe(SOURCE.indexOf("Optics"));
  });

  it("takes the words in a row, not the first line that has them all", () => {
    const source = "Die Kraft ist hier und die Masse ist dort.\n\nDie Masse ist träge.\n";
    expect(findInSource(source, { line: "Die Masse ist träge.", wordIndex: 3 })).toBe(source.indexOf("träge"));
    expect(findInSource(source, { line: "Die Masse ist träge.", wordIndex: 1 })).toBe(nth(source, "Masse", 1));
  });

  it("goes to the clicked one of a word that occurs twice in the line", () => {
    const source = "Licht ist Licht, und Schatten ist Schatten.\n";
    expect(findInSource(source, { line: "Licht ist Licht, und Schatten ist Schatten.", wordIndex: 2 })).toBe(
      nth(source, "Licht", 1),
    );
  });

  it("tells repeated lines apart by the lines around them, then by the position", () => {
    const source = "= Aufgabe\n\nRechne.\n\n= Lösung\n\nRechne.\n\n= Aufgabe\n\nZeichne.\n";
    // Two lines say "Rechne."; the one under "Lösung" is meant.
    expect(findInSource(source, { line: "Rechne.", wordIndex: 0, before: "Lösung", after: "" })).toBe(
      nth(source, "Rechne", 1),
    );
    // Without neighbours: the one nearest the click's place in the document.
    const repeated = "Ja Nein\n".repeat(10);
    expect(findInSource(repeated, { line: "Ja Nein", wordIndex: 0, fraction: 0.75 })).toBe(nth(repeated, "Ja", 7));
  });

  it("follows a PDF line across source lines and hyphenation, and gives up on unknown text", () => {
    const source = "A long sentence that\nwraps in the source and is conserved here.\n";
    expect(findInSource(source, { line: "sentence that wraps in the", wordIndex: 2 })).toBe(source.indexOf("wraps"));
    expect(findInSource(source, { line: "and is conser- vation", wordIndex: 1 })).toBe(source.indexOf("is conserved"));
    expect(findInSource(source, { line: "Something else entirely", wordIndex: 0 })).toBeNull();
    expect(findInSource(source, { line: "  ", wordIndex: -1 })).toBeNull();
  });
});
