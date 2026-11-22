import { describe, expect, it } from "vitest";
import {
  PIPE_STANDIN as S,
  protectMultieventPipes,
} from "../src/multieventPipes";
import { ctx } from "./mock";
import { process } from "../src/process";

/** The multievent part of a rendered page, and only that. */
async function multieventHtml(markdown: string) {
  const result = await process(markdown, ctx);
  const html = String(result.value);
  return html.slice(
    html.indexOf('class="directive-multievent'),
    html.indexOf("</article>"),
  );
}

describe("protectMultieventPipes", () => {
  it("swaps pipes of a single-line marker inside a multievent", () => {
    const source = ":::multievent\n{a{cat|!dog}}\n:::\n";
    const protectedSource = protectMultieventPipes(source);
    expect(protectedSource).toBe(`:::multievent\n{a{cat${S}!dog}}\n:::\n`);
    // same length, so every position in the parsed tree is the source's
    expect(protectedSource).toHaveLength(source.length);
  });

  it("leaves markers outside a multievent alone", () => {
    expect(protectMultieventPipes("{a{cat|!dog}}\n")).toBe(
      "{a{cat|!dog}}\n",
    );
  });

  it("leaves pipes of another container alone", () => {
    expect(protectMultieventPipes(":::alert\n{a{cat|!dog}}\n:::\n")).toBe(
      ":::alert\n{a{cat|!dog}}\n:::\n",
    );
  });

  it("keeps grid pipes of a multi-line word search", () => {
    const source = [
      ":::multievent",
      "{w{",
      "a|M|p|b~~",
      "H|A|H|N~~",
      "E|S|E|L}}",
      ":::",
    ].join("\n");
    expect(protectMultieventPipes(source)).toBe(source);
  });

  it("keeps grid pipes of a multi-line crossword after the opening line", () => {
    const source = [
      ":::multievent",
      "{W{ | | |1| ~~",
      "2|D|U|C|K~~",
      " | | |A| }}",
      ":::",
    ].join("\n");
    expect(protectMultieventPipes(source)).toBe(source);
  });

  it("swaps a marker that closes after a grid has opened and closed", () => {
    const source = [
      ":::multievent",
      "{W{ |1| ~~",
      " |D| }}",
      "Pick {a{cat|!dog}}.",
      ":::",
    ].join("\n");
    expect(protectMultieventPipes(source)).toBe(
      [
        ":::multievent",
        "{W{ |1| ~~",
        " |D| }}",
        `Pick {a{cat${S}!dog}}.`,
        ":::",
      ].join("\n"),
    );
  });

  it("leaves an already escaped pipe alone", () => {
    expect(
      protectMultieventPipes(":::multievent\n{a{cat\\|!dog}}\n:::\n"),
    ).toBe(":::multievent\n{a{cat\\|!dog}}\n:::\n");
  });

  it("closes a marker at its own braces", () => {
    expect(
      protectMultieventPipes(":::multievent\n{m{\\frac{a}{b}}|x}}\n:::\n"),
    ).toBe(`:::multievent\n{m{\\frac{a}{b}}${S}x}}\n:::\n`);
  });

  it("swaps pipes in a multievent with more colons, or nested in one", () => {
    expect(
      protectMultieventPipes("::::multievent\n{a{x|y}}\n::::\n"),
    ).toBe(`::::multievent\n{a{x${S}y}}\n::::\n`);
    expect(
      protectMultieventPipes(
        ":::multievent\n::::alert\n{a{x|y}}\n::::\n:::\n",
      ),
    ).toBe(`:::multievent\n::::alert\n{a{x${S}y}}\n::::\n:::\n`);
  });

  it("leaves fenced code inside a multievent alone", () => {
    const source = [":::multievent", "```", "{a{cat|!dog}}", "```", ":::"].join(
      "\n",
    );
    expect(protectMultieventPipes(source)).toBe(source);
  });

  it("leaves escaped braces like \\{x\\{ alone", () => {
    expect(
      protectMultieventPipes(":::multievent\n$\\{x\\}${|A|B}\n:::\n"),
    ).toBe(":::multievent\n$\\{x\\}${|A|B}\n:::\n");
  });
});

describe("multievent inside markdown tables", () => {
  it("keeps a dropdown marker in one cell", async () => {
    const html = await multieventHtml(
      [
        ":::multievent",
        "| Frage | Auswahl |",
        "| --- | --- |",
        "| Tier | {a{Hund|!Katze|Maus}} |",
        ":::",
      ].join("\n"),
    );
    // the dropdown lives in one cell: Hund, Katze (marked correct) and Maus
    expect(html).toMatch(
      /<td>[\s\S]*?multiEvSel[\s\S]*?Hund[\s\S]*?value="1">Katze[\s\S]*?Maus[\s\S]*?<\/td>/,
    );
  });

  it("keeps a multi-answer number field in one cell", async () => {
    const html = await multieventHtml(
      [
        ":::multievent",
        "| Aufgabe | Antwort |",
        "| --- | --- |",
        "| Zahl | {z{1|3|5}} |",
        ":::",
      ].join("\n"),
    );
    expect(html).toMatch(/<td>[\s\S]*?data-Wert="1|3|5"[\s\S]*?<\/td>/);
  });

  it("renders a marker outside a table like the escape-free source", async () => {
    const html = await multieventHtml(
      ":::multievent\nAnswer: {z{1|3|5}}\n:::\n",
    );
    // compiled, with all alternatives kept, and no escape reaching the page
    expect(html).toContain('data-Wert="1|3|5"');
    expect(html).not.toContain("\\\\|");
  });

  it("keeps a multi-line word search working in a table page", async () => {
    const html = await multieventHtml(
      [
        ":::multievent",
        "| Frage | Unterrichtsstoff |",
        "| --- | --- |",
        "| Suchsel | {w{ |",
        "",
        "a|M|p|b~~",
        "H|A|H|N~~",
        "E|S|E|L}} |",
        ":::",
      ].join("\n"),
    );
    // The grid survives as text for multievent.js to turn into its own table.
    expect(html).toContain("a|M|p|b");
  });
});

describe("positions of a page with protected pipes", () => {
  it("are the positions of the page's own source", async () => {
    const source =
      ":::multievent\n{a{a|b|!c|d}}\n:::\n\n:::multievent\n{t{x}}\n:::\n";
    const result = await process(source, ctx);
    const ids = result.data.resolvedDirectiveIds!;
    expect(source.slice(ids[1].start, ids[1].end)).toBe(
      ":::multievent\n{t{x}}\n:::",
    );
  });
});
