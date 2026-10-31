---
"@hyperbook/cloud": patch
---

The AI assistant no longer fails with an "empty provider answer" on
Mistral's reasoning models. mistral-large-4, mistral-medium-3-5 and
mistral-small-2603 stream their thinking inside `delta.content` as typed
chunks (`{ type: "thinking", thinking: [{ type: "text", text }] }`),
which the provider stream parser did not recognize — and since thinking
counts against `max_tokens`, a model that hit the cap mid-thought looked
like a provider that answered nothing. The parser now gathers those
chunks as reasoning, so a run whose visible text never arrives shows the
thinking instead of failing, and the default `AI_MAX_OUTPUT_TOKENS`
rises from 2048 to 8192, enough headroom for reasoning models to think
and still write (set your own value to override).
