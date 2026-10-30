# Hyperbook Cloud: AI writing assistant (plan)

An assistant inside the cloud platform's editor that helps teachers write
their hyperbook: continue a section, improve the selected paragraph, draft
a quiz — in the book's own language, knowing the book's
Markdown dialect and able to look through the whole book it is used in. It
may also propose **new files and deletions** (a quiz file plus the page that
links it), but file changes are never applied on their own: the teacher
always sees a diff first and accepts or denies it.

See [the platform plan](cloud-platform.md) for the surrounding architecture;
everything below lives in `platforms/cloud`.

> **Status:** implemented — the work order's slices 1–5 below are done,
> with tests against a fake OpenAI-compatible provider and an e2e run of
> the editor's whole flow. The `search_book` tool, proposal moves and
> per-teacher keys (BYO) remain future slices.

## Decisions

| Topic            | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Credentials      | Instance-only, from env, like `SMTP_*`: set together or the feature is off. The API key never reaches the browser. No per-teacher keys for now (see [Out of scope](#out-of-scope-for-now)).                                                                                                                                                                                                                                                     |
| Protocol         | One integration, the OpenAI chat-completions protocol (`POST {baseUrl}/chat/completions`). Documented for **Mistral** and **local hosting** first; OpenAI, Anthropic (via its OpenAI-compatibility layer), OpenRouter, LM Studio and vLLM work identically.                                                                                                                                                                                     |
| Where it runs    | Only the admin host (`/api/…`, behind the session middleware). Book hosts and the preview host never reach it; teacher-written scripts cannot.                                                                                                                                                                                                                                                                                                  |
| Book access      | The assistant may **query the whole book**: a server-side agent loop gives the model bounded tools (`list_files`, `read_file`) that read the book's git repository — the same source of truth the editor saves into.                                                                                                                                                                                                                            |
| File changes     | The agent may also propose creating, editing and deleting files — through tools, onto an in-memory overlay only. The request ends with a **proposal**: a diff the teacher reviews and accepts or denies (all of it, or per file). Accepting applies through the editor's normal save path (`commitFilesInput`, one git commit, the teacher as author, `baseOid` conflict checks); denying changes nothing. The server never commits on its own. |
| Transport        | Server-Sent Events from the route to the editor (`hono/streaming`'s `streamSSE`); the provider's own stream is forwarded event by event.                                                                                                                                                                                                                                                                                                        |
| State            | Stateless. Requests carry their own context; nothing about a conversation is stored. No AI output is persisted by the platform — the teacher applies or discards it, then saves like any other edit (a git commit).                                                                                                                                                                                                                             |
| Safety           | Per-user rate limit, caps on input and output, caps on tool reads, audit entry with metadata only (never content), provider errors mapped to i18n messages.                                                                                                                                                                                                                                                                                     |
| Credits          | Besides requests, usage is metered in **tokens** (the provider's reported `usage`, estimated at ~4 characters per token when it reports none). A model's tokens are multiplied by its weight (`AI_MODEL_WEIGHTS`, default 1) into _credits_; the entitlement `ai_tokens_per_week` caps credits per UTC week (Monday–Sunday, null is unlimited). A request that starts under the cap may overshoot it; the next is refused (429). The editor shows a bar with the credits left and the refill date. Per-day rows in `ai_usage` keep raw and weighted tokens. |
| Efficiency       | The agent loop resends its history each step, so the model is told to read all files in one `read_files` call; a file or doc already read is not sent again, and the static system prompt comes before per-book text so provider-side prefix caching applies. |
| Per-user control | Two entitlements, like everything else a teacher may do (see the platform plan): `ai` (on/off per user) and `ai_requests_per_day` (a daily quota; null is unlimited). Instance defaults come from the admin settings; admins are never limited. The quota counts accepted requests, one row per user per UTC day in its own table, not the audit log.                                                                                           |
| Language         | The system prompt tells the model to answer in the book's language (`hyperbook.json`), falling back to the teacher's UI locale.                                                                                                                                                                                                                                                                                                                 |

## Configuration

Same pattern as `SMTP_*`: every `AI_*` variable or none; the server refuses a
half configuration (a wrong base URL with no key silently sends nothing).

```
# Mistral — the documented default
AI_BASE_URL=https://api.mistral.ai/v1
AI_API_KEY=…                       # console.mistral.ai
AI_MODEL=mistral-medium-latest      # or mistral-small-latest, open-mistral-nemo

# Local hosting — Ollama on the same machine (no cost, no data leaves the school)
AI_BASE_URL=http://localhost:11434/v1
AI_API_KEY=ollama                  # Ollama ignores the value but the field is required
AI_MODEL=qwen2.5:14b                # any pulled model; `ollama pull …` first
# In Docker: AI_BASE_URL=http://host.docker.internal:11434/v1 (Docker Desktop)
#            or http://ollama:11434/v1 with the service in docker-compose.yml

# OpenAI / OpenRouter
AI_BASE_URL=https://api.openai.com/v1        AI_MODEL=gpt-4o …
AI_BASE_URL=https://openrouter.ai/api/v1     AI_MODEL=anthropic/claude-…

# Anthropic, via its OpenAI-compatibility layer
AI_BASE_URL=https://api.anthropic.com/v1
AI_MODEL=claude-sonnet-4-5 …
```

`src/server/config.ts` gains:

```ts
ai: {
  baseUrl: string;        // AI_BASE_URL, validated as http(s) URL; a path (e.g. /v1) is kept, a trailing slash dropped
  apiKey: string;         // AI_API_KEY
  model: string;         // AI_MODEL
  timeoutMs: number;     // AI_TIMEOUT_SECONDS, default 120
  maxOutputTokens: number; // AI_MAX_OUTPUT_TOKENS, default 2048
  maxSteps: number;      // AI_MAX_STEPS (agent loop), default 8
  requestsPerMinute: number; // AI_REQUESTS_PER_MINUTE, default 6
  modelWeights: Record<string, number>; // AI_MODEL_WEIGHTS="model=weight,…", default 1 per model
} | null
```

`Config.ai === null` means the feature is off: the editor hides the panel,
the status route says so, and `/ai/assist` answers 503 with an i18n message.

## API (admin host, under `/api`)

New file `src/server/admin/routes/ai.ts`, registered in `createAdminApi`
like the other book routes. Two endpoints:

### `GET /api/ai`

Status for the editor: `{ enabled, model, allowed, usedToday, quota }` —
`enabled` is the instance's AI configuration, `allowed`/`quota` the user's
entitlements, `usedToday` the day's count. Answers `enabled: false` instead
of 404 when unconfigured, so the panel can quietly disappear, and
`allowed: false` hides it for teachers an admin switched off. (Authed users
only.)

### `POST /api/books/:id/ai/assist`

`requireUser` + `bookAccess(db, user, id)` — only the book's owners and
editors, exactly like `routes/files.ts`. Input, validated by a schema in
`src/shared/schemas.ts` (so the typed `hc` client and the tests share it):

```ts
export const aiAssistInput = z.object({
  action: z.enum(["free", "continue", "improve"]),
  prompt: z.string().max(4000).optional(), // required for "free"
  pagePath: bookPath, // the page being edited
  selection: z.string().max(16000).optional(), // what the teacher selected
  // The lines around the cursor when nothing is selected; the client
  // assembles them. Caps the input the server trusts.
  context: z.string().max(16000).optional(),
  // The open file's full text, unsaved changes included; the client sends it
  // only when it fits (≤ 128 KiB), so a rewrite of the page is possible.
  pageText: z.string().max(128 * 1024).optional(),
});
```

The response is an SSE stream of JSON events:

| Event      | Data                                        | Meaning                                                                                                                                                |
| ---------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `delta`    | `{ text }`                                  | A chunk of the assistant's Markdown — appended live.                                                                                                   |
| `tool`     | `{ name, args }`                            | The agent is looking through the book or recording a change (`read_file book/lists.md`, `write_file quiz/… .json`) — shown as a progress line.         |
| `proposal` | `{ changes }`                               | The file changes the agent collected, for review (shape below). Sent once, right before `done`, when there are any.                                    |
| `done`     | `{ finish: "stop" \| "length" \| "error" }` | The stream ends; `length` means the token cap hit. (What happens to a proposal is the teacher's decision after the stream — the server never applies.) |
| `error`    | `{ message, code }`                         | Mapped, i18n-able failure: `unreachable` or `status` from the provider call, `internal` otherwise. (Pre-stream failures — validation, permissions, not configured, quota, rate limit — are ordinary JSON errors.) |

Errors before the stream starts (validation, permissions, not configured)
are ordinary JSON errors like every other route's, so `unwrap()` and the
existing error toast handle them.

## The agent: how the assistant sees the whole book

`src/server/ai/agent.ts`. Three layers of book context and change:

**1. Baseline context — every request, no tools needed.** The route reads
from the book's git repository (`repoDir(config, book.id)`, `headCommit`,
`listTree`, `readBlob` — the same helpers `routes/files.ts` uses):

- the file tree (paths and sizes),
- `hyperbook.json` (book name, language, configured elements),
- the current page's Markdown (from the request's `context`/`selection`, so
  unsaved edits are included; the server does not re-read the file for it).

**2. Tools — the model asks for more, the loop is bounded.** The provider
request carries OpenAI-style `tools`:

- `list_files()` — the tree from the baseline context, as a tool result for
  models that prefer to ask.
- `read_file(path)` — reads one file from the repository. The path is
  validated with the same `bookPath` schema the files route uses (no
  traversal, no absolute paths), and capped: 32 KiB per read, 256 KiB total
  per request, only text-looking files (`.md`, `.json`, `.yaml`, code
  extensions the build knows; never binaries).

**3. Changing tools — collected, not applied.** `write_file(path, content)`
records a create-or-edit; `delete_file(path)` records a deletion. Both work
onto an **in-memory overlay** the request owns: later `read_file` and
`list_files` answers see the overlay, so the agent can write a quiz file,
re-read the page, and fix the link to it in the same request. Nothing
touches the repository — the overlay is thrown away with the request.

Caps on proposals: at most 10 files, text files only (the same extension
list as `read_file`), 32 KiB per file, 256 KiB total; `bookPath` validates
every path; `delete_file` requires a file the baseline tree knows; writing
`hyperbook.json` or `hyperlibrary.json` is allowed but the normal commit-time
JSON check still guards it when the teacher accepts. Two files whose content
cannot be diffed are not proposed for writing (a committed file over 128 KiB
is refused with a tool error — it would otherwise show as a "new file");
deleting a large or binary file is allowed, but its `oldText`/`diff` are
empty/a note, so no bytes are shipped. A repeated `write_file` to one path
diffs against what the file held when the request first touched it, not
against the previous write. At the end the route emits one `proposal` event:

```ts
type AiProposedChange =
  | {
      op: "write";
      path: string;
      oldText: string | null;
      newText: string;
      baseOid: string | null;
    }
  | { op: "delete"; path: string; oldText: string; baseOid: string };
```

`oldText`/`newText` are for the diff view (old is what the repo held, or the
editor's unsaved page text, before the change); `baseOid` is the commit's
file oid the change is based on — it is what makes accepting conflict-safe.

The loop runs at most `config.ai.maxSteps` provider calls per request. Each
call streams: content deltas become `delta` events, `tool_calls` become one
`tool` event each, the tool's result goes into the next call. If the
provider rejects the `tools` field outright (small local models), the agent
retries the request once **without tools** — the assistant then works with
the baseline context only, degraded but functional (and without the changing
tools: no proposals, text-only answers).

A later slice adds a `search_book(query)` tool for large books: `git grep`
against the head commit — the repository layer gives it for free — with
the same read caps as `read_file`. The loop's structure already has a
place for it.

## The system prompt

`src/server/ai/prompt.ts` _(in place since slice 1)_ — a curated constant, so
it is bundled into the server like the rest of the code. This is what makes
the assistant write _hyperbook_, not generic Markdown:

- the page conventions: `book/`, `glossary/`, `public/`, frontmatter
  (`title`, `description`), links and routes (a link to `book/foo/bar.md`
  addresses `/foo/bar`; index pages are their folder), glossary terms;
- the directive vocabulary: `pyide`, `quiz`, `code`, `term`, `video`,
  `bitflow`, `learningmap`, `struktolab`, `jmp`, `sqlide`, `excalidraw`,
  `…`, with the attributes that reference book files (`src`, `db`, `poster`,
  …), and the rule that files named there must exist (the editor shows what
  they are);
- the output rules: answer with page Markdown only — no surrounding code
  fences, no meta commentary; write in the
  book's `language`; keep the hyperbook voice (address the reader, short
  paragraphs, progressive tasks);
- tool guidance: look at sibling pages to match tone and cross-linking
  before writing (`list_files`, `read_file`); when the answer needs new or
  changed files, use `write_file`/`delete_file` and link them from the page
  in the same request — the teacher reviews everything as a diff, so favor
  complete, self-consistent proposals.

Sources of truth, kept in step by tests: the directive list must match the
editor's `src/web/pages/editor/directives.ts` (a test extracts the directive
names from the prompt and compares), and the conventions must not
contradict `website/en/book/markdown` and `…/elements` — reviewed when
the docs change. Curated by hand; a generator script is deliberately _not_
built (docs prose is not prompt material).

## Frontend

`src/web/pages/editor/ai-panel.tsx`, a pane beside the CodeMirror editor
_(in place since slice 2: a toolbar button and Ctrl/Cmd+Alt+A toggle it, the
width is remembered like the preview's)_, plus `src/web/lib/ai.ts` for the
streaming client:

- The panel shows the model name, the day's requests (`usedToday` of
  `quota`, from the status route) and a single prompt field with an _Ask_
  button (Enter sends too). Every request sends the open page and the current
  selection along, so "improve the highlighted text" works without a dedicated
  button; page changes come back as a proposal whose diff view stays re-openable
  until the next message. Every request
  reads the open tab's editor at click time — the editor hands the panel the
  active tab's view through a path-keyed map (`onView` on `TabContent`).
- Streaming uses plain `fetch` (the `hc` client cannot stream) and reads the
  SSE body; the request body is typed from `aiAssistInput`.
- `delta` events render live in a result area; `tool` events as a quiet
  progress line ("Reading book/lists.md …", "Writing quiz/lists.json …").
- **Text answers are never applied automatically**: the teacher gets
  _Insert at cursor_ / _Replace selection_ / _Copy_ / _Discard_. Applying
  dispatches a CodeMirror transaction; saving then goes through the normal
  git commit (`commitChanges`), so AI edits are ordinary commits with an
  ordinary author.
- **A `proposal` event opens the review dialog** (`ai-diff-dialog.tsx`):
  every changed file as a unified diff, computed by the git layer itself —
  a `diffChange(change)` helper in
  `src/server/hosting/git.ts` runs `git diff --no-index` on two temp files
  (exit code 1 means _files differ_, not failure). No hand-written diff
  algorithm, no new dependency, git's own diff quality. New files are
  marked _new_, deletions diff against the empty file.
  Each file has an accept/deny toggle (all on by default), with the dialog's
  global _Accept_ applying exactly the accepted subset — or _Deny_, which
  changes nothing. Two things the dialog adds for deletions, reusing what
  the editor already has: `fetchReferences` shows which pages link to the
  file, and `FILE_DIRECTIVE_ATTRIBUTES` covers the directive attributes —
  so "deleting `public/diagram.svg` breaks 3 links" is visible before
  accepting.
- **Applying a proposal** maps 1:1 onto the existing `fileChange` shapes:
  accepted changes for files _other than the currently open page_ are sent
  as one `POST /api/books/:id/files/commit` (`commitFilesInput`, the same endpoint
  the editor saves through) — one git commit, the teacher as author, a
  message the dialog drafts from the proposal ("AI: add quiz for lists,
  link it in book/lists.md"). A change to the _open_ page is instead applied
  locally in CodeMirror, so the teacher's unsaved edits stay in control of
  their own buffer, and saving happens through the normal flow. A 409
  (`ChangeConflictError`: the file changed since `baseOid`, e.g. a
  colleague saved) applies nothing — the dialog offers re-running the
  request; the `baseOid` the agent saw is what makes this safe. Quotas and
  the root-config JSON check are enforced by that same commit path, not by
  the agent.
- Errors map to toasts via the existing `ApiError` handling; a
  `rate_limited` answer disables the send button for the remaining window.
- i18n: new keys in `src/shared/i18n/locales/en.ts` under an `ai` area,
  mirrored in `de.ts` (the parity test fails otherwise).

## Privacy, limits, audit

- **Provider sees book content.** The instance's admin chooses the provider
  (Mistral, or local Ollama where nothing leaves the school) and must
  mention it in the instance's privacy policy — documented in the README
  section this plan adds.
- **Nothing is stored**: no conversations, no outputs, no prompt logging
  beyond the audit entry.
- **Audit** (`src/server/audit.ts`): one `ai.assist` entry per request —
  actor, book, `{ action, page, model, steps, finish, proposedChanges: n }`
  (the count only; applying is an ordinary file commit with its own audit
  trail). Content is never recorded, matching the "never store
  secrets/content" rule.
- **Limits**: three layers. The entitlements (`ai`, `ai_requests_per_day`)
  decide whether the teacher may use the assistant at all and how many
  requests a UTC day buys them — counted in an `ai_usage` table when a
  request is accepted (a provider that then fails has been asked all the
  same), so a quota is enforced state, not audit-log history. The per-user
  in-memory token bucket (`requestsPerMinute`) stops a runaway editor
  within the minute. The schema caps inputs, the provider call caps
  `maxOutputTokens` and `timeoutMs`, the loop caps `maxSteps`, the tools cap
  their reads. The body-limit middleware guards the route like the files
  route.

## Tests

- **Config**: `AI_*` all-or-nothing, URL validation, defaults, off-state.
- **Agent, against a fake provider**: a Hono stub in `tests/` that speaks
  chat-completions over SSE and scripts tool calls — covering the loop,
  the caps, the `tool`/`delta` events, the overlay (a written file read back
  in the same request shows the new content), the proposal event's shape,
  the no-tools fallback, provider failure and timeout.
- **Route**: permissions (`bookAccess`), unconfigured 503, validation
  errors, rate limit, and that `read_file`/`write_file`/`delete_file` refuse
  paths `bookPath` rejects, exceed the proposal caps, or delete unknown
  files.
- **Diff helper**: `git diff --no-index` through the new `diffChange`, against
  hand-written cases (shared lines, moves, empty files, unicode).
- **Apply flow**: accepting a proposal produces the expected single commit
  (and a 409 leaves the repo untouched) — unit-tested against a tmpdir repo,
  plus the review dialog in the e2e run.
- **E2E** (per `AGENTS.md`: fresh `mkdtemp`, ephemeral port, never the real
  database): status + one assist round-trip against the fake provider.
- **Prompt parity**: the directive names in `prompt.ts` match the editor's
  `directives.ts`.
- Keep `scripts/guard-test-safety.mjs` green.

## Work order (each step one PR-sized change)

1. **Server foundation** _(done)_: config (`AI_*`), `GET /api/ai`, the
   provider client (`src/server/ai/provider.ts`), baseline context,
   SSE route with the four actions, rate limit, audit, and the first
   system prompt (`src/server/ai/prompt.ts`). Fake-provider unit tests;
   no UI yet — exercised by tests.
   1a. **Per-user control** _(done)_: the `ai` and `ai_requests_per_day`
   entitlements (user page and instance defaults, through the existing
   entitlements editor), the `ai_usage` counter table with its migration,
   enforcement in the route, and `allowed`/`usedToday`/`quota` in the
   status.
2. **Editor UI** _(done)_: streaming client (`src/web/lib/ai.ts`, with
   its own parsing tests), panel, actions, apply/discard flow, i18n (en +
   de, the new `editor.ai` area). E2E test against the built server and a
   fake provider (`tests/e2e/ai-assistant.e2e.ts`).
3. **Read tools** _(done)_: the agent loop with `list_files`/`read_file`, `tool`
   events in the UI, the no-tools fallback. Unit tests for the loop.
4. **File proposals** _(done)_: the overlay, `write_file`/`delete_file`, the
   `proposal` event, `diffChange` in the git layer, the review dialog, the apply
   flow through `commitFilesInput` (open page locally, the rest as one
   commit), the references warning for deletions. Unit + e2e tests.
5. **System prompt + docs** _(done)_: the directive parity test against
   `directives.ts` (`prompt.ts` exists since slice 1), README section
   (Mistral and Ollama first, others listed), privacy-policy note,
   a changeset.

## Out of scope for now

- **Per-teacher keys (BYO)** — later as an encrypted `users` column behind
  an admin toggle, resolved server-side _after_ the instance key. The
  credential seam is the provider client, so it stays a small change.
- **Moves and renames** as a proposal operation (delete + create works;
  a real move would also rewrite references, like the editor's refactor
  flow does — worth its own slice).
- Per-proposal branching or a second review round (accept once, done).
- `search_book` tool, dedicated generators (`generate-quiz`, `translate`),
  conversation memory, and any use of AI on book hosts (never).
