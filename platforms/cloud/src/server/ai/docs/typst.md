# typst

`:::typst` renders Typst documents. One `typ` fenced block per file: the
main document without a name (it becomes `main.typ`), further files with
`file="chapter.typ"` on the fence; or a `.typ` file via `src`.

    :::typst{mode="edit"}

    ```typ
    = Hello
    This is *Typst*.
    ```

    :::

Attributes: `mode` (`preview` default, `edit`), plus `id`, `files`, `accept`.

Typst 0.15. Packages: `#import "@preview/name:1.0.0"` (Typst Universe), and
the book's own or the instance's shared ones, e.g.
`#import "@local/name:1.0.0": *`; they are published with the book, so never
put solutions in a package a block imports.
