---
name: Tiles
permaid: tiles
---

# Tiles

Tiles are a nice visual structure for landing pages or hubs, which should give
your users an overview.

The `:::tiles` container has no attributes.

## `tile` Attributes

| Attribute | Description | Default |
|---|---|---|
| `title` | Title shown inside the tile | - |
| `href` | Optional URL or path the tile links to | - |
| `size` | Tile size: `S`, `M`, or `L` | `M` |
| `icon` | Optional icon URL or emoji such as `:rocket:` | - |

```md
:::tiles

::tile{title="Hallo"}

::tile{title="A tile with a link" href="openpatch.org"}

::tile{title="A large tile" size="L"}

::tile{title="A small tile" size="S"}

::tile{title="A icon tile" icon="https://www.inf-schule.de/assets/img/icons/icon_algorithmen.png"}

::tile{title="An emoji tile" icon=":rocket:"}

:::
```

:::tiles

::tile{title="Hallo"}

::tile{title="A tile with a link" href="openpatch.org"}

::tile{title="A large tile" size="L"}

::tile{title="A small tile" size="S"}

::tile{title="A icon tile" icon="https://www.inf-schule.de/assets/img/icons/icon_algorithmen.png"}

::tile{title="An emoji tile" icon=":rocket:"}

:::
