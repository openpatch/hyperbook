---
"hyperbook": minor
"@hyperbook/types": minor
---

Add llms.txt file generation feature. When the `llms` property is set to `true` in hyperbook.json, a `llms.txt` file will be generated during build that combines all markdown files in order. The file includes the book name and version in the header. Pages and sections with `hide: true` are automatically excluded from the generated file.
