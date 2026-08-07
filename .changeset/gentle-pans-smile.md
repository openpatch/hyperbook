---
"@hyperbook/markdown": patch
"hyperbook": patch
"hyperbook-studio": patch
---

Inline the script that loads the light and dark stylesheets. It was a file, and
nothing can paint before the stylesheets it writes are there, so every first
paint waited for a round trip to fetch 1.5 kB and then another for the
stylesheets themselves. It is part of the page now, which measured about 140 ms
off the first contentful paint of the documentation on a throttled connection.
