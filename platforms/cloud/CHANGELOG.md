# @hyperbook/cloud

## 0.5.1

### Patch Changes

- [`d7e75a6`](https://github.com/openpatch/hyperbook/commit/d7e75a674aefb0d492110012519cce4bef28ccb6) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Editor: a History pane shows the book's commits — every save, upload and push is one — with its author, date, message and line counts (+/−, binary files aside). The list is paged from the server (a book can have many commits) and can be narrowed to the changes of the open file. Clicking a commit shows its diff in a dialog; commits never change, so each diff is fetched once and carries its sha as the ETag. The pane joins the editor next to the AI assistant and the preview, resizable like they are, in English and German.

- [`e025c5f`](https://github.com/openpatch/hyperbook/commit/e025c5f00f3403e911c82a82d3565fe3fc22bd91) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Editor: the file sidebar's filter is fuzzy now, like quick open (Ctrl/Cmd+P): typing finds files whose characters appear in the path in order, ranked by fzf's scoring — matches at word boundaries and in the file name first — and the matched characters are highlighted in the results, readable in dark mode too.

- [`b1bdc30`](https://github.com/openpatch/hyperbook/commit/b1bdc30d6d39d45614cb80bb56f62f6d78c2de26) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Editor: the quick open dialog's search (Ctrl/Cmd+P) is now fuzzy, powered by a port of fzf's V2 algorithm (fzf's "path" scheme): a query matches a path when all its characters appear in it in order, so "sovh" finds "sortierverfahren.md" without typing the whole word. Results are ranked with fzf's scoring — matches at word boundaries, consecutive characters, and camelCase humps score best, with fzf's default tiebreaks — plus one file-picker rule: matches in the file name outrank matches in a folder. The matched characters are highlighted wherever they sit, in the file name or in a folder, readable in dark mode too.

- [`5fd7344`](https://github.com/openpatch/hyperbook/commit/5fd7344d6a8c2fac9c6b776e03a26d71a14b2988) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Editor: the quick open dialog (Ctrl/Cmd+P) is now usable on books with long file paths, like hyperbook-informatik. The dialog grew from 28rem to up to 48rem wide, each row leads with the file name in bold followed by the directory in a dimmer color, and when a path still does not fit, the directory is clipped from the left so the folders next to the file stay visible. The characters the query matched are highlighted — readable in dark mode too — and the "open" badge no longer gets cut off.

- [`9809715`](https://github.com/openpatch/hyperbook/commit/980971526ed7edfb4c96a2f6589c4e75c3ff12c3) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Editor: the file tree no longer slows the editor down on large books. Toggling a folder or typing in the filter re-renders only the sidebar instead of the whole editor, tree rows are memoized, and the tree is built without repeated sibling scans. The tree is now virtualized, so only the rows near the viewport are in the DOM however big the book is, and the filter renders from a deferred value so typing stays responsive even with thousands of matches. Quick open's list is memoized the same way. Folders now start collapsed, so a large book opens quickly and stays clear until unfolded.

- [`aed7a3c`](https://github.com/openpatch/hyperbook/commit/aed7a3cf741df232d2f7ee6a98d4efaf70e349ce) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Preview rendering is no longer slow on large books. A page render of the editor's preview re-read and re-parsed every page of the book (three times over, plus a regex scan of every page per glossary term); pages and hyperbook.json are now cached by their modification times, the glossary's references are collected in one scan per page, and the directory walks stat only what they must. A save no longer re-checks out every file of the book: the preview's checkout is brought to the new commit by writing only what changed, which also keeps the caches warm. For a 4,000-file book, a preview render drops from ~4 s to ~0.3 s, and the checkout behind a save from rewriting every file to writing the one that changed.

## 0.5.0

### Minor Changes

- [`82e9240`](https://github.com/openpatch/hyperbook/commit/82e9240e6a51c212fd8f7629a685a028c91dcb27) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - AI assistant: model costs are entered as provider prices (€/M tokens) in the instance settings, with a configurable credit value (1 credit = X €) and buffer; quota weights are derived from them. A "Fetch prices" button prefills the fields from the provider's /models pricing or a models.dev catalog. The editor's model picker sorts by cost, shows precise weights, and the admin hints explain the cached-token rule and the credit value dynamically. Also fixes the preview build button staying disabled for newly created books (source is now "main has commits", not "a build exists").

## 0.4.0

### Minor Changes

- [`6401d09`](https://github.com/openpatch/hyperbook/commit/6401d09975371af9aef8a8f8678d50d5c33f44e4) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The AI assistant's editor panel is now a chat: requests on the right, answers on
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

- [`6401d09`](https://github.com/openpatch/hyperbook/commit/6401d09975371af9aef8a8f8678d50d5c33f44e4) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The editor of Hyperbook Cloud has an AI writing assistant. It knows the
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
  See `platforms/cloud/docs/cloud-ai-assistant.md`.

- [`1c1cee1`](https://github.com/openpatch/hyperbook/commit/1c1cee14dffaab8c7c86595821c8967cdd1688bb) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The AI assistant now uses provider prompt caching and meters tokens per
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

- [`1fbafea`](https://github.com/openpatch/hyperbook/commit/1fbafea296cb0757f8bbbf327af97db905f629b3) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The AI assistant gained two tools. `search_files` searches all the book's
  text files (pending proposals included) with a regular expression and
  reports matching lines as `path:line: text`, capped per request and per
  search; binary and oversized files are skipped and reported. `rename_file`
  moves a text file to a new path as one proposal change — the old path
  deleted, the new one created with the same content — instead of a delete
  plus a write. The system prompt now tells the model to search before
  changing and to update links to a renamed file's old path in the same
  request.

- [`8f8ba2c`](https://github.com/openpatch/hyperbook/commit/8f8ba2c6cb1bb6c3c0ac0e2a6eda842675985b9d) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The AI assistant now meters usage in tokens and enforces a weekly credit
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

- [`2985e75`](https://github.com/openpatch/hyperbook/commit/2985e75ed0569aa02e428854e13253036d40e064) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Blockflow projects get visual editors in Hyperbook Cloud, on the blockflow v0.2.0 runtime. A `.sb3` file opens in blockflow's embed editor (`embed-editor.html`) and a `.blockflow` project file in the embed generator (`embed-generator.html`); both are served on the admin origin at `/blockflow/*` from the runtime bundle extracted per Hyperbook version (the same bytes the books render with), under their own Content-Security-Policy, and the editor frame talks blockflow's embed protocol (`ready`/`load`/`change`/`save`/`saved`/`error`) instead of touching the editor's VM. "Edit visually" in a page now also works on `::blockflow-player{src=…}` and `::::blockflow-editor{src=…}`/`{project=…}`. A `.sb3` travels base64-encoded and saves with `encoding: "base64"`, a `.blockflow` is plain JSON; both validate before saving, and "New file" offers starters for them. `@hyperbook/markdown` pins `blockflow-v0.2.0`, whose bundle adds the embed entries and a `manifest.json` (version, commit, entries) that a test asserts.

- [`b13dbe1`](https://github.com/openpatch/hyperbook/commit/b13dbe1f3e15d84f34710df1c86c7188f4f1f295) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Hyperbook Cloud now speaks English and German. The language of the pages, API errors and emails is the signed-in user's choice (Your account → Language), else the instance default (Settings → General → Language, "Automatic" follows the browser), else the browser's `Accept-Language`; visitors' choice is kept in the browser, and `<html lang>` is set before the first paint. All emails — address verification, password reset, invitations, sign-up notifications, address decisions — go out in the recipient's language, and form validation messages translate with the UI. The catalogs live in `src/shared/i18n/locales/` (shared by web, API and emails, with typed keys and a test that keeps `de` complete); the auth pages, app shell, landing page and account page are translated, the editor and the remaining admin pages follow area by area.

- [`86ed9dc`](https://github.com/openpatch/hyperbook/commit/86ed9dca6e272f9198a74bd91b5397035b52ec81) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Books can now be worked on locally with git: `git clone https://git@<admin host>/api/books/<id>/git`, edit, and `git push` to `main`. The push is served by git smart HTTP on the admin origin with per-book API tokens (hash-only, revocable, shown once; Basic auth, username `git`), enforced to a single `main` branch by a pre-receive hook that also applies the storage quota to the pushed tree; deletes, other refs, tags and non-fast-forwards are rejected. A push never triggers a publish build — it only updates the source size, the audit log (`book.push`) and the new `commit_count`; the instance setting "a git push also builds the preview" (default off) additionally queues a preview-only build. Publishing is recorded as version tags (`v1`, `v2`, … plus a moving `published` tag; only the last two are kept, an optional note is stored on the build) and the live site can be rolled back to a tag — instantly when its build is still kept, otherwise by rebuilding it. The book page gained a "Work locally (git)" block with the clone command and token management, a publish note, rollback buttons on tagged builds, and a staleness hint ("main is N commits ahead of the live site"). Editor saves keep their CAS semantics against pushes: a save based on a pre-push version is refused with a conflict, a push after an editor commit is non-fast-forward.

- [`022f42c`](https://github.com/openpatch/hyperbook/commit/022f42cd4c8392a59a37769da24f791545e09218) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The AI models are now picked in the admin settings instead of the
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

- [`0a4ac64`](https://github.com/openpatch/hyperbook/commit/0a4ac646fd0c38f9e2d7e9d876837fd5fee222e0) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Hyperbook Cloud no longer copies the element runtimes (Pyodide, Excalidraw, GeoGebra, ... — about 500 MB together) into every build of every book. It extracts them once per Hyperbook version and serves them to every book at `/_hyperbook/assets/<version>/`, with a year of immutable caching. Books whose `elements.*.cdn` is unset or `true` link there instead of a public CDN; `false` (a local copy) and custom URLs keep their meaning. Under Settings → Element runtimes, admins choose per element whether books load its runtime from the instance or from the element's public CDN. Hosts other than Hyperbook Cloud get the same mechanism through `HYPERBOOK_SHARED_ASSETS_BASE` and `HYPERBOOK_CDN_ELEMENTS`; builds without them are unchanged. The build sandbox also keeps an asset cache between builds now, so books that ask for local runtimes are not unpacked again for every build.

### Patch Changes

- [`b61fdb4`](https://github.com/openpatch/hyperbook/commit/b61fdb4792c69f3c89154fdb90e30f2a8fb71b2d) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Update `@bitflow/web-component` to 0.4.0 (from 0.3.1), which builds on
  `@bitflow/core` 0.9.0. The public element surface is unchanged —
  `<bitflow-flow>`, `<bitflow-flow-editor>`, `<bitflow-report>`,
  `<bitflow-group-report>` and the `bitflow-*` events — so the bundled
  `directive-bitflow` assets are refreshed with the new chunks and no
  integration code changes were needed.

- [`be511a3`](https://github.com/openpatch/hyperbook/commit/be511a3555376747c42d726397f0dc32e41e09d0) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Update `@bitflow/web-component` to 0.4.1 (from 0.4.0). The editor's graph chrome — React Flow's zoom buttons, minimap, dotted background and edges — now derives its `colorMode` from the container's used `color-scheme`, the same one bitflow's own `light-dark()` palette resolves against, and follows the host's theme changes. Before, the chrome stayed light whatever the host, so a dark page or a dark editor frame had light zoom buttons and a white minimap on the dark canvas. The element and event surface is unchanged, so no integration code changes were needed.

- [`022f42c`](https://github.com/openpatch/hyperbook/commit/022f42cd4c8392a59a37769da24f791545e09218) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The AI assistant no longer fails with an "empty provider answer" on
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

- [`dfa0db1`](https://github.com/openpatch/hyperbook/commit/dfa0db129f76b7d7c49efee11cbcb361f2e4aa3c) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Code files in the editor (Java, Python, SQL, …) now use the theme's `--hl-*` syntax colors, which switch with light and dark mode. Before, they fell back to CodeMirror's light-only default highlight style, so e.g. Java source was hard to read in dark mode.

- [`87d95f5`](https://github.com/openpatch/hyperbook/commit/87d95f50bdd5792935d6f839655ce45419eeb5b0) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Further hardening of the git smart HTTP endpoints and storage accounting.
  Git child processes (upload-pack/receive-pack and the post-push `git gc`) are
  killed after `GIT_OP_TIMEOUT_SECONDS` (default 300) and answered with 504, so
  a stuck operation cannot hold a process forever. Per-book git traffic that
  exceeds the operation limit now gets a 429 with `Retry-After` instead of a
  401, and anonymous auth probes — every git client sends one to get the
  challenge — no longer count as failed logins; the failure limiter is also
  bounded (10k keys, expired entries swept, oldest evicted) since its keys are
  attacker-chosen. The pre-receive hook now also rejects pushes whose whole
  repository — including the quarantined pack of the push itself — exceeds the
  book's storage quota, and a `git gc --prune=now` after each successful push
  reclaims objects of deleted files. Reusing an already-publishing build with a
  new note keeps that note, and the publish-note plumbing no longer drops it.

- [`9dbaa4f`](https://github.com/openpatch/hyperbook/commit/9dbaa4f09efa28c64501d989952274fba17e97a2) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Hardened the git smart HTTP endpoints and build bookkeeping. Gzip-encoded
  request bodies are now accepted for clone/fetch (upload-pack) and push
  (receive-pack); other content encodings are rejected with 415. Oversized
  pushes are cut off mid-stream with a 413 and no longer crash the git service.
  Concurrent pushes to the same book are serialized with the book lock, and
  post-push accounting (source bytes, commit count, audit log, optional preview
  build) now verifies the pushed commit is reachable from `main` instead of
  comparing it to the branch head. The pre-receive hook is only rewritten when
  it actually changed (atomic temp-file rename), and a failed git tag update or
  build cleanup after a successful publish no longer marks the build as failed —
  the problem is recorded as a warning in the build log instead.

- [`840da81`](https://github.com/openpatch/hyperbook/commit/840da81cc9849ac14172c3745beff75da462ce1d) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The visual editors' frame follows the theme again, and keeps following it when it changes. It now declares a `color-scheme` per theme and loads the light design tokens, which the dark ones build on — without them bitflow resolved its whole `light-dark()` palette light whatever the theme, so in dark mode its editor came out as white cards with near-invisible text on the dark canvas. The frame also gets the app's page font and colours, and the iframe behind it is no longer hardcoded white while an editor loads. Toggling the theme now reaches the frame live (through the same `storage` event that keeps tabs in step) instead of only when it first opens.

- [`1cb7980`](https://github.com/openpatch/hyperbook/commit/1cb7980d32073d4840c783b0dc58d78db003a152) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Update dependencies across the workspace to their latest versions
  (`pnpm update -r --latest`), including @types/node 26.6.6, webpack 5.112.2,
  vite ^8.3.5, react ^19.3.1, mermaid 12.2.0, chokidar 6.0.0, sass 1.107.0,
  shiki ^4.5.0, struktolab 0.6.3, and many more.

  Three upgrades were intentionally kept back:

  - TypeScript stays on 6.0.3 (7 is the native port without the JS API the
    code uses); @hyperbook/cloud keeps its existing ^7.0.2.
  - @types/vscode stays pinned at 1.125.0 (disabled in renovate.json, and
    @vscode/vsce rejects newer types against engines.vscode ^1.125.0).
  - vitest stays on ^4.1.10 outside @hyperbook/cloud (vitest 5 drops `.not`
    from the Assertion type and breaks `tsc --noEmit` on existing tests).

  The p5 completions in @hyperbook/markdown were regenerated with
  `pnpm p5:completions` for p5 2.3.4. Nothing changes in what a hyperbook
  renders.

## 0.3.0

### Minor Changes

- [`29932e4`](https://github.com/openpatch/hyperbook/commit/29932e4fd84837c218fb935dc6e119e56d559ff9) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The editor's settings menu gets a font choice: the system's monospace or one of GitHub's Monaspace fonts — Neon, Argon, Xenon, Radon or Krypton. Each choice is drawn in its own font, and the choice is kept in the browser like the other editor settings.

- [`6173ca1`](https://github.com/openpatch/hyperbook/commit/6173ca1ee473fd36003106d2d818fce9e42d4e11) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The editor highlights more file types: Java, Python, SQL (with SQLite keywords, matching the sqlide element), Typst, plus `jsx`/`tsx`/`cjs` and `htm`/`xhtml`, and it highlights Typst code blocks inside pages. Pages ending in `.md.hbs` count as Markdown pages for spell check, and the new-file dialog mentions them. Builds and renders mark the checkout as the book's project root, so the `rfile`/`rbase64` helpers find the book's root files in the cloud too.

- [`cdfed33`](https://github.com/openpatch/hyperbook/commit/cdfed33f70686edd294ce8021a72d2675dc69223) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The editor's settings menu gets a line height choice, next to the font size: small, medium or large, shown as S, M and L. The choice is kept in the browser like the other editor settings.

- [`78005e2`](https://github.com/openpatch/hyperbook/commit/78005e2f6dd03b4debafa9135c54dbb04a679e06) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The editor gets a quick-open popup (Ctrl/Cmd+P) to search the book's files, a file tree that filters, unfolds the open file and moves files by dragging them into folders, a settings menu with font size, line numbers and spell check, and a per-book spell-check dictionary: Hunspell via Typo.js, aware of pages' code, frontmatter and directive syntax, with right-click suggestions and words to add or remove. A right-click opens the editor's own context menu — cut, copy, paste, select all, undo and redo — instead of the browser's; on a misspelled word it shows the corrections and "Add to dictionary".

- [`3be21d1`](https://github.com/openpatch/hyperbook/commit/3be21d102c86e20f1c1c4d286c257ee4f755bbbd) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Path completion offers paths relative to the page next to those from the book's root, in links, images and directives' file attributes. A click on a link in the preview opens its file in the editor.

- [`7a3eaea`](https://github.com/openpatch/hyperbook/commit/7a3eaea3473dd77ffcd2ace53de429a40199326c) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The file tree gets a right-click menu in place of its "…" buttons: new file, new folder, upload, download, cut, copy, paste, rename and delete. Rename asks for the name only; moving is dragging, or cut and paste.

### Patch Changes

- [`d962440`](https://github.com/openpatch/hyperbook/commit/d9624408370a2ff7b6c61a2a3eac7f6316ee73d8) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Every part of a page is a card of its own, with a border like the books on the home page, instead of one long column of loose sections. A book's page arranges them in a grid: publishing, people and delete take the full width, the forms share rows, and the address line in the heading says whether the book is published. The delete card is tinted as the danger it is. The navigation is slimmer and the pages wider, so the cards have room to breathe.

- [`b4c9697`](https://github.com/openpatch/hyperbook/commit/b4c9697c4c86b0d5c9943e504de105804c63a79c) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The page settings get a calmer place in the editor. The frontmatter bar sits flush with the editor — no rounded corners or gap around it, just its bottom border — and the hint "Type : at the start of a line for elements" above pages is gone. The page settings and book settings popups are wider and structured into groups — General, Navigation, Appearance, Advanced and Protect the page for pages; General, Author & license, Branding, Advanced and Features for the book — in two columns, so related settings sit side by side instead of in one long list. The page settings can also remove a page's jumps: a "None" next to the previous and next page writes `prev: null` or `next: null`, so the page shows no such button.

- [`075917b`](https://github.com/openpatch/hyperbook/commit/075917b5f19d4410e4021eebc4e5440217df11b6) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The editor's panes are resizable: drag the borders between the file list, the editor and the preview to size them, or use the arrow keys; double-click a border to restore the default. The chosen widths are remembered per browser.

- [`a38c996`](https://github.com/openpatch/hyperbook/commit/a38c996ddaf5592e00873fe4ca52501bc4b5cbb2) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The branding section of the editor's book settings has an upload button next to the logo picker. It puts the image into the public folder and selects it as the logo, so a logo can be set without uploading the file through the file tree first.

- [`16c11d3`](https://github.com/openpatch/hyperbook/commit/16c11d31bbe33ff5155ee290719d64c08191b2a0) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The front address of an instance now shows a landing page: a short introduction to Hyperbook and the three ways to run it — hosted on hyperbook.cloud by OpenPatch (with a "Create an account" button when the admin's sign-up mode allows it), self-hosted with the one-container Docker setup, or deployed anywhere as a static site with the Hyperbook CLI — plus a login link for the admin frontend and the usual "Built with ❤️ by OpenPatch" footer. Logged-in users go straight to their books. Under Settings → General, admins can turn the landing page off (`landingPage`); then the front address shows only the login screen.

- [`7d942a6`](https://github.com/openpatch/hyperbook/commit/7d942a6bbf5ea92cb9db3c71da45a525157caf27) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The editor's preview pane shows the whole page — header, navigation and footer — like readers will see it. Pages in an iframe used to switch to standalone (content-only) mode automatically; a new `standalone=false` URL parameter keeps the shell, and the preview pane adds it to every page it frames.

- [`4e48036`](https://github.com/openpatch/hyperbook/commit/4e48036d1a549a4a10aa54f8e00042f7233077d7) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Renaming or moving an image or other file that sits next to the pages in book/ now finds and updates the links to it, including relative ones like `./image.png`. Relative links stay relative after the rewrite, and a link's `#fragment` is no longer doubled.

- [`4648248`](https://github.com/openpatch/hyperbook/commit/46482485317d68539e6f899c2102ad8aa7802c95) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Links that an upload leaves out (symlinks in the zip) are now traceable: the full list is recorded in the build's log, the warning toast links to that log, and any build log can be downloaded as a file.

- [`4648248`](https://github.com/openpatch/hyperbook/commit/46482485317d68539e6f899c2102ad8aa7802c95) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Uploading a book as a zip shows a progress bar with the percentage sent and an "Unpacking…" state while the server processes it.

## 0.2.2

### Patch Changes

- [`32ffbb4`](https://github.com/openpatch/hyperbook/commit/32ffbb4a35886d6676ce58420c014b6b9687185d) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Rename the build's "Website" link to "Download" and name the archive `<slug>.zip`.

- [`6ea0bf4`](https://github.com/openpatch/hyperbook/commit/6ea0bf474a0f014bbfff59cd65384e9243868837) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The light/dark choice applies from the first paint also where a Content-Security-Policy forbids inline scripts, so the toggle and the page no longer disagree after loading. The editor's preview follows the chosen theme, and switches with it.

## 0.2.1

### Patch Changes

- [`cd9aaee`](https://github.com/openpatch/hyperbook/commit/cd9aaee0d13a620857b69ac61da0096faa40fc01) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Hyperbook Cloud looks like a book: the sidebar fills the window height with "Power your Hyperbook" and the version at its foot, the navigation is styled like a book's, narrow screens get the sidebar as a drawer, and a toggle switches between light and dark mode.

- [`fcb8c71`](https://github.com/openpatch/hyperbook/commit/fcb8c71681c516f41b8f0fecd95129db16df4048) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The editor keeps up with typing on long pages, and its preview updates without flickering: a keystroke no longer re-renders the whole editor, the preview renders one page at a time, and the new page loads underneath the shown one and takes its place at the reader's scroll position once it is painted.

## 0.2.0

### Minor Changes

- [`e01d54f`](https://github.com/openpatch/hyperbook/commit/e01d54fdf6183b55bff24c77f61223494a56e5c7) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - `hyperbook render` renders single pages on request (JSON lines on stdin) without a full build, for editors that preview a page while it is written. Hyperbook Cloud uses it: the editor's preview shows the open page with its unsaved text as you type, and saving no longer builds the book. The editor also completes elements and their attributes, highlights them, links to their documentation, checks them, and edits a page's frontmatter as a form.

### Patch Changes

- [`6d807d8`](https://github.com/openpatch/hyperbook/commit/6d807d8346752b88993c7b51a9570de536937d4f) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The sidebar shows which version of Hyperbook Cloud runs: its version, the build number and the commit it was built from.

## 0.1.1

### Patch Changes

- [#1172](https://github.com/openpatch/hyperbook/pull/1172) [`b389c0b`](https://github.com/openpatch/hyperbook/commit/b389c0bc3dcc8846a86a21d7c727d053061f5cbf) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Restore pull-to-refresh and the collapsing address bar on mobile

  On narrow screens the shell no longer pins itself to the viewport. It scrolled
  the article pane inside a fixed grid, which left the document scroller
  motionless — and a mobile browser drives both pull-to-refresh and the
  auto-hiding address bar off that scroller, so neither ever fired. Below 1280px
  the layout now flows normally with a sticky header, so the document scrolls and
  both gestures work again. The desktop layout, where the sidebar needs to stay
  put while the article moves, is unchanged.

## 0.1.0

### Minor Changes

- [#1164](https://github.com/openpatch/hyperbook/pull/1164) [`87e7042`](https://github.com/openpatch/hyperbook/commit/87e7042b06523cbff6cddbd8ceb60c85075dea2a) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Update all dependencies to their latest versions

  Notable upgrades: Shiki 4, Mermaid 11.16, three.js 0.185, p5 2.3, Excalidraw 0.18.1, React 19.2, Express 5, TypeScript 6, ESLint 10 and Vite 8. Rendered output is unchanged.

  hyperbook-studio now requires VS Code 1.125.0 or newer.

## 0.0.2

### Patch Changes

- [`9df0010`](https://github.com/openpatch/hyperbook/commit/9df00101a871f9298664790411ee33ad81218d45) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Make the cloud server easier to run and safer to update:

  - Published as a container image per release. `docker compose up -d` is the
    whole deployment, and `docker compose pull && docker compose up -d` the whole
    update. An image tag is something to pin, which tracking `main` never was.
    `docker-compose.yml`, a `Dockerfile` and an `ecosystem.config.js` for
    non-container deployments are committed rather than pasted from the README.
  - The schema is versioned with `PRAGMA user_version` instead of re-deriving
    itself from `CREATE TABLE IF NOT EXISTS` and column probes on every boot.
    Each migration runs at most once, in order, and the version is recorded only
    after the step succeeds, so an interrupted upgrade retries rather than skips.
  - **The database is copied aside before any migration that has work to do**,
    with `VACUUM INTO`. If the copy cannot be written, the migration does not
    run. The five most recent backups are kept.
  - Starting a build older than the one that last wrote the database is refused,
    instead of silently reading a schema it does not understand.
  - In production the server refuses to start when `JWT_SECRET` is missing or
    still the placeholder, when it is shorter than 32 characters, when `BASE_URL`
    is unset, or when SMTP is half configured. It prints every problem at once
    and suggests a generated secret. Previously a deployment that forgot
    `JWT_SECRET` ran with a value published in this repository, and said nothing.
  - `engines` now records the Node versions `better-sqlite3` can be built
    against, so a mismatch fails at install rather than at `require`.

- [`d91255b`](https://github.com/openpatch/hyperbook/commit/d91255bb77ce954056c8caa7780a1e7048e60b9d) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix event replay corrupting the state it reconstructs:

  - The primary key is now parsed out of the Dexie schema string. Taking the
    first field verbatim left the markers on (`++id`, `&email`, `*tags`), so the
    key matched no row property at all and every update and delete missed
    silently while creates piled up duplicates. Compound keys (`[a+b]`) and
    outbound keys are handled too.
  - A created row can no longer end up without its primary key, which made it
    unreachable to every later event.
  - Primary keys keep their type. `prim_key` stored `String(primKey)`, flattening
    numeric and compound keys so they no longer matched the rows they addressed;
    events now also carry `prim_key_json`.
  - Replay is idempotent. `create` appended unconditionally, so a retried or
    replayed batch duplicated rows; it now upserts.
  - Dexie's dotted update paths (`update(id, {"state.zoom": 2})`) are applied to
    the nested field instead of being written as a literal `"state.zoom"`
    property.
  - Events carry the client's Dexie primary-key schema, so a table with no prior
    snapshot is no longer assumed to be keyed by `id`. Tables keyed by something
    else — `bookmarks` by `path`, `onlineide` by `scriptId` — had a bogus `id`
    stamped onto every row.
  - The `afterEventId` check and the append now share one transaction. Two
    clients writing at the same moment could both pass the check and interleave.
  - A malformed batch is rejected with 400 instead of failing a CHECK constraint
    and returning 500, which the client treated as transient and retried forever.

  Both new columns are added by migration; existing databases keep working.

## 0.0.1

### Patch Changes

- [`d98c9ca`](https://github.com/openpatch/hyperbook/commit/d98c9cac95017c0bfa098929218bc94ff758a906) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Move to an event driven architecture for hyperbook cloud
