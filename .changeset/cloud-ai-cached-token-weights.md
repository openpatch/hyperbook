---
"@hyperbook/cloud": minor
---

The AI assistant now uses provider prompt caching and meters tokens per
kind. Every request sends `prompt_cache_key` (keyed on the book's head
commit), so providers with prefix caching — Mistral bills a cached prefix
at 10% of the input price — reuse the shared system prompt across requests
and agent steps. The provider stream's `usage.prompt_tokens_details.cached_tokens`
is parsed into a separate cached-input count, stored in the new
`ai_usage.tokens_cached` column (migration `0013_fair_steve_rogers.sql`),
and shown in the admin AI monitor. Model weights are now per token kind:
`AI_MODEL_WEIGHTS="model=in/cached/out,…"` (a bare `model=weight` sets all
three), the admin settings offer an in/cached/out weight column per model,
and a credit is `(tokensIn − tokensCached) × in + tokensCached × cached +
tokensOut × out` — cached tokens are a subset of the prompt tokens and
count at their own, lower weight.

Also: `scripts/ai-probe.sh` calls Mistral twice with one cache key and
prints the usage chunks, to verify cache hits from the terminal.
