---
"@hyperbook/cloud": minor
---

The AI assistant's editor panel is now a chat: requests on the right, answers on
the left, each with a copy button, auto-scrolling to the newest message, a retry
button when a request fails, and a proposal's diff view stays re-openable until
the next message is sent. Answers are suggestions to copy; any request that
changes text or files must come back as a `write_file`/`delete_file` proposal
the teacher accepts as a diff.

The instance can offer a model picker (`AI_MODELS`, comma-separated; `AI_MODEL`
stays the default and first choice). A new `read_docs` tool serves local,
vendored documentation per directive and file format (hyperbook's official
llms.txt, bitflow/JMP llms.txt, p5, pyide, webide, onlineide, sqlide, multievent,
struktolab pseudocode, and more) — the server never fetches docs at runtime.

The provider parser tolerates the shapes seen in the wild (string, part-list and
single-part `delta.content`, reasoning-only answers from z.ai's GLM), and the
system prompt documents code-fence language tags, IDE multi-file syntax, src file
resolution and per-language file naming (e.g. Java's `Equals.java`). `pnpm dev`
now loads `platforms/cloud/.env` when present.
