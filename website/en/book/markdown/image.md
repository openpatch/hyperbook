---
name: Image
permaid: image
---

# Image

To add an image use this. You should prefix local images with a slash. These
will be loaded from your public directory. You can also use external images
from other sources.

```md
![](/test.jpg)
```

![](/test.jpg)

You can also add an alternate description for the image, which can be used by screen readers.

```md
![A description](/test.jpg)
```

![A description](/test.jpg)

You can also add a visible caption to your image like so:

```md
![A description](/test.jpg "A caption")
```

![A description](/test.jpg "A caption")

If you want to link your image you can use the normal link syntax:

```md
[![A description](/test.jpg "A caption")](/elements/hints)
```

[![A description](/test.jpg "A caption")](/elements/hints)

:::alert{info}
If your Hyperbook uses the [basePath](/configuration/book) property, the basePath will automatically be prepended.
:::

## Customize position and styling

You can customize the position and styling of your images by adding special characters before or after the image markdown.

Custom classes and attributes can be added by using curly braces `{}` after the image markdown.

```md

![](/test.jpg){#hero .rounded width="200"}

```

This will add an image with the ID `hero`, the class `rounded` and a width of `200px`.

:::alert{info}

This is best used with custom css styles.

:::

You can also align your image to the left, right or center by adding special characters before or after the image markdown.

center: `![](/test.jpg)`

left: `-![](/test.jpg)`

leftplus: `--![](/test.jpg)`

right: `![](/test.jpg)-`

rightplus: `![](/test.jpg)--`

centerplus: `--![](/test.jpg)--`

You can check all options on this [example page](./image-styling).
