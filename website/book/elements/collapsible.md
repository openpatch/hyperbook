---
name: Collapsible
---

If you want to show additional content, which should not be seen at
first glance, you can use a collapsible. Collapsibles are great for hints. They can also be stacked.

```md
::::collapsible{Hallo}

This is a panel

:::collapsible{Nested}

This is a stacked collapsible

:::

This is normal Test in-between.

:::collapsible{With an Image}

![](/test.jpg)

::::
```

::::collapsible{Hallo}

This is a panel

:::collapsible{Nested}

This is a stacked collapsible

:::

This is normal Test in-between.

:::collapsible{With an Image}

![](/test.jpg)

::::

:::alert{warn}
If you want to nested even further be sure to add more `:` to the outer levels.
:::
