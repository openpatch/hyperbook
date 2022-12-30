---
name: Scratchblöcke
lang: de
---

# Scratchblöcke

Mit dem Scratchblock-Element kannst du Scratch-Programme darstellen.

Als Standardsprachen werden die deines Hyperbook und Englisch unterstützt.

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

Du kannst weitere Sprachen hinzufügen, indem du den language-Parameter benutzt.
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

Welche Sprache unterstützt werden und wie die einzelnen Befehle heißen kannst
du hier nachschauen: https://github.com/scratchblocks/scratchblocks/tree/main/locales
