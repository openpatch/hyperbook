---
name: Tabs
permaid: tabs
---

# Tabs

Tabs are a great way to display alternative content. In Hyperbook you
can use the `::::tabs` and `:::tab{title="A Tab Title"}`.

## `tabs` Attributes

| Attribute | Description | Default |
|---|---|---|
| `id` | Optional shared id for linking multiple tab groups together | auto-generated |

## `tab` Attributes

| Attribute | Description | Default |
|---|---|---|
| `title` | Label shown in the tab bar | - |
| `id` | Optional id used for syncing tabs across groups | auto-generated |

```hyperbook
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

```hyperbook
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
