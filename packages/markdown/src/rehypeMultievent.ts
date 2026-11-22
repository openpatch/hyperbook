import { Element, ElementContent, Properties, Root, Text } from "hast";
import { visit } from "unist-util-visit";
import { markerCloseIndex } from "./multieventPipes";
import { MATH_SOURCE_TAG } from "./micromarkMultieventMath";

/**
 * Compiles the multievent markers — `{r1{Leopard}}`, `{t{Water}}`, `{m{2x}}` —
 * of a page into the interactive elements multievent.js expects.
 *
 * Compiling at build time replaces multievent.js's regex pass over its
 * serialized innerHTML: markers become real elements whose attributes are
 * escaped by the serializer — labels may even hold formatted content and
 * formulas — and markers inside markdown tables work, because the table,
 * its pipes protected by `escapeMultieventMarkerPipes`, is parsed before
 * this runs.
 *
 * The compiler emits the same classes, data attributes and inline styles the
 * old pass produced, so the grouping, evaluation and saved-state logic of
 * multievent.js keeps working unchanged. What it cannot emit — names like
 * `radio` + the multievent's position on the page, which only exist at
 * runtime — it leaves to multievent.js, which builds them from the
 * `data-name`/`data-gruppe` attributes written here.
 */

const OPEN_MARKER = /\{([a-zA-Z])(\d*)\{/g;
const CLOSE = "}}";

/**
 * A blank of a math field: `\placeholder{answer}` or
 * `\placeholder[id]{answer}`, the answer optionally several accepted ones
 * separated by `|`.
 */
const PLACEHOLDER = "\\placeholder";

type ContentPiece =
  { kind: "text"; value: string } | { kind: "node"; node: ElementContent };

const classOf = (properties: Properties, name: string): boolean => {
  // The directives set `class` (verbatim from their hProperties), hast uses
  // `className`; both spellings appear in the pipeline.
  const classNames = properties?.className ?? properties?.["class"];
  if (typeof classNames === "string")
    return classNames.split(/\s+/).includes(name);
  if (Array.isArray(classNames)) return classNames.includes(name);
  return false;
};

const text = (value: string): Text => ({ type: "text", value });
const element = (
  tagName: string,
  properties: Properties = {},
  children: ElementContent[] = [],
): Element => ({ type: "element", tagName, properties, children });

/** The next marker opening in `value`, skipping escaped braces like `\{e\{`. */
const findOpen = (
  value: string,
): { index: number; letter: string; gruppe: string } | null => {
  OPEN_MARKER.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = OPEN_MARKER.exec(value))) {
    if (match.index > 0 && value[match.index - 1] === "\\") continue;
    return { index: match.index, letter: match[1], gruppe: match[2] };
  }
  return null;
};

/** The text of a node as a reader would type it: a rendered formula counts
 * as its TeX source, emphasis as its letters. */
const plainText = (node: ElementContent): string => {
  if (node.type === "text") return node.value;
  if (node.type !== "element") return "";
  if (classOf(node.properties, "katex")) {
    let tex = "";
    visit(node, "element", (child: Element) => {
      if (child.tagName === "annotation")
        tex = child.children.map(plainText).join("");
    });
    return tex;
  }
  if (node.tagName === MATH_SOURCE_TAG) return String(node.properties?.latex ?? "");
  return node.children.map(plainText).join("");
};

/** The marker content as one string. The label formats use the element
 * children instead (`contentChildren`). */
const contentText = (pieces: ContentPiece[]): string =>
  pieces
    .map((piece) => (piece.kind === "text" ? piece.value : plainText(piece.node)))
    .join("");

/** The marker content as elements, with markers nested in it compiled. */
const contentChildren = (pieces: ContentPiece[]): ElementContent[] =>
  compileStream(
    pieces.map((piece) =>
      piece.kind === "text" ? text(piece.value) : piece.node,
    ),
  );

/** Content without the whitespace at its edges: `{t{ Wasser }}` is `Wasser`,
 * as the old pass trimmed it. */
const trimPieces = (pieces: ContentPiece[]): ContentPiece[] => {
  const out = [...pieces];
  const first = out[0];
  if (first?.kind === "text") {
    const value = first.value.replace(/^\s+/, "");
    if (value) out[0] = { kind: "text", value };
    else out.shift();
  }
  const last = out[out.length - 1];
  if (last?.kind === "text") {
    const value = last.value.replace(/\s+$/, "");
    if (value) out[out.length - 1] = { kind: "text", value };
    else out.pop();
  }
  return out;
};

/**
 * A leading `!` marks the correct answer; here it is stripped, with the
 * whitespace around it: `{a{cat| !dog}}` marks `dog`.
 *
 * `spaced` says whether whitespace may stand before the `!`, as the old pass
 * had it: yes for dropdown options and for markers without a group number,
 * whose leading whitespace it trimmed; no for numbered ones, where
 * `{r1{ !=}}` is the option `!=` — the one way to write an answer that
 * starts with `!`.
 */
const asAnswer = (
  pieces: ContentPiece[],
  spaced = true,
): { correct: boolean; pieces: ContentPiece[] } => {
  const head = pieces[0];
  if (!spaced && head?.kind === "text" && /^\s/.test(head.value))
    return { correct: false, pieces: trimPieces(pieces) };
  const trimmed = trimPieces(pieces);
  const first = trimmed[0];
  if (first?.kind !== "text" || !first.value.startsWith("!"))
    return { correct: false, pieces: trimmed };
  return {
    correct: true,
    pieces: trimPieces([
      { kind: "text", value: first.value.slice(1) },
      ...trimmed.slice(1),
    ]),
  };
};

/** Content pieces split on a separator, usually the `|` between options. */
const splitPieces = (
  pieces: ContentPiece[],
  separator = "|",
): ContentPiece[][] => {
  const parts: ContentPiece[][] = [[]];
  for (const piece of pieces) {
    if (piece.kind === "node") {
      parts[parts.length - 1].push(piece);
      continue;
    }
    const split = piece.value.split(separator);
    split.forEach((part, index) => {
      if (index > 0) parts.push([]);
      if (part !== "")
        parts[parts.length - 1].push({ kind: "text", value: part });
    });
  }
  return parts;
};

const INP_STYLE = "text-align:center;font-size:1em;font-weight:bold;";
const SEL_STYLE = "text-align:center;font-size:1em;font-weight:bold;";

/** `value` split on `|` outside braces: `a|\\frac{1}{2}` is two answers. */
export const splitAlternatives = (value: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === "\\") {
      current += char + (value[i + 1] ?? "");
      i++;
      continue;
    }
    if (char === "{") depth++;
    if (char === "}") depth = Math.max(0, depth - 1);
    if (char === "|" && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current.trim());
  return parts.filter((part) => part !== "");
};

/**
 * The blanks of a fill-in-the-blank formula: `\placeholder[id]{answer}`, the
 * id optional. Returns the formula with every blank emptied — the field the
 * reader sees — and the accepted answers per blank id; `null` without blanks.
 */
export const parseBlanks = (
  latex: string,
): { template: string; blanks: Record<string, string[]> } | null => {
  if (!latex.includes(PLACEHOLDER)) return null;
  const blanks: Record<string, string[]> = {};
  const taken = new Set<string>();
  const found: { start: number; end: number; id?: string; body: string }[] =
    [];

  let index = latex.indexOf(PLACEHOLDER);
  while (index !== -1) {
    let cursor = index + PLACEHOLDER.length;
    // `\placeholders` or the like is another command
    if (/[a-zA-Z]/.test(latex[cursor] ?? "")) {
      index = latex.indexOf(PLACEHOLDER, cursor);
      continue;
    }
    // [id], and whatever further options MathLive knows ([correct], …),
    // which the compiler sets itself and drops here
    let id: string | undefined;
    while (latex[cursor] === "[") {
      const end = latex.indexOf("]", cursor);
      if (end === -1) break;
      if (id === undefined) id = latex.slice(cursor + 1, end).trim() || "";
      cursor = end + 1;
    }
    while (latex[cursor] === " ") cursor++;
    let body = "";
    if (latex[cursor] === "{") {
      // the body ends at the `}` that balances its `{`
      let depth = 0;
      let end = -1;
      for (let i = cursor + 1; i < latex.length; i++) {
        if (latex[i] === "\\") {
          i++;
          continue;
        }
        if (latex[i] === "{") depth++;
        else if (latex[i] === "}") {
          if (depth === 0) {
            end = i;
            break;
          }
          depth--;
        }
      }
      if (end !== -1) {
        body = latex.slice(cursor + 1, end);
        cursor = end + 1;
      }
    }
    if (id) taken.add(id);
    found.push({ start: index, end: cursor, id: id || undefined, body });
    index = latex.indexOf(PLACEHOLDER, cursor);
  }
  if (found.length === 0) return null;

  let template = "";
  let last = 0;
  let counter = 0;
  for (const blank of found) {
    let id = blank.id;
    if (!id) {
      do counter++;
      while (taken.has(`blank${counter}`));
      id = `blank${counter}`;
      taken.add(id);
    }
    blanks[id] = splitAlternatives(blank.body);
    template += latex.slice(last, blank.start) + `\\placeholder[${id}]{}`;
    last = blank.end;
  }
  template += latex.slice(last);
  return { template, blanks };
};

/**
 * A math field: MathLive's `<math-field>`. A plain one takes the whole
 * answer, its accepted answers in `data-Wert`. One with blanks
 * (`\placeholder{…}`) shows the formula read-only with the blanks open; the
 * answers per blank go to `data-luecken`, never into the field itself.
 */
const mathField = (raw: string): Element => {
  const latex = raw.trim();
  const parsed = parseBlanks(latex);
  if (!parsed) {
    return element("math-field", {
      class: "multiEvMathe",
      "data-Wert": latex,
    });
  }
  return element(
    "math-field",
    {
      class: "multiEvMathe multiEvLuecken",
      readonly: true,
      "data-Wert": "",
      "data-luecken": JSON.stringify(parsed.blanks),
    },
    [text(parsed.template)],
  );
};

/** The interactive element(s) of one marker, following the markup multievent's
 * old regex pass produced. `null` for unknown letters. */
const buildMarker = (
  kind: string,
  gruppe: string,
  rawPieces: ContentPiece[],
): ElementContent[] | null => {
  const pieces = trimPieces(rawPieces);
  switch (kind) {
    case "c":
    case "C": {
      const { correct, pieces: content } = asAnswer(rawPieces, gruppe === "");
      const input = element("input", {
        type: "checkbox",
        class: "MECheckbox",
        value: correct ? "1" : "0",
        "data-name": kind === "c" ? "checkboxc" : "checkboxC",
        "data-gruppe": gruppe,
      });
      const label = element(
        "label",
        { class: "MeChLabel" },
        contentChildren(content),
      );
      const span = element("span", {});
      if (kind === "c") span.children.push(element("span", {}), input, label);
      else span.children.push(label, input, element("span", {}));
      return [span];
    }
    case "k":
    case "K": {
      const { correct, pieces: content } = asAnswer(rawPieces, gruppe === "");
      const button = element(
        "button",
        {
          class: "butAnAus",
          // the declaration order of the old pass, which differed for `{k{!…}}`
          style:
            kind === "k" && correct
              ? "border:1px solid silver;text-align:center;border-radius:3px;font-size:1em;font-weight:bold;"
              : "border:1px solid silver;border-radius:3px;text-align:center;font-size:1em;font-weight:bold;",
          onclick: "multievent.butAnAus(this.id)",
          value: correct ? "1" : "0",
          "data-gruppe": gruppe + (kind === "k" ? "a" : "b"),
          "data-typ": kind === "k" ? "0" : "1",
          "data-wertIst": contentText(content),
          "data-markiert": "0",
          "data-gewertet": "0",
        },
        contentChildren(content),
      );
      return [button, element("span", {})];
    }
    case "r":
    case "R": {
      const { correct, pieces: content } = asAnswer(rawPieces, gruppe === "");
      const input = element("input", {
        type: "radio",
        class: "MERadio",
        value: correct ? "1" : "0",
        "data-name": kind === "r" ? "radio" : "Radio",
        "data-gruppe": gruppe,
      });
      const label = element(
        "label",
        { class: "MeRaLabel" },
        contentChildren(content),
      );
      const span = element("span", {});
      if (kind === "r") span.children.push(element("span", {}), input, label);
      else span.children.push(label, input, element("span", {}));
      return [span];
    }
    case "t":
    case "T":
    case "z":
      return [
        element("input", {
          class: "multiEvInp",
          style: INP_STYLE,
          type: "text",
          value: "",
          "data-Wert": contentText(pieces),
          "data-style":
            kind === "t" ? "klein" : kind === "T" ? "gross" : "zahl",
        }),
      ];
    case "l":
    case "L":
      return [
        element("input", {
          class: "multiEvInp",
          style: INP_STYLE,
          type: "text",
          value: "",
          "data-Wert": contentText(pieces),
          "data-style": kind === "l" ? "loesungklein" : "loesunggross",
          onfocus:
            'if(this.value==this.getAttribute("data-gemischt")){this.value=""}',
          onblur: "multievent.inpGemEing(this.value,this.id)",
        }),
      ];
    case "y":
    case "Y":
    case "Z":
      return [
        element("input", {
          class: "multiEvInpYZ",
          style: INP_STYLE,
          type: "text",
          value: "",
          "data-wk": contentText(pieces),
          "data-style":
            kind === "y" ? "klein" : kind === "Y" ? "gross" : "zahl",
        }),
      ];
    case "X":
      return [
        element(
          "span",
          { class: "multiEvSpanY", "data-wk": contentText(pieces) },
          [],
        ),
      ];
    case "m":
      // Only when the verbatim construct did not match (an unbalanced
      // brace, say): the markdown-read text is the best there is.
      return [mathField(contentText(pieces))];
    case "b":
    case "B":
      return [
        element(
          "table",
          {
            cellpadding: "0",
            cellspacing: "0",
            style: "border-collapse:collapse;",
          },
          [
            element("tr", {}, [
              element(
                "td",
                {
                  class: "multieventBlende",
                  onclick: "multievent.blende(this.id)",
                  style: "cursor:pointer;",
                  valign: "top",
                },
                [text("\u{1F441}")],
              ),
              element(
                "td",
                { style: "display:none;" },
                contentChildren(pieces),
              ),
            ]),
          ],
        ),
      ];
    case "n": {
      const parts = splitPieces(pieces).map(contentText);
      const [width, height, ...preset] = parts;
      return [
        element(
          "textarea",
          {
            style: `width:${width || 200}px; height:${height || 22}px`,
          },
          preset.length > 0 ? [text(preset.join("|"))] : [],
        ),
      ];
    }
    case "h":
    case "H":
      return [
        element(
          "span",
          {
            class: "Multieventhinweis",
            "data-typ": kind === "h" ? "falsch" : "richtig",
            style: "display:none",
          },
          contentChildren(pieces),
        ),
      ];
    case "v":
      return [
        element(
          "table",
          {
            align: "center",
            class: "MulEvHaManTab",
            style: "border-collapse:collapse;",
            border: "0",
            cellspacing: "0",
            cellpadding: "6",
          },
          [
            element("tr", {}, [
              element(
                "td",
                {
                  valign: "middle",
                  align: "center",
                  style: "min-width:10em;font-family:sans-serif;",
                  class: "MulEvHaManTd",
                },
                [
                  element(
                    "span",
                    { class: "MulEvHaManAusg" },
                    contentChildren(pieces),
                  ),
                ],
              ),
            ]),
            element("tr", {}, [
              element("td", { align: "center" }, [
                element(
                  "span",
                  {
                    class: "MulEvHaManFehl",
                    style:
                      "text-decoration:line-through;color:#e00;font-size:smaller;font-family:sans-serif;",
                  },
                  [text(" ")],
                ),
                element("br"),
              ]),
            ]),
            element("tr", {}, [
              element("td", { align: "center" }, [
                element("input", {
                  maxlength: "2",
                  class: "MulEvHaManInp",
                  "data-MulEvHaMan": contentText(pieces),
                  "data-Nummer": "0",
                  "data-BuchstSind": "",
                  "data-Fehler": "1",
                  "data-BegriffeSind": "",
                  style:
                    "text-align:center;font-size:1em;width:2.4em;font-family:sans-serif;padding:2px;border:1px solid #999;border-radius:3px;background-color:#eee;",
                }),
              ]),
            ]),
          ],
        ),
      ];
    case "w":
      return [
        element(
          "table",
          {
            align: "center",
            class: "MultiEvSuchTable",
            style: "border-collapse:collapse;",
            border: "0",
            cellspacing: "0",
          },
          [
            element("tr", {}, [
              element(
                "td",
                {
                  height: "28",
                  width: "28",
                  valign: "middle",
                  align: "center",
                  class: "MultiEvSuchTd",
                },
                contentChildren(pieces),
              ),
            ]),
          ],
        ),
      ];
    case "W":
      return [
        element(
          "table",
          {
            align: "center",
            class: "MultiKwrTable",
            style: "border-collapse:collapse;",
            border: "0",
            cellspacing: "0",
          },
          [
            element("tr", { class: "MultiKwrTr" }, [
              element(
                "td",
                {
                  height: "28",
                  width: "28",
                  valign: "middle",
                  align: "center",
                  class: "MultiKwrTd",
                },
                contentChildren(pieces),
              ),
            ]),
          ],
        ),
      ];
    case "a":
    case "A": {
      const options = splitPieces(pieces).map((option) => {
        const { correct, pieces: content } = asAnswer(option);
        return element(
          "option",
          { value: correct ? "1" : "0" },
          contentChildren(content),
        );
      });
      const children =
        kind === "A"
          ? [element("option", { value: "0" }, []), ...options]
          : options;
      return [
        element("select", { class: "multiEvSel", style: SEL_STYLE }, children),
      ];
    }
    case "S":
      return [
        element(
          "select",
          {
            class: "multiEvSel",
            style: SEL_STYLE,
            "data-wertIst": contentText(pieces),
            "data-gruppe": gruppe,
          },
          [element("option", {}, [text(contentText(pieces))])],
        ),
      ];
    default:
      return null;
  }
};

/** Adjacent text nodes as one: some plugins (sub/sup) emit a node per
 * character, and a marker must be found whole. */
const mergeTexts = (children: ElementContent[]): ElementContent[] => {
  const out: ElementContent[] = [];
  for (const child of children) {
    const previous = out[out.length - 1];
    if (child.type === "text" && previous?.type === "text") {
      out[out.length - 1] = text(previous.value + child.value);
    } else {
      out.push(child);
    }
  }
  return out;
};

/**
 * A link that swallowed a marker's end. GFM turns a bare URL into a link and
 * counts the closing braces as part of it: `{r1{https://example.org/a.html}}`
 * becomes `{r1{` and a link to `https://example.org/a.html}}`. The old regex
 * pass found the `}}` inside the link's markup; here the link is cut at the
 * marker's end, its address with it, and what followed is returned as text.
 */
const splitAutolink = (
  node: ElementContent,
  nesting: { depth: number },
): { link: Element | null; remainder: string } | null => {
  if (
    node.type !== "element" ||
    node.tagName !== "a" ||
    node.children.length !== 1 ||
    node.children[0].type !== "text"
  )
    return null;
  const label = node.children[0].value;
  const probe = { depth: nesting.depth };
  const close = markerCloseIndex(label, 0, probe);
  if (close === -1) return null;

  const before = label.slice(0, close);
  const remainder = label.slice(close + CLOSE.length);
  if (!before) return { link: null, remainder };

  // The address ends with the label, percent-encoded (`}` is `%7D`).
  const href = String(node.properties?.href ?? "");
  let decoded = href;
  try {
    decoded = decodeURI(href).replace(/%7D/gi, "}").replace(/%22/g, '"');
  } catch {}
  const cut = label.length - close;
  const newHref = decoded.endsWith(label.slice(close))
    ? encodeURI(decoded.slice(0, decoded.length - cut))
    : href;
  return {
    link: { ...node, properties: { ...node.properties, href: newHref }, children: [text(before)] },
    remainder,
  };
};

/** One inline stream — a paragraph, a table cell — with its markers compiled. */
const compileStream = (input: ElementContent[]): ElementContent[] => {
  const children = mergeTexts(input);
  const out: ElementContent[] = [];

  for (let idx = 0; idx < children.length; idx++) {
    const child = children[idx];
    if (child.type !== "text") {
      out.push(child);
      continue;
    }

    const open = findOpen(child.value);
    if (!open) {
      out.push(child);
      continue;
    }

    const prefix = child.value.slice(0, open.index);
    if (prefix) out.push(text(prefix));

    // Gather the content, from inside this text node across any elements,
    // until the closing `}}`.
    const pieces: ContentPiece[] = [];
    let remainder: string | null = null;
    const gathered: {
      pieces: ContentPiece[];
      closed: boolean;
      endIdx: number;
      remainder: string | null;
    } = {
      pieces,
      closed: false,
      endIdx: idx,
      remainder: null,
    };
    let rest: string | null = child.value.slice(
      open.index + open.letter.length + open.gruppe.length + 2,
    );
    let i = idx;
    const nesting = { depth: 0 };
    while (true) {
      if (rest !== null) {
        const close = markerCloseIndex(rest, 0, nesting);
        if (close !== -1) {
          if (rest.slice(0, close))
            pieces.push({ kind: "text", value: rest.slice(0, close) });
          gathered.closed = true;
          gathered.endIdx = i;
          gathered.remainder = rest.slice(close + CLOSE.length);
          break;
        }
        if (rest) pieces.push({ kind: "text", value: rest });
      }
      const following = children[++i];
      if (!following) break;
      const split = splitAutolink(following, nesting);
      if (split) {
        if (split.link) pieces.push({ kind: "node", node: split.link });
        gathered.closed = true;
        gathered.endIdx = i;
        gathered.remainder = split.remainder;
        break;
      }
      if (following.type !== "text") {
        pieces.push({ kind: "node", node: following });
        rest = null;
      } else {
        rest = following.value;
      }
    }
    if (!gathered.closed) {
      // Without a closing `}}` this is not a marker; keep it as written.
      out.push(child);
      continue;
    }

    const built = buildMarker(open.letter, open.gruppe, pieces);
    if (!built) {
      out.push(child);
      continue;
    }
    out.push(...built);

    // Whatever follows the closing braces — more markers, or plain text —
    // is compiled as the rest of the stream.
    const tail: ElementContent[] = [];
    if (gathered.remainder) tail.push(text(gathered.remainder));
    tail.push(...children.slice(gathered.endIdx + 1));
    out.push(...compileStream(tail));
    return out;
  }

  return out;
};

const SKIP = ["code", "pre", "script", "style", "math-field", "textarea"];

/** Children of an element, deepest streams first: a marker's label can be
 * nested content itself. */
const compileElement = (nodes: ElementContent[]): ElementContent[] => {
  const walked = nodes.map((node): ElementContent => {
    if (node.type !== "element") return node;
    if (node.tagName === MATH_SOURCE_TAG)
      return mathField(String(node.properties?.latex ?? ""));
    if (SKIP.includes(node.tagName) || classOf(node.properties, "katex"))
      return node;
    return { ...node, children: compileElement(node.children) };
  });
  return compileStream(walked);
};

export const rehypeMultievent = () => (tree: Root) => {
  visit(tree, "element", (node: Element) => {
    if (
      node.tagName !== "div" ||
      !classOf(node.properties, "directive-multievent")
    )
      return;
    node.children = compileElement(node.children);
  });
};
