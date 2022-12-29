---
name: Protect
---

# Protect

If you want to protect an area of your Hyperbook with a password, you
can use the protect-block.

```md
:::protect{password="hyperbook" description="The password is the name of this project."}

:smiley:

:::
```

:::protect{password="hyperbook" description="The password is the name of this project."}

:smiley:

:::

:::alert{info}
Be sure to use a higher number of `:` if you want to protect something which also uses `:`.
:::

You can sync protect-block by using the id property.

```md
:::protect{id="1" password="hyperbook" description="The password is the name of this project."}

:smiley:

:::

:::protect{id="1" password="hyperbook" description="The password is the name of this project."}

:apple:

:::
```

:::protect{id="1" password="hyperbook" description="The password is the name of this project."}

:smiley:

:::

:::protect{id="1" password="hyperbook" description="The password is the name of this project."}

:apple:

:::
