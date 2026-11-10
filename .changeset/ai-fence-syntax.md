---
"@hyperbook/cloud": patch
---

The editor's AI assistant writes code blocks of `:::pyide`, `:::webide`, `:::typst`, `:::openscad` and `:::p5` in the current syntax: the main file without a name, every other file with `file="…"` on the fence. It used to write the old form (`python main.py`), whose blocks a build ignores with a warning. `:::onlineide` and `:::sqlide`, which still take the file name after the language, are unchanged.
