import { describe, expect, it } from "vitest";
import { ctx } from "./mock";
import { process } from "../src/process";

/** The multievent div of a rendered page. */
async function render(markdown: string) {
  const result = await process(markdown, ctx);
  const html = String(result.value);
  const start = html.indexOf('class="directive-multievent');
  return start === -1 ? html : html.slice(start, html.indexOf("</article>"));
}

describe("the multievent compiler", () => {
  it("leaves pages without multievents alone", async () => {
    const html = await render("A {r1{plain}} page.\n");
    expect(html).toContain("{r1{plain}}");
  });

  it("compiles the examples of the element's documentation page", async () => {
    const html = await render(
      [
        ":::multievent",
        "Click: {r1{Leopard}} {r1{!Cheetah}} {R1{!Blue Whale}}",
        "Check: {c{!Gazelle}} {c{Mouse}} {C{!Trout}} {C{Herring}}",
        "Buttons: {k{Cuckoo}} {k{!Donkey}} {K{Fish}}",
        "Picks: {a{Duck|Tit|!Swallow|Pigeon}} {A{|Andean Condor|!Wandering Albatross}}",
        "Cloze: The {S1{Cuckoo}} and the {S1{Donkey}}",
        "Words: {l{Ducklings}} {L{Bug}} {t{Donkey}} {T{Goose}}",
        "Numbers: {z{16}} {z{1|3|5}}",
        "Variants: {X{4|2|3}} cows, {Z{22|18}} legs, {y{Cat|Cow}}, {Y{Bee}}",
        "Notes: {n{200|22|Notes}}",
        "Help: {b{Help 1}} {B{Help 2}}",
        "Hints: {h{wrong}} {H{right}}",
        "Math: {c{!$\\sqrt{2}$}} {c{$\\pi$}}",
        ":::",
      ].join("\n"),
    );

    expect(html).toContain(
      '<input type="radio" class="MERadio" value="0" data-name="radio" data-gruppe="1"><label class="MeRaLabel">Leopard</label>',
    );
    expect(html).toContain('value="1" data-name="Radio"');
    expect(html).toContain(
      '<input type="checkbox" class="MECheckbox" value="1" data-name="checkboxc" data-gruppe=""><label class="MeChLabel">Gazelle</label>',
    );
    expect(html).toContain(
      'data-name="checkboxC" data-gruppe=""><span></span>',
    );
    expect(html).toContain(
      'data-gruppe="a" data-typ="0" data-wertIst="Cuckoo"',
    );
    expect(html).toContain('data-gruppe="b" data-typ="1" data-wertIst="Fish"');
    expect(html).toContain(
      '<option value="0">Duck</option><option value="0">Tit</option><option value="1">Swallow</option><option value="0">Pigeon</option>',
    );
    expect(html).toMatch(
      /<option value="0"><\/option><option value="0">Andean Condor<\/option><option value="1">Wandering Albatross<\/option>/,
    );
    expect(html).toContain('data-wertIst="Cuckoo" data-gruppe="1"');
    expect(html).toContain('data-Wert="Ducklings" data-style="loesungklein"');
    expect(html).toContain('data-style="loesunggross"');
    expect(html).toContain('data-Wert="Donkey" data-style="klein"');
    expect(html).toContain('data-Wert="Goose" data-style="gross"');
    expect(html).toContain('data-Wert="1|3|5" data-style="zahl"');
    expect(html).toContain('class="multiEvSpanY" data-wk="4|2|3"');
    expect(html).toContain(
      '<textarea style="width:200px; height:22px">Notes</textarea>',
    );
    expect(html).toContain("multieventBlende");
    expect(html).toContain("Multieventhinweis");
    expect(html).toContain('data-typ="falsch"');
    expect(html).toContain('data-typ="richtig"');
    // a formula as the answer of a checkbox: kept as rendered content
    expect(html).toMatch(/<label class="MeChLabel"><span class="katex">/);
    expect(html).not.toContain("{r1{");
  });

  it("compiles the word search, the crossword and the hangman", async () => {
    const html = await render(
      [
        ":::multievent",
        "{v{Woodpecker|Eagle|Pheasant}}",
        "",
        "{w{",
        "a|M|p|b~~",
        "H|A|H|N~~",
        "E|S|E|L}}",
        "",
        "{W{ | | |1| ~~",
        "2|D|U|C|K~~",
        " | | |E| }}",
        ":::",
      ].join("\n"),
    );
    expect(html).toContain("MulEvHaManTab");
    expect(html).toContain('data-MulEvHaMan="Woodpecker|Eagle|Pheasant"');
    expect(html).toMatch(/MultiEvSuchTd[^>]*>\s*a\|M\|p\|b~~/);
    expect(html).toContain("MultiKwrTable");
    expect(html).toContain("MultiKwrTr");
  });

  it("compiles a math field with several accepted answers", async () => {
    const html = await render(
      ":::multievent\nSolve: {m{\\frac{1}{2}|0.5}}\n:::\n",
    );
    expect(html).toContain(
      '<math-field class="multiEvMathe" data-Wert="\\frac{1}{2}|0.5"></math-field>',
    );
  });

  it("escapes answers that would break out of an attribute", async () => {
    const html = await render(':::multievent\n{t{x = "quoted" y}}\n:::\n');
    expect(html).toMatch(/data-Wert="x = &#x22;quoted&#x22; y"/);
  });

  it("keeps code inside a multievent readable", async () => {
    const html = await render(
      [
        ":::multievent",
        "`{t{not an event}}`",
        "",
        "```",
        "{t{neither}} {r1{this}}",
        "```",
        ":::",
      ].join("\n"),
    );
    expect(html).toContain("{t{not an event}}");
    expect(html).toContain("{t{neither}} {r1{this}}");
  });

  it("keeps a broken marker as it was written", async () => {
    const html = await render(
      ":::multievent\nA broken {r1{marker without end.\n:::\n",
    );
    expect(html).toContain("{r1{marker without end.");
  });
});

describe("markers as the old regex pass read them", () => {
  it("marks an answer with whitespace around its !", async () => {
    const html = await render(
      ":::multievent\n{a{ cat | !dog }} {r{ !yes}} {r{no }}\n:::\n",
    );
    expect(html).toContain(
      '<option value="0">cat</option><option value="1">dog</option>',
    );
    expect(html).toContain(
      'value="1" data-name="radio" data-gruppe=""><label class="MeRaLabel">yes</label>',
    );
    expect(html).toContain('<label class="MeRaLabel">no</label>');
  });

  it("reads a space before ! in a numbered marker as a literal !", async () => {
    const html = await render(
      ":::multievent\n{r2{ !=}} {r2{!<>}} {c1{ !x}} {r{ !y}}\n:::\n",
    );
    expect(html).toContain(
      'value="0" data-name="radio" data-gruppe="2"><label class="MeRaLabel">!=</label>',
    );
    expect(html).toContain(
      'value="1" data-name="radio" data-gruppe="2"><label class="MeRaLabel">&#x3C;></label>',
    );
    expect(html).toContain(
      'value="0" data-name="checkboxc" data-gruppe="1"><label class="MeChLabel">!x</label>',
    );
    // without a group number, the old pass trimmed first: correct
    expect(html).toContain(
      'value="1" data-name="radio" data-gruppe=""><label class="MeRaLabel">y</label>',
    );
  });

  it("trims the answer of a text field", async () => {
    const html = await render(":::multievent\n{t{ Wasser }}\n:::\n");
    expect(html).toContain('data-Wert="Wasser"');
  });

  it("compiles a marker nested in another", async () => {
    const html = await render(":::multievent\n{b{Tip: {t{x}}}} after\n:::\n");
    expect(html).toMatch(
      /<td style="display:none;">Tip: <input class="multiEvInp"[^>]*data-Wert="x"[^>]*><\/td>/,
    );
    expect(html).not.toContain("}}");
    expect(html).toContain("after");
  });

  it("compiles a marker raised as an exponent", async () => {
    const html = await render(":::multievent\n2^{{a{2|3|!4|8}}}=16\n:::\n");
    expect(html).toMatch(
      /2<sup><select class="multiEvSel"[^>]*><option value="0">2<\/option><option value="0">3<\/option><option value="1">4<\/option><option value="0">8<\/option><\/select><\/sup>=16/,
    );
  });

  it("ends a marker inside a link that took its braces", async () => {
    const html = await render(
      ":::multievent\n{r1{https://example.org/seite.html}} {r1{!seite.html}}\n:::\n",
    );
    expect(html).toContain(
      '<label class="MeRaLabel"><a href="https://example.org/seite.html"',
    );
    expect(html).toContain(">https://example.org/seite.html</a></label>");
    expect(html).not.toContain("}}");
  });

  it("keeps the letters of emphasis in an answer", async () => {
    const html = await render(":::multievent\n{t{2*3*4}}\n:::\n");
    expect(html).toContain('data-Wert="234"');
  });

  it("reads a formula in a button as its TeX", async () => {
    const html = await render(":::multievent\n{k{!$x^2$}}\n:::\n");
    expect(html).toContain('data-wertIst="x^2"');
  });

  it("shows pipes in inline code as written", async () => {
    const html = await render(
      ":::multievent\nWrite `{a{cat|!dog}}` for a dropdown.\n:::\n",
    );
    expect(html).toContain("{a{cat|!dog}}");
    expect(html).not.toContain("\\|");
  });
});

describe("math fields", () => {
  it("reads the LaTeX of a math field verbatim", async () => {
    const html = await render(
      [
        ":::multievent",
        "{m{\\sqrt{2}}} {m{x_{1}+x^{2}}} {m{1\\,5}} {m{a*b*c}}",
        ":::",
      ].join("\n"),
    );
    expect(html).toContain('data-Wert="\\sqrt{2}"');
    expect(html).toContain('data-Wert="x_{1}+x^{2}"');
    expect(html).toContain('data-Wert="1\\,5"');
    expect(html).toContain('data-Wert="a*b*c"');
    expect(html).not.toMatch(/<\/math-field>\s*}/);
  });

  it("keeps a math field in a table cell", async () => {
    const html = await render(
      [
        ":::multievent",
        "| Term | Wert |",
        "| --- | --- |",
        "| x | {m{\\frac{1}{2}|0.5}} |",
        ":::",
      ].join("\n"),
    );
    expect(html).toMatch(
      /<td>\s*<math-field class="multiEvMathe" data-Wert="\\frac\{1\}\{2\}\|0.5"><\/math-field>\s*<\/td>/,
    );
  });

  it("leaves a math marker outside a multievent as text", async () => {
    const result = await process("Text {m{x}} more\n", ctx);
    expect(String(result.value)).toContain("<p>Text {m{x}} more</p>");
  });

  it("compiles a formula with blanks", async () => {
    const html = await render(
      [
        ":::multievent",
        "{m{\\frac{\\placeholder{3}}{\\placeholder[nenner]{4|8}} = 0.75}}",
        ":::",
      ].join("\n"),
    );
    // the field shows the formula with empty blanks; the answers stay out of it
    expect(html).toMatch(
      /<math-field class="multiEvMathe multiEvLuecken" readonly data-Wert="" data-luecken="\{&#x22;blank1&#x22;:\[&#x22;3&#x22;\],&#x22;nenner&#x22;:\[&#x22;4&#x22;,&#x22;8&#x22;\]\}">\s*\\frac\{\\placeholder\[blank1\]\{\}\}\{\\placeholder\[nenner\]\{\}\} = 0.75\s*<\/math-field>/,
    );
  });
});

