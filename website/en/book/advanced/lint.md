---
name: Lint
permaid: lint
---

# Lint

`hyperbook lint` finds problems in your pages without building the book. It runs every page through the same pipeline a build uses, but writes nothing.

```sh
hyperbook lint                  # every page of the book or library
hyperbook lint book/intro.md    # only these pages or folders
hyperbook lint --json           # machine-readable, for scripts and AI agents
```

It reports:

| Rule | What it means |
| --- | --- |
| `unknown-directive` | An element name Hyperbook does not know, like `:::alret`. Its content is dropped from the page. Lint suggests the closest name. |
| `unclosed-directive` | A `:::` block without its closing `:::`. Everything after it ends up inside the block. |
| `malformed-directive` | A line that was meant to be an element but could not be read, e.g. `:: youtube` with a space, or an unclosed quote in `{…}`. It shows up as plain text. |
| `stray-directive-fence` | A `:::` that closes nothing. It shows up as plain text. |
| `unknown-attribute` | An attribute the element does not read, like `titel=` on `:::collapsible`. It has no effect. Lint suggests the closest one. |
| `invalid-attribute-value` | A value the element does not know, like `mode="edit"` on `:::p5` (it takes `preview` or `editor`). |
| `missing-file` | A file an element points at (`src`, `poster`, …) that is neither in `public/` nor next to the page. |
| `broken-link` | A link or image pointing at a page or file that does not exist. |
| `duplicate-permaid` | Two pages with the same `permaid`. |
| `unknown-config-key` | An option in `hyperbook.json` that Hyperbook does not know. |
| `not-a-page` | A path given to lint is not a page of the book. |

The elements also report their own problems, such as a `src` attribute that is missing or an element written with the wrong number of colons (`wrong-directive-form`). These are the same messages `hyperbook build` prints, and every one of them has a rule.

Lint exits with code 1 if it finds an error or a warning. With `--strict`, infos fail too.

## For AI agents

Add something like this to the `AGENTS.md` or `CLAUDE.md` of your book, so an agent checks its own work:

```md
After editing pages, run `npx hyperbook lint --json <changed files>` and fix
every finding before you finish. Each finding has a file, line, rule and message.
```

The JSON looks like this:

```json
{
  "ok": false,
  "pages": 1,
  "errors": 0,
  "warnings": 1,
  "infos": 0,
  "findings": [
    {
      "file": "book/index.md",
      "line": 5,
      "column": 1,
      "severity": "warning",
      "rule": "unknown-directive",
      "message": "Unknown directive \":::alret\". It is shown as plain text and its content is dropped. Did you mean \":::alert\"?"
    }
  ]
}
```
