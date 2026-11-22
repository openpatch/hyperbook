import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fromMarkdown } from "mdast-util-from-markdown";
import { directive } from "micromark-extension-directive";
import { directiveFromMarkdown } from "mdast-util-directive";
import { visit } from "unist-util-visit";
import {
  attributesOf,
  checkAttributes,
  CHECKED_ELEMENTS,
  OPEN_ELEMENTS,
} from "../src/directiveAttributes";

describe("checkAttributes", () => {
  it("reports an attribute the element does not read, with a suggestion", () => {
    const [problem] = checkAttributes(":::collapsible", "collapsible", {
      titel: "Hints",
    });
    expect(problem).toMatchObject({
      ruleId: "unknown-attribute",
      level: "warning",
    });
    expect(problem!.reason).toContain('Did you mean "title"?');
  });

  it("reports a value outside the ones an element knows", () => {
    expect(checkAttributes(":::p5", "p5", { mode: "edit" })).toEqual([
      expect.objectContaining({
        ruleId: "invalid-attribute-value",
        reason: expect.stringContaining("preview, editor"),
      }),
    ]);
  });

  it("accepts the attributes every element takes, and dock where it applies", () => {
    expect(
      checkAttributes(":::pyide", "pyide", { id: "a", class: "b", dock: "" }),
    ).toEqual([]);
    expect(checkAttributes("::video", "video", { dock: "" })).toHaveLength(1);
  });

  it("only notes an alert type it does not know, since CSS may style it", () => {
    expect(checkAttributes(":::alert", "alert", { warning: "" })).toEqual([
      expect.objectContaining({
        level: "info",
        reason: expect.stringContaining('Did you mean "warn"?'),
      }),
    ]);
  });

  it("leaves elements that pass their attributes on alone", () => {
    expect(
      checkAttributes("::geogebra", "geogebra", { showToolBar: "true" }),
    ).toEqual([]);
    expect(checkAttributes("::nothing", "nothing", { x: "" })).toEqual([]);
  });
});

/** The top-level names of a destructuring pattern `{ a, b = 1, c: d, ...e }`. */
function patternNames(pattern: string): string[] {
  const names: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of pattern) {
    if ("([{".includes(char)) depth++;
    if (")]}".includes(char)) depth--;
    if (char === "," && depth === 0) {
      names.push(current);
      current = "";
    } else current += char;
  }
  names.push(current);
  return names
    .map((n) => n.trim())
    .filter((n) => n && !n.startsWith("..."))
    .map((n) =>
      n
        .split(/\s*[:=]/)[0]!
        .replace(/["']/g, "")
        .trim(),
    );
}

/** Every attribute a plugin's source reads off its directive. */
function attributesRead(source: string): Set<string> {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const read = new Set<string>();
  const destructure =
    /\}\s*=\s*\(?\s*(?:node\.)?(?:data\.hProperties|node\.data\.hProperties|attributes)\b/g;
  for (const match of code.matchAll(destructure)) {
    // Walk back to the brace that opens the pattern.
    let depth = 0;
    let i = match.index!;
    for (; i >= 0; i--) {
      if (code[i] === "}") depth++;
      if (code[i] === "{") depth--;
      if (depth === 0) break;
    }
    for (const name of patternNames(code.slice(i + 1, match.index!)))
      read.add(name);
  }
  for (const match of code.matchAll(
    /(?<![\w.])(?:node\.)?attributes\??\.\s*([A-Za-z_]\w*)|(?<![\w.])(?:node\.)?attributes\??\.?\[\s*["']([^"']+)["']\s*\]|["']([\w-]+)["']\s+in\s+\(?\s*(?:node\.)?attributes/g,
  )) {
    read.add(match[1] || match[2] || match[3]!);
  }
  // Object.prototype.hasOwnProperty.call(attributes, "x"), Object.hasOwn(…)
  for (const match of code.matchAll(
    /(?:hasOwnProperty\.call|hasOwn)\(\s*(?:node\.)?attributes[^,]*,\s*["']([^"']+)["']/g,
  )) {
    read.add(match[1]!);
  }
  return read;
}

describe("the attribute table", () => {
  const src = path.join(__dirname, "..", "src");
  const plugins = fs
    .readdirSync(src)
    .filter((f) => /^remarkDirective\w+\.ts$/.test(f));

  it("lists every attribute the elements read", () => {
    let checked = 0;
    for (const plugin of plugins) {
      const source = fs.readFileSync(path.join(src, plugin), "utf8");
      const name =
        source.match(/const name = "([^"]+)"/)?.[1] ??
        source.match(/registerDirective\(file, "([^"]+)"/)?.[1];
      if (!name || OPEN_ELEMENTS.includes(name)) continue;
      // A parent reads its children's attributes too.
      const child = { tiles: "tile", tabs: "tab", term: "t" }[name];
      const known = attributesOf(name) && {
        ...attributesOf(name),
        ...(child ? attributesOf(child) : {}),
      };
      if (!known) continue;
      checked++;
      const missing = [...attributesRead(source)].filter((a) => !(a in known));
      expect(missing, `${plugin} reads attributes the table lacks`).toEqual([]);
    }
    expect(checked).toBeGreaterThan(35);
  });

  it("finds nothing wrong in the documentation", () => {
    const website = path.join(__dirname, "..", "..", "..", "website");
    const problems: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!entry.name.startsWith(".") && entry.name !== "node_modules")
            walk(full);
        } else if (/\.md(\.hbs)?$/.test(entry.name)) {
          const tree = fromMarkdown(fs.readFileSync(full, "utf8"), {
            extensions: [directive()],
            mdastExtensions: [directiveFromMarkdown()],
          });
          visit(tree, (node: any) => {
            if (!/Directive$/.test(node.type)) return;
            for (const problem of checkAttributes(
              node.name,
              node.name,
              node.attributes || {},
            )) {
              problems.push(
                `${path.relative(website, full)}:${node.position?.start.line} ${problem.reason}`,
              );
            }
          });
        }
      }
    };
    walk(website);
    expect(problems).toEqual([]);
  });

  it("only covers elements that exist", () => {
    for (const name of CHECKED_ELEMENTS)
      expect(attributesOf(name)).toBeDefined();
  });
});
