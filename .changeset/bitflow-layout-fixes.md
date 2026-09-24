---
"@hyperbook/markdown": patch
"hyperbook": patch
---

Fix several layout problems with embedded bitflow assessments: the reset button no longer covers the Check/Back/Next bar, the book's own paragraph, list, heading, blockquote, code and `<pre>` styling no longer leaks into a flow's steps, a fixed `height`/`maxHeight` is now capped to fit under the book's header on a phone instead of running off screen, and printing a page (including from a flow's own `end-certificate` step) prints every step of the flow instead of clipping it to what fit on screen.
