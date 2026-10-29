import { syntaxTree } from "@codemirror/language";
import {
  type EditorState,
  StateEffect,
  StateField,
  type Extension,
} from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
} from "@codemirror/view";
import Typo from "typo-js";
import { closeMenu, item, openMenu, separator } from "./context-menu";
import { findFrontmatter } from "./frontmatter";

/**
 * Spell check for pages, modeled on codemirror-v6-spell-checker but aware of
 * Hyperbook's syntax: only prose is underlined. The frontmatter, code, HTML,
 * links and directive headers (`::name{…}`, `{{placeholder}}`) are skipped,
 * and so are words that look like code (with digits or camelCase).
 *
 * The dictionaries are Hunspell's, through Typo.js, and load lazily from
 * /dictionaries (see vite.config.ts). Words the book's teachers accepted come
 * from the book's dictionary on the server (see routes/dictionary.ts).
 *
 * A right-click on a misspelled word opens the menu with corrections and
 * "Add to dictionary" (built with the shared menu in context-menu.ts, whose
 * own handler shows the editor's menu everywhere else).
 */

export type SpellConfig = {
  /** The book's language, e.g. "en" or "de"; decides the dictionary. */
  language: string;
  /** The book's own words, lowercase. */
  words: ReadonlySet<string>;
  /** "Add to dictionary" in the context menu. */
  onAddWord: (word: string) => void;
};

/** Re-checks the page once its dictionary has loaded. */
const loaded = StateEffect.define<null>();

/** The loaded dictionaries, by language. */
const typoes = new Map<string, Typo>();
/** Languages whose dictionary is currently loading. */
const loading = new Set<string>();
/** Views waiting for a dictionary, so they can be re-checked when it arrives. */
const waiting = new Map<string, Set<EditorView>>();

/** Starts loading a language's dictionary; re-checks the views that wanted it. */
function load(language: string, view: EditorView) {
  if (typoes.has(language)) return;
  const waiters = waiting.get(language) ?? new Set<EditorView>();
  waiting.set(language, waiters);
  waiters.add(view);
  if (loading.has(language)) return; // A view got here first.
  loading.add(language);
  const read = (file: string) =>
    fetch(`/dictionaries/${language}/${file}`).then((res) => {
      if (!res.ok) throw new Error(`No dictionary for ${language}`);
      return res.text();
    });
  Promise.all([read("index.aff"), read("index.dic")])
    .then(([aff, dic]) => {
      loading.delete(language);
      typoes.set(language, new Typo(language, aff, dic));
      const views = waiting.get(language);
      waiting.delete(language);
      for (const current of views ?? [])
        current.dispatch({ effects: loaded.of(null) });
    })
    .catch(() => {
      // No dictionary (offline, or an unsupported language): no underlines.
      loading.delete(language);
      waiting.delete(language);
    });
}

/** Syntax nodes that never contain prose. Nodes ending in "Mark" also skip. */
const SKIP_NODES = new Set([
  "FencedCode",
  "CodeText",
  "CodeInfo",
  "InlineCode",
  "Comment",
  "HTMLBlock",
  "HTMLTag",
  "URL",
  "LinkLabel",
  "LinkTitle",
  "HorizontalRule",
  "TableDelimiter",
]);

/** Spans inside prose that are not words: `{{placeholder}}`, `::name{…}`, `$math$`. */
const SKIP_SPANS = [
  /\{\{[^}\n]*\}\}/g,
  /:{1,4}[A-Za-z][\w-]*(\s*\{[^}\n]*\})?/g,
  /\$[^$\n]+\$/g,
];

/** One word: a run of letters, marks, digits and joins. */
const WORD = /[\p{L}\p{N}][\p{L}\p{N}\p{M}'’-]*/gu;

/** Words that are almost surely code, not a typo. */
const codeLike = (word: string) => /\d/.test(word) || /[a-z][A-Z]/.test(word);

/** Whether one of the spans covers [from, to). */
function covered(spans: [number, number][], from: number, to: number) {
  return spans.some(([a, b]) => from < b && to > a);
}

/** The misspelled words of the page, as ranges in document order. */
export function misspellings(
  state: EditorState,
  typo: Typo,
  words: ReadonlySet<string>,
  cache: Map<string, boolean>,
) {
  // Syntax ranges that never contain prose: frontmatter, code, links, …
  const spans: [number, number][] = [];
  const frontmatter = findFrontmatter(state.doc.toString());
  if (frontmatter) spans.push([frontmatter.from, frontmatter.to]);
  syntaxTree(state).iterate({
    enter(node) {
      const name = node.type.name;
      if (SKIP_NODES.has(name) || name.endsWith("Mark"))
        spans.push([node.from, node.to]);
    },
  });
  const wrong: { from: number; to: number }[] = [];
  for (let n = 1; n <= state.doc.lines; n++) {
    const line = state.doc.line(n);
    // The line's own non-word spans, found once per line.
    const lineSpans: [number, number][] = [];
    for (const re of SKIP_SPANS)
      for (const match of line.text.matchAll(new RegExp(re.source, re.flags)))
        lineSpans.push([
          line.from + match.index!,
          line.from + match.index! + match[0].length,
        ]);
    for (const match of line.text.matchAll(WORD)) {
      const from = line.from + match.index!;
      const word = match[0];
      const to = from + word.length;
      if (
        word.length < 2 ||
        codeLike(word) ||
        covered(spans, from, to) ||
        covered(lineSpans, from, to)
      )
        continue;
      if (words.has(word.toLowerCase())) continue;
      let known = cache.get(word);
      if (known === undefined) {
        known = typo.check(word);
        cache.set(word, known);
      }
      if (!known) wrong.push({ from, to });
    }
  }
  return wrong;
}

const underline = Decoration.mark({ class: "cm-spell-error" });

function decorate(
  state: EditorState,
  config: SpellConfig,
  cache: Map<string, boolean>,
): DecorationSet {
  const typo = typoes.get(config.language);
  if (!typo) return Decoration.none;
  return Decoration.set(
    misspellings(state, typo, config.words, cache).map((w) =>
      underline.range(w.from, w.to),
    ),
  );
}

/** The misspelled word at `pos`, if any. */
function underlinedAt(set: DecorationSet, pos: number) {
  // Ranges are sorted, so the first one that ends after pos decides.
  for (let iter = set.iter(pos); iter.value; iter.next()) {
    return iter.from <= pos && pos < iter.to
      ? { from: iter.from, to: iter.to }
      : null;
  }
  return null;
}

/** Suggestions and "Add to dictionary", where the teacher right-clicked. */
function spellMenu(
  view: EditorView,
  range: { from: number; to: number },
  config: SpellConfig,
  x: number,
  y: number,
) {
  const word = view.state.doc.sliceString(range.from, range.to);
  const typo = typoes.get(config.language);
  const suggestions = typo ? typo.suggest(word, 5) : [];
  openMenu(x, y, (box) => {
    const head = document.createElement("p");
    head.textContent = word;
    box.append(head);
    for (const suggestion of suggestions)
      item(box, suggestion, () =>
        view.dispatch({
          changes: { from: range.from, to: range.to, insert: suggestion },
        }),
      );
    if (suggestions.length > 0) separator(box);
    item(box, `Add “${word}” to the dictionary`, () => config.onAddWord(word));
  });
  view.focus();
}

const spellTheme = EditorView.theme({
  ".cm-spell-error": {
    textDecoration: "underline wavy var(--color-destructive)",
    textUnderlineOffset: "3px",
  },
});

/**
 * Spell check as an editor extension. Re-created (through a Compartment in
 * CodeEditor) when the language or the book's words change.
 */
export function spellCheck(config: SpellConfig): Extension {
  const cache = new Map<string, boolean>();
  const field = StateField.define<DecorationSet>({
    create: (state) => decorate(state, config, cache),
    update: (value, tr) =>
      tr.docChanged || tr.effects.some((effect) => effect.is(loaded))
        ? decorate(tr.state, config, cache)
        : value.map(tr.changes),
    provide: (f) => EditorView.decorations.from(f),
  });
  return [
    field,
    spellTheme,
    // Load the dictionary once per editor; a page keeps its extension as long
    // as its language and the book's words stay the same.
    ViewPlugin.fromClass(
      class {
        constructor(view: EditorView) {
          load(config.language, view);
        }
      },
    ),
    EditorView.domEventHandlers({
      mousedown: () => closeMenu(),
      scroll: () => closeMenu(),
      contextmenu(event, view) {
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        const range =
          pos === null ? null : underlinedAt(view.state.field(field), pos);
        if (!range) {
          // No misspelled word here: the editor's own menu takes over (see
          // context-menu.ts, whose handler runs after this one).
          closeMenu();
          return false;
        }
        event.preventDefault();
        spellMenu(view, range, config, event.clientX, event.clientY);
        return true;
      },
    }),
  ];
}
