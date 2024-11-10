---
name: Scratchblock
permaid: scratchblock
---

# Scratchblock

The scratchblock element allows to easier inserting of scratch programs. The programs will be rendered as a svg.

As a default your hyperbook language and english are supported.

```md
:::scratchblock
when green flag clicked
move (1) steps
:::
```

:::scratchblock
when green flag clicked
move (1) steps
:::

You can add a specific language by providing a language parameter.

```md
:::scratchblock{language="de"}
Wenn die grüne Flagge angeklickt
gehe (1) er Schritt
drehe dich nach rechts um (15) Grad
:::
```

:::scratchblock{language="de"}
Wenn die grüne Flagge angeklickt
gehe (1) er Schritt
drehe dich nach rechts um (15) Grad
:::

You can find the support languages and the corresponding commands here: https://github.com/scratchblocks/scratchblocks/tree/main/locales
