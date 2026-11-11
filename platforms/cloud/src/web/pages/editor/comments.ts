import { invertedEffects } from "@codemirror/commands";
import {
  ChangeSet,
  type EditorState,
  type Extension,
  Facet,
  type Range,
  RangeSet,
  StateEffect,
  StateField,
  type Text,
  type Transaction,
} from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  GutterMarker,
  gutter,
  showTooltip,
  type Tooltip,
} from "@codemirror/view";
import i18next from "i18next";
import { type Anchor, relocate } from "../../../shared/comment-anchor";
import { item, menuExtras, separator } from "./context-menu";

/*
 * Comment threads in a file's editor (docs/cloud-platform.md, M7). Each
 * open thread is a marked range. The server's positions refer to the file
 * as it was saved (`baseOid`); the editor maps them through the changes not
 * saved yet, and from then on the marks follow every edit. After a save the
 * editor sends their positions back (see currentAnchors), so a thread stays
 * attached even when its own text was edited.
 *
 * Like Overleaf's "detached comments" (an idea only; none of its code):
 * deleting a thread's text detaches it, undoing the deletion brings it back,
 * and text cut with its thread and pasted elsewhere takes the thread along.
 */

/** A thread as the editor needs it. */
export type EditorThread = {
  id: number;
  /** The saved blob its positions refer to. */
  oid: string;
  from: number;
  to: number;
  quote: string;
  prefix?: string;
  suffix?: string;
};

type Mark = { id: number; from: number; to: number };

export type CommentConfig = {
  /** "Comment" from the tooltip or the context menu. */
  onComment: (view: EditorView) => void;
  /** A mark or its gutter marker was clicked. */
  onSelect: (threadId: number) => void;
};

const commentConfig = Facet.define<CommentConfig, CommentConfig>({
  combine: (values) => values[0] ?? { onComment: () => {}, onSelect: () => {} },
});

/** Puts the open threads of the file into the editor; others go. */
const setThreads = StateEffect.define<EditorThread[]>();
/** The thread the panel shows, highlighted more. */
const setActive = StateEffect.define<number | null>();
/** Marks to put back (undo of a deletion, paste of a cut). */
const restoreMarks = StateEffect.define<Mark[]>({
  map: (marks, mapping) =>
    marks
      .map((m) => ({
        id: m.id,
        from: mapping.mapPos(m.from, 1),
        to: mapping.mapPos(m.to, -1),
      }))
      .filter((m) => m.to > m.from),
});
/** A thread's new range (its suggestion was applied). */
const moveMark = StateEffect.define<Mark>({
  map: (m, mapping) => ({
    id: m.id,
    from: mapping.mapPos(m.from, 1),
    to: mapping.mapPos(m.to, -1),
  }),
});
/** The file was saved: its text is the new base. */
const rebase = StateEffect.define<string>();

type CommentState = {
  marks: DecorationSet;
  /** Threads whose text was deleted (until an undo brings it back). */
  detached: Set<number>;
  active: number | null;
  /** The saved blob of the base text; null when the editor did not start from it. */
  baseOid: string | null;
  /** Changes since the base text. */
  unsaved: ChangeSet;
};

const markOf = (id: number, active: boolean) =>
  Decoration.mark({
    class: active ? "cm-comment cm-comment-active" : "cm-comment",
    attributes: { "data-thread": String(id) },
    threadId: id,
  });

function marksOf(set: DecorationSet): Mark[] {
  const out: Mark[] = [];
  set.between(0, Number.MAX_SAFE_INTEGER, (from, to, value) => {
    out.push({ id: value.spec.threadId as number, from, to });
  });
  return out;
}

function build(marks: Mark[], active: number | null): DecorationSet {
  const ranges: Range<Decoration>[] = marks
    .filter((m) => m.to > m.from)
    .sort((a, b) => a.from - b.from || a.to - b.to)
    .map((m) => markOf(m.id, m.id === active).range(m.from, m.to));
  return RangeSet.of(ranges, true);
}

/** Where a server thread is in the current text: mapped from the base, or found by its text. */
function place(
  thread: EditorThread,
  state: CommentState,
  doc: Text,
): Mark | null {
  if (state.baseOid === thread.oid) {
    const from = state.unsaved.mapPos(thread.from, 1);
    const to = state.unsaved.mapPos(thread.to, -1);
    if (to > from && doc.sliceString(from, to) === thread.quote)
      return { id: thread.id, from, to };
  }
  const anchor: Anchor = {
    anchorFrom: thread.from,
    anchorExact: thread.quote,
    anchorPrefix: thread.prefix ?? "",
    anchorSuffix: thread.suffix ?? "",
  };
  const found = relocate(doc.toString(), anchor);
  return found && { id: thread.id, ...found };
}

/** The saved blob an editor's text started from (null: from unsaved text). */
const baseOidFacet = Facet.define<string | null, string | null>({
  combine: (values) => values[0] ?? null,
});

const commentField = StateField.define<CommentState>({
  create: (state) => ({
    marks: Decoration.none,
    detached: new Set(),
    active: null,
    baseOid: state.facet(baseOidFacet),
    unsaved: ChangeSet.empty(state.doc.length),
  }),
  update(value, tr) {
    let { marks, detached, active, baseOid: base, unsaved } = value;
    if (tr.docChanged) {
      unsaved = unsaved.compose(tr.changes);
      const before = new Set(marksOf(marks).map((m) => m.id));
      marks = marks.map(tr.changes);
      const after = new Set(marksOf(marks).map((m) => m.id));
      // A mark whose text was deleted is gone from the set: detached.
      for (const id of before)
        if (!after.has(id)) detached = new Set(detached).add(id);
    }
    let rebuild = false;
    let current = marksOf(marks);
    for (const effect of tr.effects) {
      if (effect.is(rebase)) {
        base = effect.value;
        unsaved = ChangeSet.empty(tr.state.doc.length);
      } else if (effect.is(setActive)) {
        active = effect.value;
        rebuild = true;
      } else if (effect.is(restoreMarks) || effect.is(moveMark)) {
        const restored = effect.is(moveMark) ? [effect.value] : effect.value;
        const ids = new Set(restored.map((m) => m.id));
        current = [...current.filter((m) => !ids.has(m.id)), ...restored];
        detached = new Set([...detached].filter((id) => !ids.has(id)));
        rebuild = true;
      } else if (effect.is(setThreads)) {
        const wanted = new Map(effect.value.map((t) => [t.id, t]));
        // Threads the editor tracks keep their place: it follows every
        // edit, which the server's positions do not know of yet.
        current = current.filter((m) => wanted.has(m.id));
        detached = new Set([...detached].filter((id) => wanted.has(id)));
        const tracked = new Set([...current.map((m) => m.id), ...detached]);
        const state = { marks, detached, active, baseOid: base, unsaved };
        for (const thread of effect.value) {
          if (tracked.has(thread.id)) continue;
          const placed = place(thread, state, tr.state.doc);
          if (placed) current.push(placed);
        }
        rebuild = true;
      }
    }
    if (rebuild) marks = build(current, active);
    return { marks, detached, active, baseOid: base, unsaved };
  },
  provide: (field) => EditorView.decorations.from(field, (v) => v.marks),
});

/** The marks that a transaction removes, at their places before it: for undo. */
function removedMarks(tr: Transaction): Mark[] {
  const before = tr.startState.field(commentField, false);
  if (!before) return [];
  const after = new Set(
    marksOf(tr.state.field(commentField).marks).map((m) => m.id),
  );
  return marksOf(before.marks).filter((m) => !after.has(m.id));
}

/** Cut text with its threads, to put them back when it is pasted. */
type Clip = {
  text: string;
  marks: { id: number; offset: number; length: number }[];
};

const clipField = StateField.define<Clip | null>({
  create: () => null,
  update(clip, tr) {
    if (!tr.docChanged) return clip;
    if (tr.isUserEvent("delete.cut")) {
      let next: Clip | null = null;
      tr.changes.iterChanges((fromA, toA) => {
        if (next) return;
        const text = tr.startState.doc.sliceString(fromA, toA);
        const marks = marksOf(tr.startState.field(commentField).marks)
          .filter((m) => m.from >= fromA && m.to <= toA)
          .map((m) => ({
            id: m.id,
            offset: m.from - fromA,
            length: m.to - m.from,
          }));
        next = marks.length ? { text, marks } : null;
      });
      return next;
    }
    return clip;
  },
});

/** Pasting what was cut puts its threads back, at the new place. */
const pasteRestore = EditorView.updateListener.of((update) => {
  for (const tr of update.transactions) {
    if (!tr.isUserEvent("input.paste")) continue;
    const clip = tr.startState.field(clipField, false);
    if (!clip) continue;
    const restored: Mark[] = [];
    tr.changes.iterChanges((_fromA, _toA, fromB, _toB, inserted) => {
      if (inserted.toString() !== clip.text) return;
      for (const m of clip.marks)
        restored.push({
          id: m.id,
          from: fromB + m.offset,
          to: fromB + m.offset + m.length,
        });
    });
    if (restored.length) {
      // After this update: dispatching inside an update is not allowed.
      queueMicrotask(() =>
        update.view.dispatch({ effects: restoreMarks.of(restored) }),
      );
    }
  }
});

class ThreadMarker extends GutterMarker {
  constructor(readonly id: number) {
    super();
  }
  override eq(other: ThreadMarker) {
    return other.id === this.id;
  }
  override toDOM() {
    const el = document.createElement("span");
    el.className = "cm-comment-marker";
    el.dataset.thread = String(this.id);
    el.title = i18next.t("comments.title");
    return el;
  }
}

function selectionTooltip(state: EditorState): Tooltip | null {
  const range = state.selection.main;
  if (range.empty) return null;
  return {
    pos: range.head,
    above: range.head < range.anchor,
    arrow: false,
    create(view) {
      const dom = document.createElement("div");
      dom.className = "cm-comment-tooltip";
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = i18next.t("comments.comment");
      button.addEventListener("mousedown", (e) => e.preventDefault());
      button.addEventListener("click", () =>
        view.state.facet(commentConfig).onComment(view),
      );
      dom.append(button);
      return { dom };
    },
  };
}

const theme = EditorView.baseTheme({
  ".cm-comment": {
    backgroundColor: "color-mix(in srgb, #f5b400 22%, transparent)",
    borderBottom: "2px solid color-mix(in srgb, #f5b400 70%, transparent)",
    cursor: "pointer",
  },
  ".cm-comment-active": {
    backgroundColor: "color-mix(in srgb, #f5b400 45%, transparent)",
  },
  // No width of its own: a file without threads keeps all its room.
  ".cm-comment-gutter .cm-gutterElement": { padding: "0 2px" },
  ".cm-comment-marker": {
    display: "inline-block",
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    backgroundColor: "#d99a00",
    cursor: "pointer",
  },
  ".cm-tooltip.cm-comment-tooltip": {
    border: "none",
    background: "transparent",
    boxShadow: "none",
  },
  ".cm-comment-tooltip button": {
    font: "12px var(--font-body, sans-serif)",
    padding: "2px 8px",
    color: "var(--color-background)",
    backgroundColor: "var(--color-brand)",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
});

/**
 * Comments for one file's editor. `baseOid` is the saved blob the editor's
 * text started from (null when it started from unsaved text).
 */
export function commentsExtension(
  config: CommentConfig,
  baseOid: string | null,
): Extension {
  const field = commentField;
  return [
    baseOidFacet.of(baseOid),
    field,
    clipField,
    commentConfig.of(config),
    invertedEffects.of((tr) => {
      const removed = removedMarks(tr);
      return removed.length ? [restoreMarks.of(removed)] : [];
    }),
    pasteRestore,
    showTooltip.compute(["selection"], selectionTooltip),
    gutter({
      class: "cm-comment-gutter",
      markers: (view) => {
        const markers: Range<GutterMarker>[] = [];
        const seen = new Set<number>();
        for (const m of marksOf(view.state.field(field).marks).sort(
          (a, b) => a.from - b.from,
        )) {
          const line = view.state.doc.lineAt(m.from).from;
          if (seen.has(line)) continue;
          seen.add(line);
          markers.push(new ThreadMarker(m.id).range(line));
        }
        return RangeSet.of(markers);
      },
      domEventHandlers: {
        mousedown(view, block) {
          const m = marksOf(view.state.field(field).marks).find(
            (mark) => view.state.doc.lineAt(mark.from).from === block.from,
          );
          if (!m) return false;
          view.state.facet(commentConfig).onSelect(m.id);
          return true;
        },
      },
    }),
    EditorView.domEventHandlers({
      click(event, view) {
        const target = (event.target as HTMLElement | null)?.closest?.(
          "[data-thread]",
        );
        if (!target || !(target instanceof HTMLElement)) return false;
        view.state.facet(commentConfig).onSelect(Number(target.dataset.thread));
        return false;
      },
    }),
    menuExtras.of((box, view) => {
      item(
        box,
        i18next.t("comments.commentSelection"),
        () => view.state.facet(commentConfig).onComment(view),
        {
          disabled: view.state.selection.main.empty,
        },
      );
      separator(box);
    }),
    theme,
  ];
}

function stateOf(view: EditorView): CommentState | null {
  return view.state.field(commentField, false) ?? null;
}

/** Puts the file's open threads into the editor. */
export function syncThreads(view: EditorView, threads: EditorThread[]) {
  if (!stateOf(view)) return;
  view.dispatch({ effects: setThreads.of(threads) });
}

/** Highlights a thread and scrolls to it; false when it is not in the text. */
export function focusThread(view: EditorView, id: number | null): boolean {
  const state = stateOf(view);
  if (!state) return false;
  const mark =
    id === null ? undefined : marksOf(state.marks).find((m) => m.id === id);
  view.dispatch({
    effects: [
      setActive.of(id),
      ...(mark ? [EditorView.scrollIntoView(mark.from, { y: "center" })] : []),
    ],
  });
  return mark !== undefined;
}

/**
 * The selection in the saved text's offsets, for a new thread; or why it
 * cannot be commented on.
 */
export function selectionAnchor(
  view: EditorView,
):
  | { ok: true; oid: string; from: number; to: number }
  | { ok: false; reason: "empty" | "unsaved" } {
  const state = stateOf(view);
  const range = view.state.selection.main;
  if (range.empty) return { ok: false, reason: "empty" };
  if (!state?.baseOid) return { ok: false, reason: "unsaved" };
  const back = state.unsaved.invertedDesc;
  const from = back.mapPos(range.from, 1);
  const to = back.mapPos(range.to, -1);
  // Typed text has no place in the saved file.
  const unchanged =
    to > from &&
    to - from === range.to - range.from &&
    !state.unsaved.touchesRange(from, to);
  if (!unchanged) return { ok: false, reason: "unsaved" };
  return { ok: true, oid: state.baseOid, from, to };
}

/**
 * Where the editor has the threads it tracks, to send after a save; a null
 * range: its text was deleted.
 */
export function currentAnchors(view: EditorView) {
  const state = stateOf(view);
  if (!state) return [];
  return [
    ...marksOf(state.marks).map((m) => ({
      threadId: m.id,
      from: m.from,
      to: m.to,
    })),
    ...[...state.detached].map((id) => ({
      threadId: id,
      from: null,
      to: null,
    })),
  ];
}

/** After a save: the editor's text is the saved blob `oid`. */
export function rebaseComments(view: EditorView, oid: string) {
  if (stateOf(view)) view.dispatch({ effects: rebase.of(oid) });
}

/**
 * Replaces a thread's text with its suggestion; false when the text changed
 * since (then it is left alone).
 */
export function applySuggestion(
  view: EditorView,
  id: number,
  quote: string,
  text: string,
): boolean {
  const state = stateOf(view);
  const mark = state && marksOf(state.marks).find((m) => m.id === id);
  if (!mark || view.state.doc.sliceString(mark.from, mark.to) !== quote)
    return false;
  view.dispatch({
    changes: { from: mark.from, to: mark.to, insert: text },
    effects: text
      ? moveMark.of({ id, from: mark.from, to: mark.from + text.length })
      : [],
    userEvent: "input.comment",
  });
  return true;
}
