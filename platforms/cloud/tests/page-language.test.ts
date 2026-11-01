import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { snippet } from "@codemirror/autocomplete";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { highlightingFor } from "@codemirror/language";
import { EditorState, Text } from "@codemirror/state";
import { tags as t } from "@lezer/highlight";
import { basicSetup } from "codemirror";
import { describe, expect, it } from "vitest";
import { DIRECTIVES, directive } from "../src/web/pages/editor/directives";
import { findFrontmatter, toPageForm, withPageForm } from "../src/web/pages/editor/frontmatter";
import { blockDirective, inlineDirectives, linkBase, outline, relativeTo } from "../src/web/pages/editor/page-language";
import { hyperbookDark, hyperbookLight, hyperbookSyntax } from "../src/web/pages/editor/syntax-theme";

const repo = path.resolve(import.meta.dirname, "../../..");

describe("the directive catalog", () => {
  it("knows every directive the markdown package handles", () => {
    const dir = path.join(repo, "packages/markdown/src");
    const names = readdirSync(dir)
      .filter((f) => f.startsWith("remarkDirective"))
      .flatMap((f) => [...readFileSync(path.join(dir, f), "utf8").matchAll(/const name = "([\w-]+)"/g)].map((m) => m[1]!));
    expect(names.length).toBeGreaterThan(30);
    expect(names.filter((n) => !directive(n))).toEqual([]);
  });

  it("links to documentation pages that exist", () => {
    for (const d of DIRECTIVES) {
      expect(existsSync(path.join(repo, "website/en/book", `${d.docs}.md`)), d.name).toBe(true);
    }
  });

  it("has snippets CodeMirror can read", () => {
    for (const d of DIRECTIVES) expect(() => snippet(d.snippet), d.name).not.toThrow();
  });
});

describe("reading directives", () => {
  it("reads a container with label and attributes", () => {
    const token = blockDirective(':::collapsible[More]{title="Hint" #one open}', 100)!;
    expect(token).toMatchObject({ name: "collapsible", colons: 3, from: 100, nameFrom: 103, nameTo: 114 });
    expect(token.label).toEqual({ from: 114, to: 120 });
    expect(token.attrs.map((a) => [a.name, a.value])).toEqual([
      ["title", "Hint"],
      ["#one", null],
      ["open", null],
    ]);
  });

  it("reads attributes that are still being typed", () => {
    const token = blockDirective('::video{src="/a')!;
    expect(token.braces).toEqual({ from: 7, to: 15 });
    expect(token.attrs[0]).toMatchObject({ name: "src", value: "/a" });
  });

  it("leaves emoji and colons in prose alone", () => {
    expect(inlineDirectives("Great :smile: see: here, at 10:30")).toEqual([]);
    expect(inlineDirectives('Get :download[it]{src="/a.zip"} and :t[OOP]{#oop}').map((t) => t.name)).toEqual(["download", "t"]);
  });

  it("outlines nested containers and skips code and frontmatter", () => {
    const doc = Text.of([
      "---",
      "name: :::alert",
      "---",
      "::::tabs",
      ":::tab{title=A}",
      "```md",
      ":::alert",
      "```",
      ":::",
      "::::",
      ":::alert",
    ]);
    const { containers, verbatim, depth } = outline(doc);
    expect(containers.map((c) => [c.token.name, c.open, c.close])).toEqual([
      ["tabs", 4, 10],
      ["tab", 5, 9],
      ["alert", 11, null],
    ]);
    expect(verbatim.slice(1, 9)).toEqual([true, true, true, false, false, true, true, true]);
    expect(depth[7]).toBe(2);
  });
});

describe("page settings", () => {
  const page = ["---", "# The page's name", "name: Loops", "custom: kept", "hide: true", "---", "", "# Loops"].join("\n");

  it("finds the frontmatter", () => {
    expect(findFrontmatter(page)).toEqual({ from: 0, to: page.indexOf("---", 4) + 3, yaml: "# The page's name\nname: Loops\ncustom: kept\nhide: true\n" });
    expect(findFrontmatter("# No settings\n---\n")).toBeNull();
  });

  it("reads the frontmatter into a form", () => {
    expect(toPageForm(page)).toMatchObject({ name: "Loops", navigation: "hidden", toc: "", qrcode: false });
  });

  it("writes the form back, keeping comments and other keys", () => {
    const form = { ...toPageForm(page), description: "About loops", toc: "off" as const, keywords: "for, while" };
    expect(withPageForm(page, form)).toBe(
      [
        "---",
        "# The page's name",
        "name: Loops",
        "custom: kept",
        "description: About loops",
        "keywords:",
        "  - for",
        "  - while",
        "navigation: hidden",
        "toc: false",
        "---",
        "",
        "# Loops",
      ].join("\n"),
    );
  });

  it("adds a frontmatter to a page without one, and removes an empty one", () => {
    const form = { ...toPageForm("# Hi"), name: "Hi", password: "secret" };
    const withSettings = withPageForm("# Hi\n", form);
    expect(withSettings).toBe("---\nname: Hi\nprotect:\n  password: secret\n---\n\n# Hi\n");
    expect(withPageForm(withSettings, { ...form, name: "", password: "" })).toBe("# Hi\n");
  });

  it("reads and writes language, scripts, styles, breadcrumb and section navigation", () => {
    const text = [
      "---",
      "name: A",
      "lang: en",
      "scripts:",
      "  - /a.js",
      "styles: [/a.css]",
      "breadcrumb:",
      "  home: 🏠",
      "  separator: <",
      "virtual: true",
      "---",
      "",
      "# A",
    ].join("\n");
    const form = toPageForm(text);
    expect(form).toMatchObject({
      lang: "en",
      scripts: "/a.js",
      styles: "/a.css",
      breadcrumb: "on",
      breadcrumbHome: "🏠",
      breadcrumbSeparator: "<",
      navigation: "virtual",
    });
    expect(
      withPageForm(text, {
        ...form,
        lang: "de",
        scripts: "/a.js, /b.js",
        styles: "",
        breadcrumb: "off",
        breadcrumbHome: "",
        breadcrumbSeparator: "",
        navigation: "expanded",
      }),
    ).toBe(
      [
        "---",
        "name: A",
        "lang: de",
        "scripts:",
        "  - /a.js",
        "  - /b.js",
        "breadcrumb: false",
        "navigation: expanded",
        "---",
        "",
        "# A",
      ].join("\n"),
    );
  });

  it("keeps an empty prev that hides the button", () => {
    const text = "---\nname: A\nprev:\n---\n";
    expect(withPageForm(text, toPageForm(text))).toBe(text);
  });

  it("removes the previous and next jumps with None", () => {
    const text = "---\nname: A\nprev: /book/b\n---\n";
    const form = { ...toPageForm(text), prevOff: true, nextOff: true };
    expect(withPageForm(text, form)).toBe("---\nname: A\nprev: null\nnext: null\n---\n");
  });

  it("reads a removed jump back as None", () => {
    const form = toPageForm("---\nname: A\nprev: null\nnext:\n---\n");
    expect(form).toMatchObject({ prev: "", next: "", prevOff: true, nextOff: true });
    // Unchecking None gives the jump back to the page the book picks.
    expect(withPageForm("---\nname: A\nprev: null\n---\n", { ...form, nextOff: false, prevOff: false })).toBe("---\nname: A\n---\n");
  });

  it("refuses YAML it cannot read", () => {
    expect(() => toPageForm("---\nname: [oops\n---\n")).toThrow();
  });
});

describe("syntax highlighting", () => {
  it("pages and code files share hyperbook-light/dark; hyperbook syntax stays its own layer", () => {
    const editor = readFileSync(path.join(repo, "platforms/cloud/src/web/pages/editor/code-editor.tsx"), "utf8");
    // Our own themes, switched with the app's light/dark toggle, are the base
    // for every file the editor opens — no third-party theme package.
    expect(editor).not.toContain("fsegurai");
    expect(editor).toContain("codeTheme.of(hyperbookTheme())");
    expect(editor).toContain("hyperbookSyntax(isDark())");
    // Pages add no style of their own, so they get the same base; the
    // Hyperbook layer on top is the directive decorations (.cm-hb-*), which
    // keep the mode-aware --hl-* colors.
    const pages = readFileSync(path.join(repo, "platforms/cloud/src/web/pages/editor/page-language.ts"), "utf8");
    expect(pages).not.toContain("syntaxHighlighting(");
    expect(pages).toMatch(/\.cm-hb-name.*--hl-/);
  });

  it("every theme color is readable (>= 4.5:1) on its background", () => {
    const luminance = (hex: string) => {
      const f = (v: number) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      const c = hex.replace("#", "");
      const [r, g, b] = [0, 2, 4].map((i) => f(parseInt(c.slice(i, i + 2), 16))!);
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const contrast = (a: string, b: string) => {
      const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (l1! + 0.05) / (l2! + 0.05);
    };
    for (const [style, bg] of [
      [hyperbookDark, "#1e1e1e"],
      [hyperbookLight, "#ffffff"],
    ] as const) {
      const colors = style.specs.flatMap((s) => (s.color ? [s.color] : []));
      expect(colors.length).toBeGreaterThan(5);
      for (const color of colors) {
        expect(color).toMatch(/^#[0-9a-f]{6}$/);
        expect(contrast(color, bg), `${color} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("hyperbook's style is no fallback, so basicSetup's light-only default stays off", () => {
    const state = EditorState.create({
      doc: "class Main { int answer = 42; }",
      extensions: [basicSetup, hyperbookSyntax(true), java()],
    });
    // Our dark style decides the keyword's class (same class as without
    // basicSetup), not the light-only default highlight style ...
    const only = EditorState.create({ doc: "class Main { int answer = 42; }", extensions: [hyperbookSyntax(true), java()] });
    expect(highlightingFor(state, [t.keyword])).toBe(highlightingFor(only, [t.keyword]));
    const fallbackOnly = EditorState.create({ doc: "int x = 1;", extensions: [basicSetup, java()] });
    expect(highlightingFor(fallbackOnly, [t.keyword])).not.toBe(highlightingFor(state, [t.keyword]));
  });

  it("highlights .scad files as C++ (like the openscad directive's preview)", () => {
    const source = readFileSync(path.join(repo, "platforms/cloud/src/web/pages/editor/code-editor.tsx"), "utf8");
    expect(source).toMatch(/case "scad":[\s\S]*?return cpp\(\)/);
    // The C++ grammar's tags get the theme's colors, readable in dark mode too.
    const scad = EditorState.create({
      doc: "module part() { cube(10); } // a comment",
      extensions: [hyperbookSyntax(true), cpp()],
    });
    expect(highlightingFor(scad, [t.moduleKeyword])).toBeTruthy();
    expect(highlightingFor(scad, [t.function(t.variableName)])).toBeTruthy();
    expect(highlightingFor(scad, [t.comment])).toBeTruthy();
  });
});

describe("relative links", () => {
  it("resolve against the page file's folder, index pages too", () => {
    expect(linkBase("book/index.md")).toEqual([]);
    expect(linkBase("book/a/b.md")).toEqual(["a"]);
    expect(linkBase("book/a/index.md")).toEqual(["a"]);
    expect(linkBase("snippets/x.md.hbs")).toBeNull();
    expect(linkBase("book/a/img.png")).toBeNull();
  });

  it("lead where the link from the root leads", () => {
    const cases: [string[], string, string][] = [
      [["a"], "/a/c", "./c"],
      [["a"], "/a", "./"],
      [["a"], "/a/sub/x", "./sub/x"],
      [["a"], "/", "../"],
      [["a", "b"], "/a/c/d.png", "../c/d.png"],
      [[], "/img.png", "./img.png"],
    ];
    for (const [base, href, relative] of cases) {
      expect(relativeTo(base, href)).toBe(relative);
      // As Hyperbook resolves it (resolveRelativePath in build.ts).
      expect(path.posix.resolve("/" + base.join("/"), relative)).toBe(href);
    }
  });
});
