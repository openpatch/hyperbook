---
name: Reiter
lang: de
---

# Reiter

Reiter sind eine gute Möglichkeit alternative Inhalte anzuzeigen.

```md
::::tabs

:::tab{title="Eins"}
Hier ist ein Reiter
:::

:::tab{title="Zwei"}
Ein anderer Reiter mit einem [Link](#).
:::

:::tab{title="Drei"}
Wow
:::

::::
```

::::tabs

:::tab{title="Eins"}
Hier ist ein Reiter
:::

:::tab{title="Zwei"}
Ein anderer Reiter mit einem [Link](#).
:::

:::tab{title="Drei"}
Wow
:::

::::

Du kannst Reiter synchroniseren, indem du dieselbe id vergibst.

```md
::::tabs{id="code"}
:::tab{title="Java" id="java"}
Java
:::
:::tab{title="Python" id="python"}
Python
:::
::::

Andere Reiter mit den selben ids.
::::tabs{id="code"}
:::tab{title="Java" id="java"}
Java
:::
:::tab{title="Python" id="python"}
Python
:::
:::tab{title="C" id="c"}
C
:::
::::
```

::::tabs{id="code"}
:::tab{title="Java" id="java"}
Java
:::
:::tab{title="Python" id="python"}
Python
:::
::::

Andere Reiter mit denselben ids.
::::tabs{id="code"}
:::tab{title="Java" id="java"}
Java
:::
:::tab{title="Python" id="python"}
Python
:::
:::tab{title="C" id="c"}
C
:::
::::
