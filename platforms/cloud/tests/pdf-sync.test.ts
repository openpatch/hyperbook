import { describe, expect, it } from "vitest";
import { findInPdf, findInSource } from "../src/web/pages/editor/pdf-sync";

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

describe("findInSource with hyphenation", () => {
  it("joins a word the PDF broke at the end of the clicked line", () => {
    const source = "Energy is conserved in every closed system.\n";
    expect(
      findInSource(source, { line: "Energy is con-", wordIndex: 2, after: "served in every closed system." }),
    ).toBe(source.indexOf("conserved"));
  });
});

describe("findInPdf", () => {
  const SOURCE = `#set page(paper: "a5")

= Optics

Light travels in *straight* lines,
until it meets a #emph[lens] or a mirror.

= Waves

Refraction bends light at a boundary.
Light travels in waves, too.
`;
  const PAGES = [
    ["Optics", "Light travels in straight lines, until it meets a", "lens or a mirror."],
    ["Waves", "Refraction bends light at a boundary. Light travels", "in waves, too."],
  ];
  const at = (text: string, n = 0) => {
    let i = -1;
    for (let k = 0; k <= n; k++) i = SOURCE.indexOf(text, i + 1);
    return i;
  };

  it("finds the line that shows the text at the cursor", () => {
    expect(findInPdf(SOURCE, at("straight") + 2, PAGES)).toEqual({ page: 0, line: 1 });
    expect(findInPdf(SOURCE, at("mirror"), PAGES)).toEqual({ page: 0, line: 2 });
    expect(findInPdf(SOURCE, at("lens"), PAGES)).toEqual({ page: 0, line: 2 });
    expect(findInPdf(SOURCE, at("Refraction"), PAGES)).toEqual({ page: 1, line: 1 });
  });

  it("finds headings, though they are a single word", () => {
    expect(findInPdf(SOURCE, at("Optics"), PAGES)).toEqual({ page: 0, line: 0 });
    expect(findInPdf(SOURCE, at("Waves"), PAGES)).toEqual({ page: 1, line: 0 });
  });

  it("tells a repeated phrase apart by the words around it", () => {
    // "Light travels in" occurs twice; the second is followed by "waves".
    expect(findInPdf(SOURCE, at("Light travels", 1), PAGES)).toEqual({ page: 1, line: 1 });
    expect(findInPdf(SOURCE, at("waves"), PAGES)).toEqual({ page: 1, line: 2 });
  });

  it("follows a word hyphenated across lines", () => {
    const source = "Energy is always conserved in every closed system.\n";
    const pages = [["Energy is always con-", "served in every closed system."]];
    expect(findInPdf(source, source.indexOf("conserved") + 5, pages)).toEqual({ page: 0, line: 0 });
    expect(findInPdf(source, source.indexOf("closed"), pages)).toEqual({ page: 0, line: 1 });
  });

  it("gives up on text that is not in the PDF", () => {
    expect(findInPdf("Hello world.\n", 2, [["Something else entirely"]])).toBeNull();
    expect(findInPdf("Hello world.\n", 2, [])).toBeNull();
  });
});
