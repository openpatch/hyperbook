# typst

`:::typst` renders Typst documents. One fenced block, named in the fence
(convention: `typ main.typ`), or a `.typ` file via `src`.

    :::typst{mode="edit"}

    ```typ main.typ
    = Hello
    This is *Typst*.
    ```

    :::

Attributes: `mode` (`preview` default, `edit`), plus `id`, `files`, `accept`.
