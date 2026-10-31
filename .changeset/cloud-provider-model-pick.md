---
"@hyperbook/cloud": minor
---

The AI models are now picked in the admin settings instead of the
environment. `AI_BASE_URL` and `AI_API_KEY` alone enable the assistant
(they remain a pair: both or neither), and the admin settings — Admin →
Settings → AI models — offer the models to teachers: the id fields
suggest the provider's own model list, fetched live through the server
(new admin route `GET /api/instance/ai/models`, briefly cached), and any
id can be typed when the provider does not offer a list. Weights, display
names and the default model live there, as before. The `AI_MODEL`,
`AI_MODELS` and `AI_MODEL_WEIGHTS` variables remain as an optional
shorthand (the settings win); until a model is picked anywhere — settings
or shorthand — the assistant stays off.

The editor's model picker now lists its models sorted by the name teachers
see — the label an admin gave, else the model id — instead of default-first,
and shows each model's cost as one rounded number (the average of its
three weights) instead of the raw `in/cached/out` weights. After each
answer the editor shows what it cost in credits: the route's `done` event
carries the request's token counts and their weighted total.

The assistant now knows the conversation: the editor sends the last few
turns along with each request, so follow-ups like "write about a related
animal" know what came before. A clear-conversation button starts fresh
without that history. The assistant's answers render as Markdown
(headings, lists, code, tables), through the same safe pipeline as the
legal pages: raw HTML stays text, links keep to safe protocols.
