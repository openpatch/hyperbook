---
"@hyperbook/markdown": patch
"hyperbook": patch
"hyperbook-studio": patch
---

Show indentation guides in the pyide editor. Thin vertical lines mark where each indented block begins and ends, so learners can see which `if`, loop or function a line belongs to. The guide of the block around the cursor is drawn stronger; on a line that opens a block (e.g. `for i in range(3):`), it is the block that line opens. The guides follow the indentation the code actually uses, so two spaces, four spaces and tabs all line up.
