---
name: Embed
---

# Embed

The embed element helps with content embedding.

For example to embed a LearningApp you can use the following syntax:

```md
::embed{src="https://learningapps.org/watch?app=15767435"}
```

::embed{src="https://learningapps.org/watch?app=15767435"}

The embed element accepts these arguments:

- **src**: The url which should be embedded.
- **aspectRatio**: To keep your embed nice on every device you need to provide an aspect-ratio, e.g.: "16/9", "4/3", "1/1".
- **height**: The height of the embed.
- **width**: The width of the embed. Defaults to 100%.
- **allowFullscreen**: If the embed is allowed to go into full screen mode. Defaults to true.
