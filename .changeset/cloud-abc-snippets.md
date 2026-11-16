---
"@hyperbook/cloud": patch
---

Sheet music is a ```abcjs code fence, not a directive: completion no longer offers `:::abc-music` (which wrapped the fence in a directive that does nothing), *Insert element → Sheet music* inserts the fence alone, and the AI assistant writes it that way. Completion for `mermaid` and `scratchblock` inserts their example as text instead of leaving `${…}` in it.
