---
"@hyperbook/types": minor
"hyperbook": patch
"@hyperbook/cloud": patch
"hyperbook-studio": patch
---

The math fields of a multievent load MathLive and the Compute Engine as the
new downloadable runtime `mathfield`, like the runtimes of the IDEs, Typst or
pdf.js. The CLI and the VS Code extension ship without it; a build downloads
it once, the first time a book with a math field is built, and books without
math fields never do. `elements.mathfield.cdn` loads it from jsDelivr or an
own server instead, Hyperbook Cloud serves it for the whole instance, and
admins can choose its public CDN under Settings → Element runtimes. Of the
Compute Engine package, only the browser build the math fields load is kept,
5.8 MB instead of 19 MB.
