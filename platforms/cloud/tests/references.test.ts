import { describe, expect, it } from "vitest";
import {
  FILE_DIRECTIVE_ATTRIBUTES,
  assetAddress,
  findReferences,
  newTargetOf,
  normalizeHref,
  pageRoute,
  resolveSrc,
  rewriteText,
} from "../src/shared/references";
import { DIRECTIVES } from "../src/web/pages/editor/directives";

const BOOK = [
  "hyperbook.json",
  "book/index.md",
  "book/getting-started.md",
  "book/section/page.md",
  "book/section/index.md",
  "glossary/terms.md",
  "public/images/diagram.png",
  "public/data.csv",
  "public/video.mp4",
  "book/style.css",
  "book/section/2026-10-28-112013_hyprshot.png",
  "glossary/logo.png",
  "archives/project/report.pdf",
  "book/maps/map.learningmap",
];

/** Scans one page against the book above. */
const inPage = (text: string, target = "book/section/page.md") =>
  findReferences([{ path: "book/section/page.md", text }], BOOK, target);

describe("addresses", () => {
  it("gives pages their route", () => {
    expect(pageRoute("book/index.md")).toBe("/");
    expect(pageRoute("book/getting-started.md")).toBe("/getting-started");
    expect(pageRoute("book/section/page.md")).toBe("/section/page");
    expect(pageRoute("book/section/index.md")).toBe("/section");
    expect(pageRoute("book/section/page.md.hbs")).toBe("/section/page");
    expect(pageRoute("glossary/terms.md")).toBe("/glossary/terms");
    expect(assetAddress("public/images/diagram.png")).toBe("/images/diagram.png");
    expect(assetAddress("book/style.css")).toBe("/style.css");
    expect(assetAddress("book/section/2026-10-28-112013_hyprshot.png")).toBe("/section/2026-10-28-112013_hyprshot.png");
    expect(assetAddress("glossary/logo.png")).toBe("/glossary/logo.png");
    expect(assetAddress("glossary/terms.md")).toBeNull();
    expect(assetAddress("book/index.md")).toBeNull();
  });

  it("folds together the spellings that address the same page", () => {
    expect(normalizeHref("/section/page.md")).toBe("/section/page");
    expect(normalizeHref("section/page")).toBe("/section/page");
    expect(normalizeHref("/section/page/")).toBe("/section/page");
    expect(normalizeHref("/section/index")).toBe("/section");
    expect(normalizeHref("/")).toBe("/");
  });

  it("resolves a directive's src like readFile", () => {
    const exists = (p: string) => BOOK.includes(p);
    expect(resolveSrc("/video.mp4", "book/index.md", exists)).toBe("public/video.mp4");
    expect(resolveSrc("/maps/map.learningmap", "book/index.md", exists)).toBe("book/maps/map.learningmap");
    expect(resolveSrc("map.learningmap", "book/section/page.md", exists)).toBeNull();
    expect(resolveSrc("map.learningmap", "book/section/index.md", exists)).toBeNull();
    expect(resolveSrc("/missing.mp4", "book/index.md", exists)).toBeNull();
    expect(resolveSrc("./2026-10-28-112013_hyprshot.png", "book/section/page.md", exists)).toBe("book/section/2026-10-28-112013_hyprshot.png");
    expect(resolveSrc("./style.css", "book/section/page.md", exists)).toBeNull();
  });
});

describe("finding references", () => {
  it("finds links, images and definitions that point at the file", () => {
    const refs = inPage(
      "See [the page](/section/page) and [with extension](/section/page.md).\n" +
        "![diagram](/section/page \"Title\")\n" +
        "[def]: /section/page#anchor\n" +
        "Another [text][def]\n" +
        "Not ours: [other](/section/page2) [out](https://x.org/y) [mail](mailto:a@b.c) [frag](#here).\n",
    );
    expect(refs.map((r) => r.kind)).toEqual(["link", "link", "image", "definition"]);
    expect(refs.every((r) => r.pointsAt === "book/section/page.md")).toBe(true);
    expect(refs[3]).toMatchObject({ line: 3, column: 8, raw: "/section/page#anchor", length: "/section/page".length });
  });

  it("resolves relative links against the page's directory, and an index page's against its route", () => {
    expect(inPage("A [relative](page) link.")).toHaveLength(1);
    expect(inPage("An [up](../section/page.md) link.")).toHaveLength(1);
    const index = findReferences([{ path: "book/section/index.md", text: "A [relative](page) link." }], BOOK, "book/section/page.md");
    expect(index).toHaveLength(1);
  });

  it("matches links to the page under its other spellings, with query and fragment intact", () => {
    const [ref] = inPage("Link [x](/section/page?a=1#top).");
    expect(ref).toMatchObject({ length: "/section/page".length, raw: "/section/page?a=1#top" });
  });

  it("finds public assets and glossary pages", () => {
    const refs = findReferences(
      [
        { path: "book/index.md", text: "![img](/images/diagram.png)\n[csv](/data.csv)\n[terms](/glossary/terms)\n[logo](/glossary/logo.png)" },
      ],
      BOOK,
      "public/images/diagram.png",
    );
    expect(refs.map((r) => r.pointsAt)).toEqual(["public/images/diagram.png"]);
    const csv = findReferences([{ path: "book/index.md", text: "[csv](/data.csv)" }], BOOK, "public/data.csv");
    expect(csv).toHaveLength(1);
    const glossary = findReferences([{ path: "book/index.md", text: "[terms](/glossary/terms)" }], BOOK, "glossary/terms.md");
    expect(glossary).toHaveLength(1);
  });

  it("ignores links inside code", () => {
    const refs = inPage("```\n[code](/section/page)\n```\nInline `[code](/section/page)` too.\nBut [real](/section/page) works.");
    expect(refs).toHaveLength(1);
  });

  it("finds directive attributes that name the file", () => {
    const refs = findReferences(
      [{ path: "book/index.md", text: ':::video{src="/video.mp4" poster="/images/diagram.png"}\n:::\n:::bitflow{src="/maps/map.learningmap"}' }],
      BOOK,
      "public/video.mp4",
    );
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      kind: "directive",
      directive: { name: "video", attribute: "src" },
      pointsAt: "public/video.mp4",
      line: 1,
      column: 15,
    });
    const poster = findReferences(
      [{ path: "book/index.md", text: ':::video{src="/video.mp4" poster=\'/images/diagram.png\'}' }],
      BOOK,
      "public/images/diagram.png",
    );
    expect(poster.map((r) => r.directive)).toEqual([{ name: "video", attribute: "poster" }]);
    const quoted = findReferences(
      [{ path: "book/index.md", text: ':::bitflow{src="/maps/map.learningmap"}' }],
      BOOK,
      "book/maps/map.learningmap",
    );
    expect(quoted).toHaveLength(1);
  });

  it("ignores directive attributes that do not name files, and external values", () => {
    const refs = findReferences(
      [{ path: "book/index.md", text: ':::alert{title="/section/page"}\n:::video{src="https://x.org/v.mp4"}' }],
      BOOK,
      "book/section/page.md",
    );
    expect(refs).toEqual([]);
  });

  it("finds the archive directive's folder", () => {
    const refs = findReferences([{ path: "book/index.md", text: ':::archive[Project]{name="project"}' }], BOOK, "archives/project");
    expect(refs).toMatchObject([{ pointsAt: "archives/project", directive: { name: "archive", attribute: "name" } }]);
    // A file inside the folder is part of the zip, too.
    expect(findReferences([{ path: "book/index.md", text: ':::archive[Project]{name="project"}' }], BOOK, "archives/project/report.pdf")).toHaveLength(1);
    expect(findReferences([{ path: "book/index.md", text: ':::archive[Project]{name="other"}' }], BOOK, "archives/project")).toEqual([]);
  });

  it("finds references to any file of a folder", () => {
    const refs = findReferences(
      [
        { path: "book/index.md", text: "[a](/section/page) and [b](/section)" },
        { path: "book/section/page.md", text: "[self](/section/page)" },
      ],
      BOOK,
      "book/section",
    );
    expect(refs.map((r) => r.pointsAt).sort()).toEqual([
      "book/section/index.md",
      "book/section/page.md",
      "book/section/page.md",
    ]);
  });

  it("agrees with the directive catalog about which attributes name files", () => {
    const fromCatalog: Record<string, string[]> = {};
    for (const d of DIRECTIVES) {
      const attrs = d.attributes.filter((a) => a.file).map((a) => a.name);
      if (attrs.length > 0) fromCatalog[d.name] = attrs;
    }
    expect(FILE_DIRECTIVE_ATTRIBUTES).toEqual(fromCatalog);
  });
});

describe("rewriting", () => {
  const move = (moves: Record<string, string>) => (path: string) => moves[path] ?? null;

  it("rewrites a link to the moved page's route, keeping query and fragment", () => {
    const refs = inPage("Link [x](/section/page?a=1#top).");
    expect(newTargetOf(refs[0]!, move({ "book/section/page.md": "book/renamed.md" }))).toBe("/renamed?a=1#top");
  });

  it("rewrites an asset link to the new address", () => {
    const refs = findReferences([{ path: "book/index.md", text: "![img](/images/diagram.png)" }], BOOK, "public/images/diagram.png");
    expect(newTargetOf(refs[0]!, move({ "public/images/diagram.png": "public/assets/diagram.png" }))).toBe("/assets/diagram.png");
  });

  it("rewrites a directive's src to a path below public/ or book/", () => {
    const refs = findReferences([{ path: "book/index.md", text: ':::video{src="/video.mp4"}' }], BOOK, "public/video.mp4");
    expect(newTargetOf(refs[0]!, move({ "public/video.mp4": "public/media/video.mp4" }))).toBe("/media/video.mp4");
    const intoBook = findReferences([{ path: "book/index.md", text: ':::video{src="/video.mp4"}' }], BOOK, "public/video.mp4");
    expect(newTargetOf(intoBook[0]!, move({ "public/video.mp4": "book/media/video.mp4" }))).toBe("/media/video.mp4");
  });

  it("rewrites the archive directive's folder name", () => {
    const refs = findReferences([{ path: "book/index.md", text: ':::archive[Project]{name="project"}' }], BOOK, "archives/project");
    expect(newTargetOf(refs[0]!, move({ "archives/project": "archives/files" }))).toBe("files");
  });

  it("rewrites a page's text on the positions the scan reported", () => {
    const page = { path: "book/index.md", text: 'See [x](/section/page) and ![i](/images/diagram.png "T").\n:::video{src="/video.mp4"}' };
    const refs = [
      ...findReferences([page], BOOK, "book/section/page.md"),
      ...findReferences([page], BOOK, "public/images/diagram.png"),
      ...findReferences([page], BOOK, "public/video.mp4"),
    ].sort((a, b) => b.start - a.start);
    const { text, skipped } = rewriteText(page.text, refs, move({
      "book/section/page.md": "book/moved.md",
      "public/images/diagram.png": "public/pics/diagram.png",
      "public/video.mp4": "public/media/video.mp4",
    }));
    expect(skipped).toEqual([]);
    expect(text).toBe('See [x](/moved) and ![i](/pics/diagram.png "T").\n:::video{src="/media/video.mp4"}');
  });

  it("finds and renames an image next to the page, keeping it relative", () => {
    const text = "![](./2026-10-28-112013_hyprshot.png)\n![](/section/2026-10-28-112013_hyprshot.png)";
    const refs = inPage(text, "book/section/2026-10-28-112013_hyprshot.png");
    expect(refs.map((r) => r.kind)).toEqual(["image", "image"]);
    const { text: out } = rewriteText(text, refs, move({ "book/section/2026-10-28-112013_hyprshot.png": "book/section/stats.png" }));
    expect(out).toBe("![](./stats.png)\n![](/section/stats.png)");
  });

  it("keeps relative links relative when their file moves elsewhere", () => {
    const text = '[up](../getting-started#a) and :::video{src="./clip.mp4"}';
    const book = [...BOOK, "book/section/clip.mp4"];
    const refs = [
      ...findReferences([{ path: "book/section/page.md", text }], book, "book/getting-started.md"),
      ...findReferences([{ path: "book/section/page.md", text }], book, "book/section/clip.mp4"),
    ];
    const { text: out } = rewriteText(text, refs, move({
      "book/getting-started.md": "book/section/start.md",
      "book/section/clip.mp4": "book/media/clip.mp4",
    }));
    expect(out).toBe('[up](./start#a) and :::video{src="../media/clip.mp4"}');
  });

  it("leaves references alone that have no new address", () => {
    const refs = inPage("Link [x](/section/page).");
    const { text, skipped } = rewriteText("Link [x](/section/page).", refs, move({}));
    expect(text).toBe("Link [x](/section/page).");
    expect(skipped).toHaveLength(1);
  });
});
