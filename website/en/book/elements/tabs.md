---
name: Tabs
---

# Tabs

Tabs are a great way to display alternative content. In Hyperbook you
can use the `::::tabs` and `:::tab{title="A Tab Title"}`.

```md
::::tabs

:::tab{title="Hi"}
Here is a tab

Another Test
:::

:::tab{title="Huh"}
Another tab with a [link](#)

Other

:::

:::tab{title="Third"}

Wow

:::

::::
```

::::tabs

:::tab{title="Hi"}
Here is a tab

Another Test
:::

:::tab{title="Huh"}
Another tab with a [link](#)

Other

:::

:::tab{title="Third"}

Wow

:::

::::

You can link tabs together by using the same id or the same titles.

```md
::::tabs{id="code"}
:::tab{title="Java" id="java"}
Java
:::
:::tab{title="Python" id="python"}
Python
::::

Another tabs cluster with the same ids.
::::tabs{id="code"}
:::tab{title="Java"}
Java
:::
:::tab{title="Python" id="python"}
Python
::::
:::tab{title="C" id="c"}
C
::::
```

::::tabs{id="code"}
:::tab{title="Java"}
Java
:::
:::tab{title="Python" id="python"}
Python
::::

Another tabs cluster with the same ids.
::::tabs{id="code"}
:::tab{title="Java"}
Java
:::
:::tab{title="Python" id="python"}
Python
:::
:::tab{title="C" id="c"}
C
::::
