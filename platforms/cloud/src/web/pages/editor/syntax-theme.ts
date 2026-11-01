import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

/**
 * Hyperbook's own syntax themes for the editor, rolled here instead of pulled
 * from a package so they carry no editor chrome of their own — the app's
 * surfaces (background, gutters, selection) stay in charge — and so the
 * colors fit Hyperbook's brand (teal/mint) in both modes. Every color is at
 * least 4.5:1 on its theme's background (#ffffff light, #1e1e1e dark).
 */

/** Dark: mint brand for functions/directives, warm accents for the rest. */
export const hyperbookDark = HighlightStyle.define([
  { tag: [t.heading, t.labelName], color: "#ffcb6b", fontWeight: "bold" },
  { tag: [t.link, t.url], color: "#b5e3d8", textDecoration: "underline" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.monospace, color: "#c3e88d" },
  { tag: [t.quote, t.processingInstruction, t.contentSeparator, t.list], color: "#8b949e", fontStyle: "italic" },
  { tag: [t.keyword, t.operatorKeyword, t.controlKeyword, t.moduleKeyword, t.definitionKeyword, t.tagName, t.angleBracket], color: "#ffcb6b" },
  { tag: [t.string, t.special(t.string), t.regexp], color: "#c3e88d" },
  { tag: [t.number, t.bool, t.atom, t.null, t.literal], color: "#f78c6c" },
  { tag: [t.variableName, t.definition(t.variableName), t.local(t.variableName), t.special(t.variableName)], color: "#e6edf3" },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: "#8b949e", fontStyle: "italic" },
  { tag: [t.typeName, t.className, t.namespace], color: "#82aaff" },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.function(t.variableName)), t.macroName], color: "#89ddff" },
  { tag: [t.propertyName, t.attributeName, t.definition(t.propertyName)], color: "#addb67" },
  { tag: [t.meta, t.documentMeta, t.annotation], color: "#8b949e" },
  { tag: t.invalid, color: "#f87171" },
]);

/** Light: brand teal for keywords, the same accents darkened for white. */
export const hyperbookLight = HighlightStyle.define([
  { tag: [t.heading, t.labelName], color: "#007864", fontWeight: "bold" },
  { tag: [t.link, t.url], color: "#007864", textDecoration: "underline" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.monospace, color: "#22863a" },
  { tag: [t.quote, t.processingInstruction, t.contentSeparator, t.list], color: "#6a737d", fontStyle: "italic" },
  { tag: [t.keyword, t.operatorKeyword, t.controlKeyword, t.moduleKeyword, t.definitionKeyword, t.tagName, t.angleBracket], color: "#007864" },
  { tag: [t.string, t.special(t.string), t.regexp], color: "#22863a" },
  { tag: [t.number, t.bool, t.atom, t.null, t.literal], color: "#b45309" },
  { tag: [t.variableName, t.definition(t.variableName), t.local(t.variableName), t.special(t.variableName)], color: "#24292f" },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: "#6a737d", fontStyle: "italic" },
  { tag: [t.typeName, t.className, t.namespace], color: "#953800" },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.function(t.variableName)), t.macroName], color: "#005cc5" },
  { tag: [t.propertyName, t.attributeName, t.definition(t.propertyName)], color: "#9a6700" },
  { tag: [t.meta, t.documentMeta, t.annotation], color: "#6a737d" },
  { tag: t.invalid, color: "#b91c1c" },
]);

/**
 * The syntax theme for the app's current mode, switched with the light/dark
 * toggle. A non-fallback style like this also disables basicSetup's
 * defaultHighlightStyle, whose colors are light-only and unreadable in dark
 * mode.
 */
export const hyperbookSyntax = (dark: boolean): Extension => syntaxHighlighting(dark ? hyperbookDark : hyperbookLight);
