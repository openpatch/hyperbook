---
name: Collapsible
---

# Collapsible

If you want to show additional content, which should not be seen at
first glance, you can use a collapsible. Collapsibles are great for hints. They can also be nested.

```md
::::collapsible{title="Hallo"}

This is a panel

:::collapsible{title="Nested"}

This is a stacked collapsible

:::

This is normal Test in-between.

:::collapsible{title="With an Image"}

![](/test.jpg)

::::
```

::::collapsible{title="Hallo"}

This is a panel

:::collapsible{title="Nested"}

This is a stacked collapsible

:::

This is normal Test in-between.

:::collapsible{title="With an Image"}

![](/test.jpg)

::::

You can sync collapsibles by using the same id.

```md
:::collapsible{title="Collapse 0" id="synced"}

This is a synced collapsible

:::

Synced

:::collapsible{title="Collapse 1" id="synced"}

In sync with above.

:::
```

:::collapsible{title="Collapse 0" id="synced"}

This is a synced collapsible

:::

Synced

:::collapsible{title="Collapse 1" id="synced"}

In sync with above.

:::

:::alert{warn}
If you want to nest even further be sure to add more `:` to the outer levels.
:::
