---
"@hyperbook/markdown": minor
---

onlineide and sqlide can hide files, and lock them for reading only: `hidden` and `readonly` as flags after a code block's file name (```java BeispielTest.java hidden`) or as attributes on a `::file` (`::file{src="BeispielTest.java" hidden}`). A hidden file stays in the workspace — it still compiles, so tests against a solution keep running — but never shows in the IDE's file list, so readers cannot open, edit or delete it. Useful for test files.
