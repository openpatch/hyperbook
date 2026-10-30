---
"@hyperbook/cloud": minor
---

The editor of Hyperbook Cloud has an AI writing assistant. It knows the
hyperbook format (pages, frontmatter, directives), looks through the whole
book through tools (`read_file`, `list_files`) and may propose new files,
edits and deletions — every proposal is a git diff the teacher accepts or
denies, file by file, before anything is applied; text answers are inserted
only on purpose. Any OpenAI-compatible provider works: Mistral
(`AI_BASE_URL=https://api.mistral.ai/v1`) and a local Ollama
(`http://localhost:11434/v1`, nothing leaves the school) are documented,
OpenAI, Anthropic's compatibility layer, OpenRouter, LM Studio and vLLM work
the same way. Configure `AI_BASE_URL`, `AI_API_KEY` and `AI_MODEL` together
(or not at all), and the assistant appears in the editor; admins can switch
it off per teacher and set a per-day quota, like every other entitlement.
See `docs/cloud-ai-assistant.md`.
