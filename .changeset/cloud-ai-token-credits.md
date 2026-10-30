---
"@hyperbook/cloud": minor
---

The AI assistant now meters usage in tokens and enforces a weekly credit
quota. The provider stream is requested with `include_usage`, and each agent
step's token counts are summed (providers that report none are estimated at
about 4 characters per token). `AI_MODEL_WEIGHTS="model=weight,…"` sets a
cost weight per model (default 1); credits are tokens × weight. The new
entitlement `ai_tokens_per_week` caps credits per UTC week (Monday–Sunday,
null is unlimited) alongside the existing `ai_requests_per_day`; once the
week's credits are used up the route answers 429, while a request that starts
under the cap may overshoot it. Per-day rows in `ai_usage` keep the raw and
weighted token counts (migration `0012_square_sentry.sql`), the audit entry
records the model used, its weight and the token counts, and the editor shows
a credits bar with the refill date and live updates plus each model's weight
in the picker.

The agent loop is more token-efficient, too: a new `read_files` tool reads up
to 8 files in one call, a file or doc already read in the request is not sent
again, and the static system prompt now precedes the per-book text so
provider-side prefix caching can apply.
