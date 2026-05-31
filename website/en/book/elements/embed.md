---
name: Embed
permaid: embed
---

# Embed

The embed element helps with content embedding.

For example to embed a LearningApp you can use the following syntax:

```md
::embed{src="https://learningapps.org/watch?app=15767435"}
```

::embed{src="https://learningapps.org/watch?app=15767435"}

## Attributes

| Attribute | Description | Default |
|---|---|---|
| `src` | URL that should be embedded | - |
| `aspectRatio` | Aspect ratio, for example `16/9`, `4/3`, or `1/1` | - |
| `height` | Height of the embed | `400px` |
| `width` | Width of the embed | `100%` |
| `allowFullscreen` | Allow fullscreen mode for the iframe | `true` |
