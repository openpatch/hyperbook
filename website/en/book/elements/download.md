---
name: Download
permaid: download
---

# Download

You can show a download button. If the file is not available the button
will be marked with "Offline". You should prefix local downloads with
a slash. These will be linked to your public directory. You
can also use external downloads from other sources.

```md
:download[Herunterladen]{src="/test.zip"}

:download[Herunterladen]{src="/test.jpg"}
```

This download links to a file `test.zip` in the public folder.
Unfortunately, the file is not available.

:download[Herunterladen]{src="/test.zip"}

This download links to a file `test.jpg` in the public folder.

:download[Herunterladen]{src="/test.jpg"}

:::alert{info}
If your hyperbook uses the [basePath](/configuration/book) property, the basePath will automatically be prepended.
:::
