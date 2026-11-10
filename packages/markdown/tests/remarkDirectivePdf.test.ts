import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import rehypeFormat from "rehype-format";
import { ctx } from "./mock";
import remarkDirectivePdf, { parsePageRanges } from "../src/remarkDirectivePdf";
import remarkParse from "../src/remarkParse";

const process = (md: string, context: HyperbookContext = ctx) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectivePdf(context),
  ];
  return unified()
    .use(remarkParse)
    .use(remarkPlugins)
    .use(remarkToRehype)
    .use(rehypeFormat)
    .use(rehypeStringify, {
      allowDangerousCharacters: true,
      allowDangerousHtml: true,
    })
    .processSync(md);
};

const toHtml = (md: string, context?: HyperbookContext) =>
  String(process(md, context).value);

const messages = (md: string) =>
  process(md).messages.map((message) => message.reason);

describe("parsePageRanges", () => {
  it("reads pages and ranges", () => {
    expect(parsePageRanges("3")).toEqual([[3, 3]]);
    expect(parsePageRanges("1-2")).toEqual([[1, 2]]);
    expect(parsePageRanges(" 3, 5 - 6 ")).toEqual([
      [3, 3],
      [5, 6],
    ]);
    expect(parsePageRanges("4-")).toEqual([[4, null]]);
  });

  it("refuses what is not a range", () => {
    expect(parsePageRanges("")).toBeNull();
    expect(parsePageRanges("a")).toBeNull();
    expect(parsePageRanges("0-2")).toBeNull();
    expect(parsePageRanges("5-2")).toBeNull();
    expect(parsePageRanges("1,,2")).toBeNull();
  });
});

describe("remarkDirectivePdf", () => {
  it("shows all pages by default, with title, download and a plain link", () => {
    const html = toHtml(`::pdf[Skript **Mathe**]{src="/skript.pdf"}\n`);
    expect(html).toMatchSnapshot();
    expect(html).toContain('data-view="pages"');
    expect(html).toContain('data-src="/public/skript.pdf"');
    // Without JavaScript the document is still one click away.
    expect(html).toContain('class="pdf-fallback" href="/public/skript.pdf"');
    expect(html).toContain('class="pdf-download" href="/public/skript.pdf"');
    expect(html).toContain("<strong>Mathe</strong>");
  });

  it.each(["pages", "slides", "thumb"])("renders the %s view", (view: string) => {
    const html = toHtml(`::pdf[Folien]{src="/folien.pdf" view="${view}"}\n`);
    expect(html).toContain(`class="directive-pdf pdf-view-${view}"`);
    expect(html).toContain(`data-view="${view}"`);
    expect(html).toContain('class="pdf-viewer"');
  });

  it("embeds the browser's viewer without pdf.js", () => {
    const file = process(`::pdf[Skript]{src="/skript.pdf" view="embed" pages="3-4"}\n`);
    const html = String(file.value);
    expect(html).toContain("<iframe");
    expect(html).toContain('src="/public/skript.pdf#page=3"');
    expect(html).not.toContain("data-runtime");
    // Styles only: the browser draws the document.
    const directives = file.data.directives as Record<string, any>;
    expect(Object.keys(directives)).toEqual(["pdf"]);
    expect(directives.pdf.scripts).toEqual([]);
    expect(directives.pdf.styles).toEqual(["style.css"]);
  });

  it("offers only a download button with view=button", () => {
    const file = process(`::pdf[Arbeitsblatt (PDF)]{src="/blatt.pdf" view="button"}\n`);
    const html = String(file.value);
    expect(html).toMatchSnapshot();
    expect(html).toContain('class="directive-download directive-pdf-button"');
    expect(html).not.toContain("pdf-viewer");
    // The download directive's assets; pdf.js is not loaded.
    expect(Object.keys(file.data.directives as object)).toEqual(["download"]);
  });

  it("passes the page range and the height on", () => {
    const html = toHtml(
      `::pdf[Aufgaben]{src="/blatt.pdf" view="slides" pages="1-2, 5" height=400}\n`,
    );
    expect(html).toContain('data-pages="1-2,5"');
    expect(html).toContain('style="--pdf-height: 400px"');
  });

  it("hides the download button with download=false", () => {
    const html = toHtml(`::pdf[Aufgaben]{src="/blatt.pdf" download="false"}\n`);
    expect(html).not.toContain("pdf-download");
    expect(html).toContain("pdf-fallback");
  });

  it("uses the file name as title when there is none", () => {
    expect(toHtml(`::pdf{src="/blatt.pdf"}\n`)).toContain(
      '<span class="pdf-title">/blatt.pdf</span>',
    );
  });

  it("warns about a missing src, an unknown view and unreadable pages", () => {
    expect(messages(`::pdf[Skript]\n`)).toEqual([
      expect.stringContaining("needs a src"),
    ]);
    expect(messages(`::pdf[Skript]{src="/a.pdf" view="book"}\n`)).toEqual([
      expect.stringContaining('view="book"'),
    ]);
    expect(messages(`::pdf[Skript]{src="/a.pdf" pages="x"}\n`)).toEqual([
      expect.stringContaining('pages="x"'),
    ]);
    expect(messages(`::pdf[Skript]{src="/a.pdf" view="button" pages="1"}\n`)).toEqual([
      expect.stringContaining("have no effect"),
    ]);
  });

  it("names the runtime when it comes from a CDN", () => {
    const html = toHtml(`::pdf[Skript]{src="/skript.pdf"}\n`, {
      ...ctx,
      config: { ...ctx.config, elements: { pdf: { cdn: true } } },
    });
    const runtime = JSON.parse(
      /data-runtime="([^"]*)"/.exec(html)![1]!.replace(/&#x22;|&quot;/g, '"'),
    );
    expect(runtime).toEqual({
      base: "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/",
      lib: "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/legacy/build/pdf.min.mjs",
      worker:
        "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/legacy/build/pdf.worker.min.mjs",
    });
  });
});

describe("remarkDirectivePdf with Typst sources", () => {
  const fs = require("fs") as typeof import("fs");
  const os = require("os") as typeof import("os");
  const path = require("path") as typeof import("path");

  const withBook = (run: (context: HyperbookContext) => void) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "hyperbook-pdf-typ-"));
    try {
      fs.mkdirSync(path.join(root, "book", "kapitel"), { recursive: true });
      fs.mkdirSync(path.join(root, "public"), { recursive: true });
      fs.writeFileSync(path.join(root, "book", "kapitel", "blatt.typ"), "= Blatt");
      fs.writeFileSync(path.join(root, "public", "vorlage.typ"), "= Vorlage");
      run({
        ...ctx,
        root,
        navigation: {
          ...ctx.navigation,
          current: { name: "Kapitel", path: { directory: "kapitel" } } as any,
        },
        makeUrl: (p, base) =>
          typeof p === "string" && p.startsWith("/")
            ? p
            : ctx.makeUrl(p, base),
      });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };

  const jobsOf = (md: string, context: HyperbookContext) =>
    process(md, context).data.typstJobs;

  it("registers a compile job and links to the PDF", () =>
    withBook((context) => {
      const file = process(`::pdf[Blatt]{src="blatt.typ"}\n`, context);
      expect(file.data.typstJobs).toEqual([
        { src: "book/kapitel/blatt.typ", out: "/kapitel/blatt.pdf", inputs: {} },
      ]);
      expect(String(file.value)).toContain('data-src="/kapitel/blatt.pdf"');
      expect(String(file.value)).not.toContain(".typ");
    }));

  it("names a variant with inputs after their hash, once per variant", () =>
    withBook((context) => {
      const jobs = jobsOf(
        [
          `::pdf[A]{src="blatt.typ" inputs="loesung=true, gruppe=A"}`,
          `::pdf[B]{src="blatt.typ" inputs="gruppe=A,loesung=true"}`,
          `::pdf[C]{src="blatt.typ"}`,
          "",
        ].join("\n\n"),
        context,
      ) as any[];
      expect(jobs).toHaveLength(2);
      expect(jobs[0]).toMatchObject({
        src: "book/kapitel/blatt.typ",
        inputs: { gruppe: "A", loesung: "true" },
      });
      expect(jobs[0].out).toMatch(/^\/kapitel\/blatt\.[0-9a-f]{8}\.pdf$/);
      expect(jobs[1].out).toBe("/kapitel/blatt.pdf");
    }));

  it("finds sources in public/ from the book's root", () =>
    withBook((context) => {
      expect(jobsOf(`::pdf[V]{src="/vorlage.typ" view="button"}\n`, context)).toEqual([
        { src: "public/vorlage.typ", out: "/vorlage.pdf", inputs: {} },
      ]);
    }));

  it("warns about a missing source, bad inputs, and inputs on a PDF", () =>
    withBook((context) => {
      const reasons = (md: string) =>
        process(md, context).messages.map((message) => message.reason);
      expect(reasons(`::pdf[X]{src="fehlt.typ"}\n`)).toEqual([
        expect.stringContaining('cannot find the Typst document "fehlt.typ"'),
      ]);
      expect(reasons(`::pdf[X]{src="blatt.typ" inputs="loesung"}\n`)).toEqual([
        expect.stringContaining("not key=value"),
      ]);
      expect(reasons(`::pdf[X]{src="/a.pdf" inputs="a=b"}\n`)).toEqual([
        expect.stringContaining("only applies to a .typ source"),
      ]);
    }));
});
