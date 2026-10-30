# multievent (inline interactive tasks)

`:::multievent` wraps a block of text with inline interactive elements. Inside it,
`{X{content}}` becomes an interactive element; the character(s) between the braces
pick the format. `!` before a term marks it correct; `|` separates options.

```md
:::multievent
{r1{Leopard}}   {r1{!Cheetah}}   {r1{Gazelle}}
The capital of France is {t{Paris}}.
{H{Well done!}} {h{Try again.}}
:::
```

Feedback lines after evaluation: `{H{…}}` shows when correct, `{h{…}}` when wrong.

## Formats

| Syntax | Element | Notes |
|---|---|---|
| `{r1{…}}` (small r + number) | radio button, left of term | same number groups; `!` = correct |
| `{R1{…}}` (capital R + number) | radio button, right of term | same grouping |
| `{c{…}}` / `{c1{…}}` | checkbox, left | group with numbers; `!` = correct |
| `{C{…}}` / `{C1{…}}` | checkbox, right | |
| `{a{opt1\|opt2\|!opt3}}` | dropdown, no empty choice | `\|` separates options |
| `{A{…}}` | dropdown with empty choice | |
| `{S1{…}}` (capital S + number) | dropdown collecting same-numbered areas | |
| `{l{Word}}` / `{L{Word}}` | text field, scrambled-word hint | l = case-insensitive, L = case-sensitive |
| `{t{answer}}` / `{T{answer}}` | empty text field | t = case-insensitive, T = case-sensitive |
| `{X{1\|2}}` + `{Z{…}}` | number inputs, filled in sequence | X/Z pair, values via `\|` |
| `{X{cat}}` + `{y{Cat}}` / `{Y{Cat}}` | paired text inputs | y = insensitive, Y = sensitive |
| `{k{…}}` / `{k1{…}}` | clickable button, excess terms disappear when solved | group with numbers |
| `{K{…}}` / `{K1{…}}` | clickable button, excess terms stay visible | |
| `{n{…}}` | text area for notes (session only) | |
| `{b{…}}` / `{B{…}}` | toggle for hidden help (eye icon); B indents it | |
| `{v{a\|b\|c}}` | word search | `\|` separates terms |
| `{w{…}}` | word search grid | `\|` cells, `~~` rows; uppercase = correct |
| `{W{…}}` | crossword puzzle | `\|` cells, `~~` rows |

Rules: wrap the block in `:::multievent … :::`; never put the raw `{X{…}}` outside
it. Mark exactly the correct options with `!`. Keep one concept per block.
