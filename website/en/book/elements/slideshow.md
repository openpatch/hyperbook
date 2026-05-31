---
name: Slideshow
permaid: slideshow
---

# Slideshow

The `slideshow` directive creates an image slideshow with navigation controls.

## Attributes

| Attribute | Description | Default |
|---|---|---|
| `height` | Height of the slideshow, for example `500` or `500px` | `300px` |

```md
:::slideshow

![Test](/test.jpg "A caption")
![Clouds](/clouds.jpg "Another caption")

:::
```

:::slideshow

![Test](/test.jpg "A caption")
![Clouds](/clouds.jpg "Another caption")

:::

```md
:::slideshow{height=500}

![Test](/test.jpg "A caption")
![Clouds](/clouds.jpg "Another caption")

:::
```

:::slideshow{height=500}

![Test](/test.jpg "A caption")
![Clouds](/clouds.jpg "Another caption")

:::
