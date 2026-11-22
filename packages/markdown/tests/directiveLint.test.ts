import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { VFile } from "vfile";
import { ctx } from "./mock";
import { process } from "../src/process";
import { DIRECTIVE_NAMES, suggestDirective } from "../src/directiveNames";

/** The diagnostics the pipeline raised, as `line ruleId` plus the reason. */
const lint = async (md: string) => {
  const result = await process(new VFile({ path: "page.md", value: md }), ctx);
  return result.messages
    .filter((m) => m.source === "hyperbook")
    .map((m) => ({ line: m.line, rule: m.ruleId, reason: m.reason }));
};

describe("unknown directives", () => {
  it("reports a misspelled container, with a suggestion", async () => {
    const messages = await lint(":::alret{.info}\nhi\n:::\n");
    expect(messages).toEqual([
      expect.objectContaining({ line: 1, rule: "unknown-directive" }),
    ]);
    expect(messages[0]!.reason).toContain('Did you mean ":::alert"?');
  });

  it("reports a misspelled leaf directive", async () => {
    const [message] = await lint("::youtub{#abc}\n");
    expect(message?.rule).toBe("unknown-directive");
    expect(message?.reason).toContain('"::youtube"');
  });

  it("reports a text directive that would lose its label", async () => {
    const [message] = await lint("See :tem[API]{#api}.\n");
    expect(message?.rule).toBe("unknown-directive");
    expect(message?.reason).toContain('":term"');
  });

  it("stays quiet about colons in prose", async () => {
    expect(
      await lint("Lehrer:innen treffen sich um 10:30 Uhr, siehe a:b.\n"),
    ).toEqual([]);
  });

  it("explains a child directive used outside its parent", async () => {
    const [message] = await lint('::::tab{title="A"}\nx\n::::\n');
    expect(message?.reason).toContain("only works directly inside tabs");
  });

  it("does not report directives that are known", async () => {
    expect(
      await lint(
        ':::alert{info}\nhi\n:::\n\n::::tabs\n:::tab{title="A"}\nx\n:::\n::::\n',
      ),
    ).toEqual([]);
  });
});

describe("directive syntax", () => {
  it("reports a container that is never closed", async () => {
    const messages = await lint("# A\n\n:::alert{info}\nnot closed\n\n## B\n");
    expect(messages).toContainEqual(
      expect.objectContaining({ line: 3, rule: "unclosed-directive" }),
    );
  });

  it("accepts a container closed with more colons than it opened with", async () => {
    expect(await lint(":::alert{info}\nhi\n::::\n")).toEqual([]);
  });

  it("accepts a closed container inside a blockquote", async () => {
    expect(await lint('> :::collapsible{title="x"}\n> body\n> :::\n')).toEqual(
      [],
    );
  });

  it("reports a space between the colons and the name", async () => {
    const messages = await lint(":::: tabs\nx\n::::\n");
    expect(messages[0]).toMatchObject({ line: 1, rule: "malformed-directive" });
    expect(messages[0]!.reason).toContain('Write "::::tabs"');
  });

  it("reports a leaf directive whose attributes do not parse", async () => {
    const messages = await lint('::youtube[Intro]{#abc title="x}\n');
    expect(messages).toEqual([
      expect.objectContaining({ line: 1, rule: "malformed-directive" }),
    ]);
  });

  it("reports a text directive whose attributes do not parse", async () => {
    const messages = await lint("See :term[API]{#api for details.\n");
    expect(messages).toContainEqual(
      expect.objectContaining({ rule: "malformed-directive" }),
    );
  });

  it("reports a stray closing fence", async () => {
    const messages = await lint(":::alert{info}\nhi\n:::\n:::\n");
    expect(messages).toEqual([
      expect.objectContaining({ line: 4, rule: "stray-directive-fence" }),
    ]);
  });

  it("ignores lines that only resemble directives", async () => {
    expect(await lint("::std::cout prints things.\n")).toEqual([]);
    expect(await lint(":: Hinweis: bitte lesen.\n")).toEqual([]);
    expect(await lint("```\n::youtube [x]\n:::\n```\n")).toEqual([]);
  });
});

describe("suggestDirective", () => {
  it("finds the directive behind a typo", () => {
    expect(suggestDirective("alret")).toBe("alert");
    expect(suggestDirective("PyIDE")).toBe("pyide");
    expect(suggestDirective("sql-ide")).toBe("sqlide");
    expect(suggestDirective("colapsible")).toBe("collapsible");
  });

  it("suggests nothing for unrelated words", () => {
    expect(suggestDirective("innen")).toBeUndefined();
    expect(suggestDirective("std")).toBeUndefined();
  });

  it("knows every directive a plugin declares", () => {
    const src = path.join(__dirname, "..", "src");
    const declared = fs
      .readdirSync(src)
      .filter((f) => /^remarkDirective.*\.ts$/.test(f))
      .flatMap((f) =>
        [
          ...fs
            .readFileSync(path.join(src, f), "utf8")
            .matchAll(/const name = "([^"]+)"/g),
        ].map((m) => m[1]!),
      );
    expect(declared.length).toBeGreaterThan(30);
    for (const name of declared) expect(DIRECTIVE_NAMES).toContain(name);
  });
});

describe("directives consumed by their parent", () => {
  it("does not report ::file read by an element that renders its own output", async () => {
    const unknown = (md: string) =>
      lint(md).then((all) => all.filter((m) => m.rule === "unknown-directive"));
    expect(
      await unknown(
        ':::sqlide\n\n```mysql Statements.sql\nSELECT 1;\n```\n\n::file{path="setup.sql" src="/setup.sql"}\n\n:::\n',
      ),
    ).toEqual([]);
  });
});

describe("files elements point at", () => {
  it("reports a media file that is not in the book", async () => {
    const messages = await lint(
      '::video{src="/missing.mp4" poster="/pyide-main.py"}\n\n::pdf[Notes]{src="notes.pdf"}\n',
    );
    const missing = messages
      .filter((m) => m.rule === "missing-file")
      .sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
    expect(missing).toEqual([
      expect.objectContaining({
        line: 1,
        reason: expect.stringContaining('src="/missing.mp4"'),
      }),
      expect.objectContaining({
        line: 3,
        reason: expect.stringContaining('src="notes.pdf"'),
      }),
    ]);
  });

  it("knows the zips the build makes from archives/", async () => {
    const messages = await lint(
      ':download[Handout]{src="/archives/handout.zip"}\n\n:download[Other]{src="/archives/other.zip"}\n',
    );
    expect(messages.filter((m) => m.rule === "missing-file")).toEqual([
      expect.objectContaining({ line: 3 }),
    ]);
  });

  it("does not look for files on other sites", async () => {
    const messages = await lint(
      '::video{src="https://example.com/a.mp4"}\n\n::audio{src="//cdn.example.com/a.mp3"}\n',
    );
    expect(messages.filter((m) => m.rule === "missing-file")).toEqual([]);
  });
});

describe("rule ids", () => {
  it("tags the elements' own messages", async () => {
    const messages = await lint(
      '::pdf[X]{src="https://x.org/a.pdf" view="book"}\n\n::alert\n',
    );
    expect(messages.map((m) => m.rule)).toEqual([
      "invalid-attribute-value",
      "wrong-directive-form",
    ]);
  });
});

describe("jsxgraph keepaspectratio", () => {
  const render = (md: string) =>
    process(new VFile({ path: "page.md", value: md }), ctx);

  it("passes the option to JSXGraph under its real name", async () => {
    const result = await render(":::jsxgraph{keepaspectratio=true}\n:::\n");
    expect(String(result.value)).toContain("keepaspectratio: true");
    expect(result.messages.filter((m) => m.source === "hyperbook")).toEqual([]);
  });

  it("still honours the old misspelling, with a warning", async () => {
    const result = await render(":::jsxgraph{keepaspetcratio=true}\n:::\n");
    expect(String(result.value)).toContain("keepaspectratio: true");
    expect(result.messages.map((m) => m.ruleId)).toEqual(["deprecated-syntax"]);
  });
});
