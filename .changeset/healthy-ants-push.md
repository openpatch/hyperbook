---
"@hyperbook/fs": minor
"hyperbook": minor
"@hyperbook/markdown": minor
"@hyperbook/types": minor
"hyperbook-studio": minor
---

You can now collocate images, videos, and other additional files directly within your book directory. This means you can reference media using relative paths, making it much easier to:

- Organize your content intuitively

- Collaborate with others

- Share or version-control your Hyperbook with media included

Example usage:

```md
![Image in the same directory as this markdown file](./image.png)
![Image one directory up relative to this markdown file](../image.png)
```

This improvement enables a more seamless and portable authoring experience—no more managing separate static folders or absolute paths.
