---
"@hyperbook/markdown": minor
---

The Online IDE and the SQL IDE read `::file{path="…" src="…"}` like the other IDEs: it adds a file from the book to the IDE. The Online IDE links the source, so images and other files its Java code opens work as before; the SQL IDE reads the source at build time and shows an `.sql` file as another editor tab and a Markdown file as a hint. The `@file` lines the Online IDE read before keep working.
