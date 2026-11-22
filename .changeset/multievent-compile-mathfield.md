---
"@hyperbook/markdown": minor
---

Multievent markers are compiled when the page is built, a new `{m{…}}`
format is a math field, also with blanks to fill in, and markers now work
inside markdown tables.

The `{x{…}}` markers of a multievent are turned into their inputs, dropdowns and
grids by a rehype compiler, instead of by a regex pass over the page's
serialized HTML at runtime. The author-facing syntax stays exactly
`{r1{…}}`, `{a{…|!…}}` and so on, read as the old pass read it: whitespace
around an answer is ignored, also before the `!` of a dropdown option
(`{a{cat| !dog}}`) or of a marker without a group number, while
`{r1{ !=}}` stays the option `!=`; and a marker may sit inside another
(`{b{Tip: {t{x}}}}`). A URL as an answer (`{r1{https://example.org}}`) no
longer takes the closing braces into its link. The classes, data
attributes and inline styles the compile emits are the ones the runtime always
expected, so evaluation and saved state keep working, and the ids readers'
work is saved under do not change. Labels may now hold formatted content — a
checkbox answer can be a rendered formula — and answers no longer break out of
an attribute: the serializer escapes them. Marked code inside a multievent is
shown as written, not turned into elements.

Because the compiler sees the parsed table, the option pipes of a marker no
longer split its cell. They are protected while the page is parsed, without
moving any position in the source.

The new `{m{…}}` event is a [MathLive](https://mathlive.io) math field, like
Bitflow's task-math: solutions are LaTeX, taken verbatim (braces, backslashes,
`_` and `^` are not read as markdown), several accepted answers separated by
`|`, checked by the Compute Engine — `2x+3`, `3+2x` and `2\cdot x+3` all
count for `{m{2x+3}}`. With `\placeholder{answer}` in it, the formula becomes
a fill-in-the-blank task: it is shown read-only, only its blanks take input,
and each blank is checked, marked and locked on its own. MathLive (0.111.4) and
the Compute Engine (0.198.1) are a downloadable runtime of their own,
`mathfield`, which only pages with a math field ask for; MathLive draws with
the KaTeX fonts the book ships anyway, and its localized decimal comma
follows the page's language.

Sub- and superscripts `_{…}` and `^{…}` now end at their matching brace, so
`2^{{a{2|3|!4|8}}}=16` raises a whole dropdown.
