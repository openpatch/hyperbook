---
"@hyperbook/markdown": patch
"@hyperbook/types": patch
"hyperbook": patch
"hyperbook-studio": patch
---

Add `elements.emoji.style`. Emojis are drawn by the reader's operating system,
so the same emoji looks different on Windows, macOS, Android and Linux. Setting
the style to `twemoji` replaces them with Twemoji images at build time, so a
hyperbook looks the same on every platform. This covers emojis in the content
as well as icons from the config, leaves code untouched, and only copies the
emojis a book actually uses into its output. The default stays `native`.
