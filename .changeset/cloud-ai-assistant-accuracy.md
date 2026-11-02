---
"@hyperbook/cloud": patch
---

AI assistant: more accurate, fewer tokens. Element documentation is served per element instead of the 350 KB hyperbook llms.txt (whose changelog crowded out most elements); a new `edit_file` tool changes passages instead of resending whole pages; the unused "continue" and "improve" request actions are gone (every request is a prompt); the system prompt no longer contradicts itself on answer format, fences or leaf directives (`::bitflow{src=…}`), and carries the tool guidance once; tool definitions and results are shorter, and a wrong path names similar files instead of listing the whole book.
