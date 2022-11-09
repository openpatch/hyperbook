---
name: Image
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
