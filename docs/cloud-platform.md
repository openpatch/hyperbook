# Hyperbook Cloud: hosted platform plan

Hyperbook Cloud becomes a self-hosted platform where teachers create, edit,
build and publish hyperbooks in the browser and manage the students who use
them. OpenPatch runs one public instance; schools run the same Docker image.

`platforms/cloud` is replaced in place. It has no users, so nothing is
migrated and no old API is kept.

## Decisions

| Topic | Decision |
|---|---|
| Deployment | One container, SQLite + one data volume. No Redis, no Postgres. |
| Book hosting | Wildcard subdomains: `<slug>.<BOOKS_DOMAIN>`. Docs recommend a separate registrable domain; a subdomain of the admin domain is allowed as a fallback. |
| TLS | Caddy examples: on-demand TLS (default) and wildcard DNS-01 (large instances). |
| Server | TypeScript, Hono on Node. |
| Frontend | React + Vite SPA for admin and editor. |
| UI | shadcn/ui, re-themed with Hyperbook's own tokens (see [Theme](#theme)). |
| Database | SQLite via Drizzle ORM, zod for validation. |
| Git | git CLI in the image, one repo per book (from M1). |
| Students | Belong to exactly one book. Anonymous generated usernames; no real names stored. |
| Student credentials | Password and QR login key stored encrypted (AES-256-GCM, key from env) so lists can be reprinted. Teacher/admin passwords are hashed and never shown. |
| Private books | Admin grants the `private_books` entitlement per user. Entitlements are the hook for a later subscription. |
| Student sessions on hosted books | HttpOnly cookie on the book's own host, API under `/_hyperbook/*` on that host (M2). Teachers and admins cannot log in on book hosts. |

## Milestones

- **M0 Foundations** *(done)*: rewrite skeleton, accounts, entitlements, books (metadata), groups, students, printable credentials. *This document details M0.*
- **M1 Hosting** *(done, see [M1](#m1-hosting))*: zip upload, sandboxed build in a child process, atomic publish, Host routing to built books, `tls-check` endpoint, Caddy examples.
- **M2 Student features** *(done, see [M2](#m2-student-features))*: `/_hyperbook/login` (password + QR), cookie sessions, event store (port `lib/eventSourcing.js` and its wire format), impersonation, private books, Bearer mode for externally hosted books, `cloud.js` same-origin mode.
- **M3 Editor** *(done, see [M3](#m3-editor))*: git-backed files, CodeMirror, uploads, preview on `<slug>--preview.<BOOKS_DOMAIN>`, settings forms, export, and visual editors for element files (struktolab, bitflow, learningmap, excalidraw, jmp, blockflow `.sb3`/`.blockflow`, and H5P upload only; see [M3: Visual editors](#m3-visual-editors-for-element-files)).
- **M4 Instance operations** *(done except the launch itself, see [M4](#m4-instance-operations))*: signup modes, quotas, legal pages, email verification, backup docs. Launch of the OpenPatch instance.
- **M5 Later**: OIDC, local runtime-asset mirror, custom domains (*done*, see [M5](#m5-custom-domains)), address suffixes and requests (*done*, see [M5](#m5-address-suffixes-and-name-requests)), sharing and forking.

---

# M0: Foundations

Goal: a running platform where an admin manages teachers and their
entitlements, and teachers create books, groups and anonymous student accounts
and print credential lists with QR codes. Nothing is hosted or built yet.

## Project layout

```
platforms/cloud/
  package.json            @hyperbook/cloud, "type": "module"
  vite.config.ts          builds src/web → dist/web
  drizzle.config.ts
  drizzle/                generated SQL migrations (committed)
  src/
    server/
      main.ts             load config, migrate (backup first), start server
      config.ts           zod schema for env; refuses to start when incomplete
      app.ts              Host dispatch: admin host → adminApp, book hosts → bookApp
      admin/              adminApp: /api/* routes + SPA fallback
        routes/           auth, me, users, books, members, groups, students, instance
      books/              bookApp: stub in M0 (404 "not published")
      db/                 schema.ts, client.ts, migrate.ts
      auth/               password.ts (scrypt), sessions.ts, guards.ts
      crypto/             sealed.ts (AES-256-GCM seal/open with key id)
      domain/             slug.ts (DNS label rules, reserved names), credentials.ts
      mail.ts             SMTP for password reset (optional)
    web/
      main.tsx, router.tsx
      api.ts              Hono RPC client (typed from server routes)
      components/ui/      shadcn components, themed
      pages/              login, books, book, group, print, users, user, instance, account
      app.css             maps shadcn variables to Hyperbook tokens
  tests/                  Vitest; API tests via app.request()
  Dockerfile, docker-compose.yml, .env.example, README.md
```

One Node process serves everything. In production Hono serves `dist/web` with
an SPA fallback; in development Vite proxies `/api` to Hono.

## Configuration

| Variable | Required in prod | Meaning |
|---|---|---|
| `ADMIN_ORIGIN` | yes | e.g. `https://cloud.example.org`. Admin UI and API. |
| `BOOKS_DOMAIN` | yes | e.g. `example.page`. Books live at `<slug>.<BOOKS_DOMAIN>`. |
| `CREDENTIALS_KEY` | yes | 32 bytes, base64. Encrypts student passwords and login keys. Without it, credential lists cannot be reprinted — document that it belongs in backups. |
| `DATA_DIR` | no | Default `/data`. Holds `database.sqlite` (and later `books/`). |
| `PORT` | no | Default `3001`. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | first run | Creates the first admin. |
| `SMTP_*` | no | All or none, as today. |

Development defaults: `ADMIN_ORIGIN=http://localhost:3001`,
`BOOKS_DOMAIN=books.localhost:3001`. Browsers resolve `*.localhost` to
loopback, so book subdomains work locally without DNS.

Startup refuses to run if `BOOKS_DOMAIN` equals or contains the admin host, or
if the admin host is itself a book host.

## Data model (Drizzle)

Teachers/admins and students are separate tables: they log in on different
hosts, with different credentials and lifetimes.

```
users             id, email (unique), password_hash, role ('admin'|'teacher'),
                  display_name, disabled_at, created_at
sessions          id_hash (sha256 of opaque token), user_id, expires_at,
                  last_seen_at, user_agent, created_at
password_resets   token_hash, user_id, expires_at, used_at
entitlements      user_id, key, value (json)          PK(user_id, key)
                  keys: private_books (bool), max_books (int),
                        max_storage_mb (int), custom_domain (bool)
instance_settings key, value (json)
                  default entitlements for new teachers, instance name, legal URLs

books             id, slug (unique), title, description,
                  visibility ('public'|'private'),
                  source ('hosted'|'external'), external_url,
                  created_by, created_at, updated_at
book_slugs        old_slug (PK), book_id                 redirects after renames
book_members      book_id, user_id, role ('owner'|'editor')   PK(book_id, user_id)

groups            id, book_id, name, created_at          UNIQUE(book_id, name)
students          id, book_id, group_id, username,
                  password_hash, password_sealed,
                  login_key_hash, login_key_sealed,
                  created_at, last_login_at
                  UNIQUE(book_id, username), UNIQUE(login_key_hash)

audit_log         id, actor_user_id, action, target_type, target_id, data, created_at
```

Notes:
- `students` has no name field on purpose.
- `*_hash` is used for login (scrypt for passwords, sha256 for the
  high-entropy login key); `*_sealed` only for printing. Sealed values carry a
  key id prefix so `CREDENTIALS_KEY` can be rotated later.
- Generated credentials use `crypto.randomInt` over
  `abcdefghjkmnpqrstuvwxyz23456789`.
- Store tables (`events`, `snapshots`) arrive in M2.

## Permissions

- **admin**: everything, including users, entitlements, instance settings.
- **teacher**: creates books (subject to `max_books`); sees only books they are a member of.
  - **owner**: everything on the book, including members, slug, visibility, delete.
  - **editor**: book content and settings except members/delete; manages groups and students.
- Setting `visibility = 'private'` requires the `private_books` entitlement of
  the acting user (admins always may).
- Every credential view and print is written to `audit_log`.

## Auth

- Teacher/admin login with email + password on `ADMIN_ORIGIN` only.
- Opaque session token in `__Host-hb_session` (HttpOnly, Secure, SameSite=Lax,
  Path=/); only its hash is stored, so sessions are revocable.
- CSRF: Hono's `csrf()` origin check on all state-changing routes, plus SameSite.
- Password reset by email when SMTP is configured; otherwise admins reset passwords.
- Login rate limit per IP + email (in-memory is enough for one process).

## API (admin host, all under `/api`)

```
GET    /health
POST   /auth/login            POST /auth/logout
POST   /auth/forgot           POST /auth/reset
GET    /me                    PATCH /me        PUT /me/password

GET    /users                 POST /users                     (admin)
PATCH  /users/:id             DELETE /users/:id               (admin)
PUT    /users/:id/password                                    (admin)
GET    /users/:id/entitlements    PUT /users/:id/entitlements (admin)

GET    /books                 POST /books
GET    /books/:id             PATCH /books/:id    DELETE /books/:id
GET    /books/:id/members     POST /books/:id/members
DELETE /books/:id/members/:userId

GET    /books/:id/groups      POST /books/:id/groups
PATCH  /groups/:id            DELETE /groups/:id

GET    /groups/:id/students
POST   /groups/:id/students              { username?, password? }
POST   /groups/:id/students/generate     { count, prefix, passwordLength }
POST   /groups/:id/login-keys/regenerate
GET    /groups/:id/credentials           decrypted, audited; used by print
PATCH  /students/:id                     move group, rename
PUT    /students/:id/password            reset (generated or given)
POST   /students/:id/login-key/regenerate
DELETE /students/:id

GET    /instance              PUT /instance                   (admin)
GET    /audit                                                 (admin; book-filtered for teachers later)
```

The book host app (`bookApp`) exists in M0 but only answers 404 for unknown
or unpublished books, so Host dispatch and slug handling are tested from the start.

## Slugs

- DNS label: `^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`, no `--` (reserved for
  `<slug>--preview`).
- Reserved: `www`, `api`, `admin`, `cloud`, `app`, `mail`, `static`, `assets`,
  `preview`, `login`, plus anything an instance adds in settings.
- Renaming keeps the old slug in `book_slugs` (redirect from M1 on).

## Printing and QR

- Print page (React, print CSS) with two layouts:
  - **Class list**: username, password, QR code, empty "Name" column. For the teacher.
  - **Cards**: one per student with QR, username, password, blank name line. For cutting out.
- QR content: `https://<slug>.<BOOKS_DOMAIN>/_hyperbook/login#k=<loginKey>`.
  The key is in the fragment so it never reaches logs or `Referer`. The login
  route itself ships in M2; M0 already prints the final URL.
- QR rendering with `qrcode-svg`, which `@hyperbook/markdown` already uses.

## Frontend

- React Router, TanStack Query on top of the Hono RPC client,
  react-hook-form + zod (schemas shared with the server, in `src/shared`).
- Pages: login, forgot/reset, books list, book (settings, members, groups),
  group (students table, generate dialog, regenerate keys, print), print,
  users (admin), user (entitlements), instance settings, account.
- Layout like a hyperbook: header bar, left navigation, content column.

## Theme

1. Hyperbook's color tokens live in `packages/markdown/assets/tokens-light.css`
   and `tokens-dark.css`; `light.css`/`dark.css` import them and the platform
   imports the same files. Brand defaults (`#007864`, `#b5e3d8`, white) sit
   there under `:where(:root)`, so a book's configured colors always win.
2. `src/web/app.css` maps shadcn variables onto them:
   `--primary` → `--color-brand`, `--primary-foreground` → `--color-brand-text`,
   `--muted`/`--secondary` → `--color-nav`, `--border` → `--color-nav-border`,
   `--background`/`--foreground` → `--color-background`/`--color-text`,
   `--radius: 8px`; shadows flattened to `rgba(0,0,0,.24) 0 1px 2px`;
   fonts `hyperbook-body`, `hyperbook-heading`, `hyperbook-code` with the
   same system sans-serif / monospace fallbacks books use.
3. Dark mode follows the same light/dark token split.

## Work order (each step one PR-sized change)

1. *(done)* Shared theme tokens in `packages/markdown`; books render unchanged.
2. *(done)* Skeleton: delete old cloud, package, tsconfig, config, Hono app with Host
   dispatch, Vite SPA shell, Dockerfile, compose, health check.
3. *(done)* Drizzle schema, migrations with backup-before-migrate, first-admin seed.
4. *(done)* Auth: sessions, login/logout/me, password change, reset by email, rate limit.
5. *(done)* Users and entitlements (admin), instance settings.
6. *(done)* Books, members, slug rules, visibility gated by entitlement.
7. *(done)* Groups and students: sealing, generation, login keys, resets.
8. *(done)* Print views with QR.
9. *(done)* Audit log.
10. *(done)* README, `.env.example`, tests for permissions, sealing and Host dispatch.

## Out of scope for M0

Building and serving books, student login, the store, the editor, signup,
quotas other than `max_books`. Until M2, `packages/markdown/assets/cloud.js`
has no server to talk to; the cloud docs page is updated in M2.

## Notes from building M0

- `tests/e2e` drives the built server with the system Chromium
  (playwright-core); it is not part of `pnpm test` and so not run by the
  pre-commit hook or CI yet.
- Student passwords use a cheaper scrypt cost than teacher passwords, so
  generating a class stays fast; both record their cost in the hash.
- Password reset emails are limited to 3 per address and hour; logins lock
  for 15 minutes after 10 failures per account.
- The admin app sends a strict Content-Security-Policy and forbids framing.

## Resolved questions

1. Teachers and admins log in with their email address.
2. Book editors may manage groups and students, not only owners.
3. Student sessions on book hosts (M2) last 30 days; a "shared device" option
   at login ends the session when the browser closes.

---

# M1: Hosting

Goal: a teacher uploads a book as a zip, the platform builds it in a
sandbox and publishes it at `<slug>.<BOOKS_DOMAIN>`. Every upload is a git
commit, so M3's editor starts from the same repository.

## Storage

```
$DATA_DIR/
  database.sqlite
  books/<bookId>/          by id, so renaming a slug moves nothing
    repo.git/              bare repository, the book's source of truth
    builds/<buildId>/      a finished build (contents of .hyperbook/out)
  tmp/                     one directory per running job; emptied at startup
```

`tmp/` lives on the data volume so a finished build is moved into place with
one `rename`, never copied.

## Data model

```
books   + published_build_id, published_at

builds  id, book_id, commit, status ('queued'|'running'|'succeeded'|'failed'|'canceled'),
        trigger ('upload'|'rebuild'), requested_by, hyperbook_version,
        log (text, capped at 256 KB), error, size_bytes,
        created_at, started_at, finished_at
```

## Upload

`POST /api/books/:id/source` takes one zip (multipart).

- Limits: `UPLOAD_MAX_MB` for the zip, `BOOK_MAX_MB` for the unpacked source
  and again for the build output, at most 20 000 entries.
- Entry names are checked before anything is written: no absolute paths, no
  `..`, no `.git` path component, no NUL. Backslashes count as separators.
  Sizes come from the zip's central directory and are enforced while
  inflating (yauzl). Files are written by the platform itself, so a zip
  cannot create symlinks; symlink entries are left out and listed.
- Skipped: `__MACOSX/`, `.DS_Store`, `node_modules/`, `.hyperbook/`.
- The book root is the shallowest directory with a `hyperbook.json` or
  `hyperlibrary.json`; a zip downloaded from GitHub (`repo-main/…`) works
  as it is. No such file: the upload is refused.
- The unpacked tree is committed as the book's new tree (temporary index,
  `commit-tree`, `update-ref`), author = the teacher. No working copy is kept.
  The book's own `.gitignore` files apply, as they would in a git checkout.
- Books with `source = 'external'` refuse uploads.

Git runs with hooks off, no system or global config, and `HOME` set to an
empty directory.

## Builds

- One in-process queue, `BUILD_CONCURRENCY` (default 1) builds at a time.
  A new request for a book replaces its queued (not running) build.
- At startup, `running` builds become `failed` ("interrupted by a restart");
  `queued` builds run.
- Steps: check out the commit into `tmp/build-<id>/src` (temporary index),
  drop `basePath` from `hyperbook.json` (books live at the root of their
  host), run the build, check the output size, move
  `src/.hyperbook/out` to `books/<bookId>/builds/<buildId>`, then mark the
  build succeeded and set `published_build_id` in one transaction.
- Builds older than the published one are deleted, except the latest 2.
- The log keeps stdout and stderr in order, ANSI codes removed and progress
  lines collapsed to their last state.

### Sandbox

The build runs `hyperbook build --offline` from `packages/hyperbook/dist`
(same repository, so books and platform always match) in a child process:

- Node's permission model: read access only to the CLI, its asset cache
  and the job directory; write access only to the job directory. No child
  processes, workers or native addons.
- An empty environment except `PATH`, `HOME` (job directory) and
  `NODE_ENV`. `CREDENTIALS_KEY` and the rest never reach it.
- `--max-old-space-size=BUILD_MEMORY_MB` (default 1024) and a hard kill
  after `BUILD_TIMEOUT_SECONDS` (default 300).
- `--offline`: element assets are fetched into the image when it is built.

The permission model does not block network access. The build needs none;
operators who want that guarantee restrict egress at the container level.

Two changes to the CLI make this possible: copying files without
`fs.cp` (which stats every parent directory up to `/`), and accepting only
a language code for `language` (it is used in a `require` path).
Favicons are not generated from the logo in the sandbox, since `sharp` is a
native addon; a book can ship its own `favicon.ico`.

## Serving books

`bookApp` on `<label>.<BOOKS_DOMAIN>`:

| Case | Answer |
|---|---|
| label is an old slug | 301 to the current slug, same path |
| unknown label | 404 |
| `source = 'external'` | 404 page linking to the external URL |
| `visibility = 'private'` | 403 "private"; student login arrives in M2 |
| nothing published | 404 "not published yet" |
| `/_hyperbook/*` | reserved for M2, 404; never served from a build |

Path lookup: the exact file, then `<path>.html`, then `<path>/index.html`;
otherwise the build's `404.html` (status 404) if it has one. `..` and
encoded slashes are refused. Responses carry `ETag` (build id + path), honour
`If-None-Match`, `Range` (audio and video seeking) and `HEAD`, and send
`Cache-Control: no-cache`, `X-Content-Type-Options: nosniff` and
`Referrer-Policy: strict-origin-when-cross-origin`. No CSP: books embed
content from anywhere by design.

## TLS check

`GET /api/tls-check?domain=…` on every host, for Caddy's on-demand TLS
`ask`: 200 for the admin host and for `<label>.<BOOKS_DOMAIN>` when the label
is a current or old slug, otherwise 404.

## API (admin host)

```
POST   /books/:id/source       zip upload → commit, queued build
GET    /books/:id/source.zip   current source (git archive)
GET    /books/:id/builds       latest 20, without logs
POST   /books/:id/builds       rebuild the current commit
POST   /books/:id/unpublish
GET    /builds/:id             with log
POST   /builds/:id/cancel      queued or running
```

Owners and editors may do all of these. Upload, rebuild, cancel, unpublish
and publish are written to the audit log.

## Admin UI

The book page gets a "Publishing" card: the address and status of the
published build, a zip drop zone, "Rebuild", "Download source",
"Unpublish", and the build list with status, trigger, who, duration and a
log dialog that follows a running build.

## Configuration (new)

| Variable | Default | Meaning |
|---|---|---|
| `UPLOAD_MAX_MB` | 100 | largest accepted zip |
| `BOOK_MAX_MB` | 500 | largest unpacked source and build output |
| `BUILD_CONCURRENCY` | 1 | parallel builds |
| `BUILD_TIMEOUT_SECONDS` | 300 | build is killed after this |
| `BUILD_MEMORY_MB` | 1024 | heap limit of a build |
| `HYPERBOOK_CLI` | `packages/hyperbook/dist/index.js` in the repository | for development only |

## Deployment

- The image gets `git`, the built Hyperbook CLI and its element assets
  (the archives its build packs into `packages/hyperbook/.cache`; a later
  note corrected the `hyperbook assets fetch --all` this first said).
- `deploy/Caddyfile.on-demand` (any number of books, certificates issued on
  first visit, gated by `tls-check`) and `deploy/Caddyfile.wildcard`
  (one wildcard certificate through DNS-01; needs a Caddy build with the
  DNS provider's module).

## Work order

1. *(done)* CLI: sandbox-friendly copying, `language` validation.
2. *(done)* Config, storage layout, `builds` table, migration.
3. *(done)* Git repository and zip import, with tests for hostile zips.
4. *(done)* Build queue, sandboxed runner, publish and pruning.
5. *(done)* API routes and audit entries.
6. *(done)* `bookApp` serving, old-slug redirects, `tls-check`.
7. *(done)* Publishing card in the admin UI.
8. *(done)* Docker image, Caddy examples, README, browser test of upload → visit.

## Out of scope for M1

Student login and private books (M2), editing files in the browser and
preview hosts (M3), storage quotas per teacher (M4), custom domains (M5).

## Notes from building M1

- The admin API's CSRF rule ("JSON only") accepts `multipart/form-data`
  for the upload, but only when the request names the admin origin.
- Build logs replace the job directory with `<book>`, so server paths do
  not reach teachers.
- The tests run real sandboxed builds when `packages/hyperbook/dist`
  exists and skip them otherwise; other tests use a stand-in runner that
  copies the source as the "build".
- The on-demand Caddy example uses a catch-all `https://` site behind the
  `ask` check rather than `*.<BOOKS_DOMAIN>`, as Caddy documents it.
- Rebuilding all books after an update of the CLI is not automatic yet;
  each build records the Hyperbook version it used (M4).

---

# M2: Student features

Goal: students log in to their book (password or QR code), their work in
interactive elements is saved to the platform and follows them to any
device, teachers look at a student's state read-only, and private books
are readable only by their students. Books hosted elsewhere (GitHub Pages)
use the same accounts and store.

## One API, on the book's host

Everything students use lives under `/_hyperbook/` on the book's own host,
`<slug>.<BOOKS_DOMAIN>`. The admin origin never talks to students.

- **Hosted books** (built by the platform) call it same-origin with an
  HttpOnly cookie. The build sets `"cloud": { "sameOrigin": true }` in the
  checkout's `hyperbook.json` (like dropping `basePath`), so `cloud.js`
  knows to use the cookie. A book's own `cloud` setting is replaced.
- **External books** set `"cloud": { "url": "https://<slug>.<BOOKS_DOMAIN>",
  "id": "<slug>" }` and call it cross-origin with a Bearer token kept in
  `localStorage`. CORS allows exactly the origin of the book's
  `external_url`, nothing else.

```
POST /_hyperbook/api/login          { username, password, sharedDevice?, token? }
POST /_hyperbook/api/login/key      { key, sharedDevice?, token? }      (QR code)
POST /_hyperbook/api/logout
GET  /_hyperbook/api/session        → { user: { username }, readonly } | 401
GET  /_hyperbook/api/store          → { snapshot, lastEventId }
POST /_hyperbook/api/store/events   { events, afterEventId } → { lastEventId } | 409
POST /_hyperbook/api/store/snapshot { data } → { lastEventId }
POST /_hyperbook/api/impersonate    { code } → read-only session (one-time code)

GET  /_hyperbook/login              login page (password form, QR fragment)
GET  /_hyperbook/impersonate        hand-off page for teachers (code in fragment)
```

`token: true` asks for a Bearer token in the response body instead of a
cookie (external books). Only 401 means "logged out"; a read-only session
writing gets 403 and stays logged in.

## Sessions

```
student_sessions  id_hash (sha256 of token), student_id, kind ('cookie'|'token'),
                  readonly, impersonated_by (user id), expires_at,
                  last_seen_at, persistent, created_at
```

- Cookie `__Host-hb_student` (HttpOnly, Secure, SameSite=Lax, Path=/) on
  the book host; plain `hb_student` over http in development.
- 30 days, sliding. "Shared device" makes it a browser-session cookie with
  a 12-hour server-side limit.
- Read-only sessions from impersonation last 1 hour and are never renewed.
- Failed logins are limited per book + username and per book + IP
  (10 per 15 minutes); QR keys per IP.
- Teachers and admins cannot log in on book hosts.

## Store

The wire format of `packages/markdown/assets/cloud.js` stays: events
`{ table, schema, op: "create"|"update"|"delete", primKey, data }`, a Dexie
export as snapshot, `afterEventId` as the watermark. The replay logic of the
old cloud's `lib/eventSourcing.js` is ported to TypeScript with its tests.

```
store_heads   student_id (PK), revision, snapshot (json), snapshot_revision,
              size_bytes, updated_at
store_events  id, student_id, revision, table_name, table_schema, operation,
              prim_key (json), data (json), created_at
```

- `lastEventId` is the student's `revision`: +1 per accepted batch or
  snapshot. An events batch whose `afterEventId` differs from the current
  revision is refused with 409, in the same transaction as the append.
- After 100 events the state is compacted into the snapshot and the events
  are deleted (`STORE_COMPACT_EVENTS`).
- Limits: `STORE_MAX_MB` (default 10) per request and per student state.
- Everything is deleted with the student (cascade).

## Private books

Every path of a private book, except `/_hyperbook/*`, needs a student
session of that book; otherwise 302 to `/_hyperbook/login?next=<path>`.
Responses carry `Cache-Control: private, no-cache`.

## Login page and QR codes

`/_hyperbook/login` is a small page of the platform (not of the book):
username, password, "shared device", in the book's title. With
`#k=<loginKey>` in the address (the printed QR code) it logs in by key on
its own and continues to `next` or `/`.

## Impersonation

A teacher clicks "View as student" in the group page. The admin API
creates a one-time code (60 s) and the browser opens
`https://<slug>.<BOOKS_DOMAIN>/_hyperbook/impersonate#c=<code>`; the page
exchanges it for a read-only session and continues to `/`. For an external
book it opens `<external_url>#hyperbook-impersonate=<token>` with a
read-only Bearer token instead. A banner in the book says whose state is
shown. Every impersonation is in the audit log.

## Teachers' view

The group page shows each student's last save, and offers "View as
student" and "Download data" (the reconstructed state as JSON, audited).

## Changes to books (`@hyperbook/markdown`, `@hyperbook/types`)

- `cloud.js`: two modes (same-origin cookie / Bearer token), endpoints
  under `/_hyperbook/api/`, session check at start-up instead of decoding a
  JWT, read-only from the session, `#hyperbook-impersonate=` for external
  books, 403 no longer logs out.
- The login form gets a "shared device" checkbox.
- `cloud` in `hyperbook.json`: `{ url, id }` or `{ sameOrigin: true }`
  (types and JSON schema).
- The Cloud documentation page (en, de) is rewritten for the new platform.

## Work order

1. *(done)* Tables and migration; store logic ported with tests.
2. *(done)* Student sessions, login (password, key), logout, session; rate limits.
3. *(done)* Store endpoints with watermark, compaction and limits.
4. *(done)* CORS and Bearer mode for external books.
5. *(done)* Private books, login page with QR, impersonation hand-off page.
6. *(done)* Admin: impersonation, last save, download data.
7. *(done)* Build sets `cloud.sameOrigin`; `cloud.js`, form, types, schema, docs.
8. *(done)* Browser tests: QR login on a private book, saving across devices,
   impersonation; README.

## Out of scope for M2

Editing in the browser (M3), signup and quotas (M4), single sign-on (M5).

## Notes from building M2

- QR codes of books hosted elsewhere open the book itself
  (`<external_url>#hyperbook-key=<key>`); its `cloud.js` logs in with the
  key. Hosted books' QR codes open the platform's login page.
- A new password or a new QR code for a student ends that student's
  sessions (a lost card should stop working at once).
- The platform's pages on book hosts pick English or German from the
  browser's language.
- `GET /_hyperbook/api/store` always answers with the watermark, also before
  anything was saved, and `cloud.js` adopts it; the old cloud answered 404.
- Only the root `hyperbook.json` gets `cloud.sameOrigin`; the books of a
  library (`hyperlibrary.json`) do not log in yet.

---

# M3: Editor

Goal: teachers write their book in the browser: a file tree, text files in
CodeMirror, uploads of images and other files, a preview on its own host
that follows every save, a form for `hyperbook.json`, an explicit
"Publish", and export. Visual editors for element files follow in
[the next part](#m3-visual-editors-for-element-files).

## Saving and publishing are separate

A save is a commit on `main` and is built for the preview right away. The
book's address changes only when a teacher publishes, so students never see
a page half-way through an edit.

- `builds.publish` (boolean) says whether a successful build goes live.
  Uploads and rebuilds publish, as in M1; builds after a save (`edit`) do
  not; "Publish" (`publish`) does.
- `books.preview_build_id` is the newest successful build of any kind;
  `published_build_id` the one students see.
- **Publish** takes the newest successful build of the current commit and
  makes it live without building again (a build does not depend on the
  host it is served from). If there is none yet, it queues a publishing
  build of the current commit.
- A new build replaces queued builds of the same book, except that a
  preview build never replaces a queued publishing build.
- Pruning keeps the published build, the preview build and the latest 2.

## Files API (admin host)

```
GET  /books/:id/files                 → { commit, files: [{ path, size, oid }] }
GET  /books/:id/files/raw?path=…      → the file's bytes; header x-oid
POST /books/:id/files/commit          { message?, changes } → { commit, files }
POST /books/:id/files/init            { template: "default" | "empty" }  (empty repository only)
GET  /books/:id/builds/:buildId/site.zip   the built website
POST /books/:id/publish
POST /books/:id/preview-code          → { url } one-time hand-off to the preview host
```

`changes` is a list of
`{ op: "write", path, content, encoding: "utf8" | "base64", baseOid }`,
`{ op: "delete", path, baseOid }` and `{ op: "move", from, to, baseOid }`.
Uploads are writes with base64 content. `baseOid` is the blob the teacher started from (`null`: the path must not
exist yet). If any differs from the current commit, nothing is saved and
the answer is 409 with the paths that conflict. Saves of different files by
two teachers at the same time both succeed: the new tree is made from the
current commit through a temporary index, and a lost `update-ref` race is
retried after checking the base blobs again.

- Paths follow the zip rules (no `..`, `.git`, absolute paths or NUL) and
  may not lie in `.hyperbook/` or `node_modules/`.
- The whole tree stays below `BOOK_MAX_MB`; one request below
  `UPLOAD_MAX_MB`.
- `hyperbook.json` and `hyperlibrary.json` at the root must stay a JSON
  object; every build would fail otherwise.
- Raw files are served as `application/octet-stream`, as attachments and
  with `nosniff`: teacher-written HTML, SVG or scripts never run on the
  admin origin. The editor shows images through `blob:`
  URLs.
- The commit's author is the teacher; the message names the files
  ("Edit book/index.md"). The git history is the record of edits, so saves
  are not written to the audit log; publishing is.
- New books start empty: the editor offers Hyperbook's default template
  (`packages/create/templates/default`, bundled into the image) or an
  empty book (`hyperbook.json` and `book/index.md`), or a zip upload.

## Preview host

`<slug>--preview.<BOOKS_DOMAIN>` shows the book's newest save to its
owners and editors only, without building it. It has no student API, so
books there run as if logged out.

- Saving builds nothing; only publishing (and uploads, rebuilds) does. For
  the preview, each book being edited gets a checkout of its newest save
  and a `hyperbook render` process on it (`hosting/renders.ts`), sandboxed
  like a build. It copies Hyperbook's own assets once, then renders single
  pages on request (JSON lines on stdin), with the element runtimes they
  use. Idle renderers stop after 10 minutes; at most 8 run at once.
- The editor sends the open page's unsaved text
  (`POST /api/books/:id/files/render`) a moment after typing stops; it is
  written into the checkout (one page at a time, until the next save) and
  rendered, and the frame reloads in place, keeping its scroll position.
- Visiting a page on the preview host renders it unless it is fresh; other
  files come from the checkout (`public/`, `book/`, `glossary/`).

- The editor asks the admin API for a one-time code (60 s) and frames
  `https://<slug>--preview.<BOOKS_DOMAIN>/_hyperbook/preview#c=<code>&next=<path>`.
  The page exchanges the code (`POST /_hyperbook/api/preview`, own origin
  only) for the cookie `__Host-hb_preview`: HttpOnly, Secure,
  `SameSite=None`, `Partitioned`, 12 hours. Partitioned (CHIPS) because the
  preview host is a third party inside the editor's frame; a browser that
  still blocks it gets a page that offers to open the preview in a tab,
  where the same hand-off works first-party.
- The session is checked against the book's membership on every request.
- Responses carry `Cache-Control: private, no-store` and
  `X-Robots-Tag: noindex`.
- `tls-check` accepts `<slug>--preview` for existing slugs.
- The admin CSP gets `frame-src` for the books domain.

```
preview_codes     code_hash, user_id, book_id, expires_at
preview_sessions  id_hash, user_id, book_id, expires_at
```

## Editor UI

`/books/:id/edit`, using the whole window:

- **File tree**: folders from the paths; new file, new folder (a folder
  exists through its first file), rename and move, delete, upload (drop
  files onto a folder), download.
- **Tabs** of open files: CodeMirror 6 (Markdown, JSON, CSS, JavaScript,
  HTML, YAML), images shown, other files with size, download and replace.
  An unsaved-changes marker per tab; Ctrl/⌘+S saves the active file, "Save
  all" saves every changed file in one commit. Leaving with unsaved changes
  asks first.
- **Conflicts** (409): reload the file (drop mine), overwrite, or save mine
  as a copy.
- **Preview pane** beside the editor, showing the page of the open file
  (`book/a/b.md` → `/a/b`, `book/a/index.md` → `/a`, `glossary/x.md` →
  `/glossary/x`), reloaded when the build of the newest save succeeds; the
  build state is shown with a link to its log.
- **Top bar**: Save all, Publish (says whether the live book is behind),
  Book settings, a link back to the book page.

The editor is a lazily loaded chunk; CodeMirror is not part of the admin
pages.

## Book settings form

A dialog edits `hyperbook.json` through a form: name, description,
language, author (name, URL), license, logo (a file of the book), brand
colors, and the switches search, table of contents, QR code and trailing
slash. Keys the form does not know are kept, and so is the order of keys.
It saves like any other edit (with the file's base blob); "Edit as JSON"
opens the file itself.

## Export

- "Download source" (M1) stays.
- "Download" zips a kept build (`site.zip`), for hosting elsewhere.
  Student logins of such a copy need `cloud.url` instead of `sameOrigin`;
  the dialog says so.

## Work order

1. *(done)* Builds: `publish` flag, `edit` and `publish` triggers,
   `preview_build_id`, publish endpoint, pruning; migration.
2. *(done)* Git: list a tree, read a blob, commit a list of changes against base
   blobs; tests for conflicts and races.
3. *(done)* Files API, init from templates, `site.zip`.
4. *(done)* Preview host: codes, sessions, serving, `tls-check`, CSP.
5. *(done)* Editor UI: tree, tabs with CodeMirror, save, conflicts, uploads.
6. *(done)* Preview pane and publishing bar.
7. *(done)* Book settings form.
8. *(done)* Browser tests (template → edit → preview → publish), README, notes.

## Out of scope for M3

Editing at the same time in one file (live collaboration), a history view
with restore, branches, quotas per teacher (M4).

## Notes from building M3

- Uploads in the editor are writes with base64 content through the same
  commit endpoint; there is no separate multipart endpoint.
- Raw files keep the admin origin's own CSP (secure headers overwrite a
  per-route header); octet-stream, attachment and `nosniff` keep them from
  rendering.
- `@codemirror/state`, `view` and `language` are deduplicated in Vite:
  other packages of the repository pull in older copies, and two copies
  break CodeMirror.
- Logos in the settings form are images from `public/`, since
  `hyperbook.json` addresses the logo relative to that folder. Switches at
  Hyperbook's default (e.g. `toc: true`) leave the key out.
- The preview frame logs in once per editor visit; later reloads go to the
  page directly, so a one-time code is never reused.

---

# M3: Visual editors for element files

Some elements keep their content in a file (or a block) that is hard to write
by hand. The editor opens these in the element's own visual editor, and saves
the result back into the book, like any other edit.

## Elements

| Element | Content | Editor component | Gets changes by |
|---|---|---|---|
| struktolab | code block inside `:::struktolab`, or a `.struktolab` file (`src`, the tree as JSON) | `struktolab-editor` (`struktolab`) | `change` event |
| bitflow | `.bitflow` file (`src`, JSON) | `bitflow-flow-editor` (`@bitflow/web-component`) | `bitflow-save` event / `save()` |
| learningmap | `.learningmap` file (`src`) | `hyperbook-learningmap-editor` (`@learningmap/web-component`) | `onChange` |
| excalidraw | `.excalidraw` file (`src`) | `@hyperbook/web-component-excalidraw` | `onChange`, `value` |
| jmp | `.jmp` file (`src`) | `@java-memory-playground/web-component` | `onChange` |
| blockflow | `.sb3` file (`src` of `::blockflow-player` / `::::blockflow-editor`; base64 of the zip) | `embed-editor.html` of the blockflow bundle served at `/blockflow/` | embed protocol: `change`/`saved` messages |
| blockflow (project) | `.blockflow` file (`project` of `::::blockflow-editor`; the generator's JSON) | `embed-generator.html` of the same bundle | embed protocol: `change`/`saved` messages |

Five already ship an editor as a web component, so the platform embeds them;
it does not reimplement any editor. Blockflow has no web component: its
editors are a static bundle, which the platform serves itself at `/blockflow/` —
the same runtime the books of the instance render with (see below). Since
blockflow v0.2.0 the bundle ships embed entries (`embed-editor.html`,
`embed-generator.html`) that speak a small postMessage protocol
(`ready`/`load`/`change`/`save`/`saved`/`error`, same-origin or an explicit
`?embedOrigin=` allowlist), so the frame talks to the editor instead of
touching its VM.

## How teachers reach them

1. **From the file tree**: opening a `.learningmap`, `.excalidraw`, `.jmp`,
   `.bitflow`, `.struktolab`, `.sb3` or `.blockflow` file shows the visual
   editor, with a "Source" toggle to the raw text (base64 for a `.sb3`).
2. **From the Markdown editor**: a directive line (`::learningmap{src=…}`,
   `::blockflow-player{src=…}`, `::::blockflow-editor{src=…}` or
   `::::blockflow-editor{project=…}`, `:::struktolab`, …) gets an "Edit
   visually" action. For a `src`/`project` element it opens that file; for
   inline struktolab it edits the code block and writes it back into the page.
3. **Creating**: "Insert" above a page offers learning map, drawing, Java
   memory diagram, flow and structogram. Each creates a starter file in
   `public/` (which every element's `src` lookup checks first) and inserts
   the directive with `src="/<name>.<ext>"` at the cursor. A new `.jmp` starts empty and gets
   the playground's example diagram (unsaved) when it opens.

Which files belong to which element comes from the file's extension:
`.learningmap`, `.excalidraw`, `.jmp`, `.bitflow`, `.struktolab`, `.sb3` and
`.blockflow` (bitflow flows and blockflow project files are JSON, but get an
extension of their own so they are recognised without reading the book's
pages; the build reads `src`/`project` whatever their extension).

Structograms usually live inside the page (a code block in
`:::struktolab`). The Markdown editor shows "Edit visually" on each such
block; the structogram editor opens in a dialog with the block's pseudocode,
in the keywords of the directive's `lang` or the book's language, and
"Apply" replaces the block's code in the page as an ordinary (undoable,
unsaved) edit. Struktolab rewrites the pseudocode the way it understands it,
so lines it cannot parse turn into plain steps after "Apply". Structogram files
(`.struktolab`, the tree as struktolab's `saveJSON()` writes it, which
`src` loads as it is) open in the same editor like the other element
files.

## Saving

- Explicit **Save** with an unsaved-changes marker; no autosave into git.
  Leaving with unsaved changes asks first.
- A save is one commit ("Edit learning map test.learningmap"), through the
  same file API as text edits, with the file's base revision attached: if
  someone else saved the file in the meantime, the save is refused and the
  teacher can reload or keep their copy as a new file.
- Before saving, the platform checks the result parses (JSON for bitflow,
  learningmap, excalidraw, jmp), so a broken editor state never lands in the
  book.
- The preview reloads after a save.

## Same versions as the books

A file written by one version of an editor must open in the version the
book renders with. The platform depends on exactly the component versions
`packages/markdown` uses, and a unit test fails when they differ. Bumping a
component means bumping both together.

## Loading and security

- The editors run in `visual.html`, a page of the admin app framed by the
  editor (same origin, `postMessage` protocol in `src/web/visual/protocol.ts`).
  The components bring global CSS (e.g. `button{width:100%}`), which the
  frame keeps away from the admin app; the document travels as text.
- Each editor is a separate, lazily loaded chunk (Excalidraw alone is large),
  fetched only when a teacher opens such a file.
- The editors are platform code from our own bundle; the file content is
  data. They run on the admin origin, never teacher-written scripts. The
  Content-Security-Policy is widened only as far as the editors need, each
  widening listed in `admin/app.ts` with the reason: `frame-ancestors
  'self'` and `frame-src 'self'` for the frame, `img-src https:` for images
  in learning maps.
- Where an element's package exports its React editor (learningmap,
  Excalidraw, jmp), the frame uses that directly instead of the web
  component, at exactly the version the web component of the books depends
  on (`tests/element-versions.test.ts`).
- Excalidraw's fonts are served by the platform (`/excalidraw-assets/`,
  copied at build time); its CDN fallback is blocked by `font-src 'self'`.
- The blockflow editors are different: they are the static bundle the books
  embed too, served on the admin origin at `/blockflow/*` from the shared
  runtime extracted per Hyperbook version (`dataDir/shared-runtimes`, see
  `src/server/admin/blockflow.ts`; in a monorepo checkout, from
  `packages/markdown/dist/assets/directive-blockflow`). `/blockflow/*` gets
  its own CSP (`BLOCKFLOW_CSP`, set after `secureHeaders` ran): `script-src
  'unsafe-eval'` because scratch-vm compiles blocks with `new Function`,
  `connect-src`/`img-src`/`media-src` for the Scratch asset CDNs and `blob:`
  workers and the small-stage iframe. The admin app's own CSP stays strict.
  The visual frame talks to the bundle's embed entries
  (`embed-editor.html` for `.sb3`, `embed-generator.html` for `.blockflow`,
  blockflow ≥ v0.2.0; `manifest.json` in the bundle names them, and
  `tests/element-versions.test.ts` fails when the pin is older): the document
  goes in with `load`, edits come back as `change`, and Ctrl/⌘+S sends `save`
  and the `saved` answer is what gets committed. A `.sb3` travels as base64
  text and saves with `encoding: "base64"`; a `.blockflow` is plain JSON.
- A visual editor's own save button (jmp) saves the file, like Ctrl/⌘+S
  inside the frame.
- Components get the content passed in directly, never a URL to fetch, so
  they need no access to book hosts.

## Upstream work

Make the five components share one contract, in their own repositories
(sibling checkouts under `~/Sources/openpatch`), released before the platform
depends on them. learningmap 0.6.0 works without it: its store hands out
the document (`getRoadmapData`) and persistence can be switched off.
Rough edges found on the way, fixed upstream and released:

- learningmap 0.7.1: the welcome screen offered "open file" and said data
  stays in the browser, and Ctrl/⌘+S downloaded a copy, despite
  `disableFileOperations` / `disablePersist`. The frame also keeps
  Ctrl/⌘+S from reaching any element: saving is the platform's.
- struktolab 0.6.2: the indented lines under a line the parser does not
  recognise (`while x:` instead of `repeat while x:`) were dropped; they
  now follow it. Its Save/Load buttons were no upstream
  issue: the platform now sets `embedded` and downloads image exports
  itself.

- `value` in (the document), one change event out (the new document), and
  an explicit "dirty"/"saved" acknowledgement where the component tracks one
- no network access needed for editing (bitflow's editor can fetch `src`
  today; passing the document must stay possible)
- themable through CSS variables, so the editors pick up Hyperbook's tokens
- a size that fits a pane (no fixed full-viewport layout)

## H5P

H5P is different from the five above, so it is planned separately and comes
last.

- **The file is a package.** A `.h5p` file is a zip: content JSON, media, and
  the H5P libraries (content types) it needs. Editing means unpacking,
  running H5P's editor, and packing a new `.h5p` on save.
- **The editor needs a server side.** H5P's editor (`h5peditor`, JavaScript)
  talks to a backend over an AJAX protocol: list and load libraries with
  their `semantics.json`, install libraries, take file uploads, translate,
  and filter (validate and sanitise) the content before saving.
- **Libraries are third-party code.** Wherever the editor runs, it runs on
  its own origin (e.g. `h5p.<BOOKS_DOMAIN>`, framed by the editor app), never
  on the admin origin. Admins choose which content types are installed.
- **Rendering stays as it is.** Books keep playing `.h5p` files with
  `h5p-standalone`; a test checks that saved files play there.

### Facts (checked 2026-10-28)

| Project | License | State |
|---|---|---|
| `h5p/h5p-editor-php-library` (the editor's JS) | MIT | active |
| `h5p/h5p-php-library` (H5P core, incl. `h5p.js`) | GPL-3.0 | active |
| Lumi `@lumieducation/h5p-server` (Node backend) | GPL-3.0-or-later | maintainer commits in Oct 2026; GitHub release 10.0.5 (Mar 2026), npm still at 10.0.4 (Mar 2025) |
| `h5p-standalone` (player books use now) | MIT, bundles H5P core | active |

The H5P core runs in the browser in every option, books included already.

### Options

1. **Upload only (first).** No H5P editing in the platform: teachers make
   content in ZUM Apps or Lumi Desktop and upload or replace the `.h5p`
   file; the editor previews it. Small, and useful with any later option.
2. **Lumi as a separate, optional service** (`hyperbook-cloud-h5p`). Full
   editor including the content type hub, maintained by others; GPL-3.0
   kept out of the MIT platform by running it as its own container behind
   HTTP. Release lag means pinning a Git version may be needed.
3. **Own backend in TypeScript** (MIT): serve the official editor JS and
   implement its AJAX protocol ourselves, with libraries installed only by
   uploading `.h5p` packages (no hub). Full control and no GPL server code,
   but it is the most work: the protocol is only documented by the PHP
   implementation, and the filter that sanitises content against each
   library's semantics is security-critical and must be written from
   scratch (porting Lumi's or H5P's would make it GPL).

**Decision (2026-10-28):** upload only (option 1). H5P editing in the
platform is not planned; options 2 and 3 stay here for a later decision.

## Order

1. *(done)* File-type registry and the generic "visual editor pane" with
   Source toggle, save, conflict handling; learningmap first (smallest
   component).
2. *(done)* excalidraw and jmp (file-based, same shape).
3. *(done)* bitflow (`.bitflow` files; edit and save events).
4. *(done)* struktolab, including inline blocks written back into Markdown.
5. *(done)* "New …" templates and the Markdown "Edit visually" action.
6. *(done)* Browser tests: open each kind, change it, save, and check the
   commit.
7. *(done)* H5P upload and replace with preview (option 1); no H5P editing.
   "Insert → H5P content" uploads a `.h5p` into `public/` and inserts
   `::h5p{src=…}`; it plays in the page's preview (on the preview host,
   never on the admin origin). A `.h5p` tab offers Replace and Download.

---

# M4: Instance operations

Goal: an instance can be opened to teachers who are not added by hand,
limits what each of them stores, shows its legal pages, can be backed up
while it runs, and keeps books built with the current Hyperbook. Then the
OpenPatch instance launches.

## Decisions (2026-10-28)

| Topic | Decision |
|---|---|
| Sign-up modes | `closed` (default), `open`, `domains`, `approval`; the admin picks one per instance. |
| OpenPatch at launch | `closed`: no public sign-up; admins add teachers, who get an invitation email. |
| Storage quota | Counts the current source of the books a user owns (the git tree), not builds or history. |
| Legal pages | Imprint and privacy policy are either a link or Markdown the platform shows at `/imprint` and `/privacy`. Sign-up requires accepting the privacy policy. |
| Landing page | `/` shows a landing page (intro plus the ways to run Hyperbook, a sign-up link in the mode the admin set, and a login link). Instance setting `landingPage` (on by default); off, `/` goes straight to the login screen. |

## Accounts

```
users  + email_verified_at, approved_at, privacy_accepted_at
```

- **closed**: no sign-up form. Admins add teachers. With SMTP configured,
  "Add user" sends an **invitation**: a link (7 days) to set a password,
  which also verifies the address. Without SMTP a password is generated
  and shown once, as in M0.
- **open**: anyone registers with name, email, password and the privacy
  checkbox; the account works once the email link (24 h) is followed.
- **domains**: like open, for addresses whose domain (or a subdomain of it)
  is on `signupDomains`; others are refused before an email is sent.
- **approval**: like open, then the account waits for an admin. The users
  page lists waiting accounts with "Approve" and "Decline" (deletes it);
  approval is emailed.
- Sign-up needs SMTP; without it the modes other than `closed` cannot be
  chosen. Sign-ups are limited per address (3 emails per hour) and for the
  whole instance (50 per hour): behind a reverse proxy every request has
  the proxy's IP.
  An address that exists already gets the same answer as a new one (no
  account enumeration); its owner gets an email instead.
- Login is refused until the email is verified (and the account approved),
  with a message saying which step is missing and a way to resend the link.
- Accounts made before M4 and by admins count as verified and approved.

```
POST /api/auth/signup            { email, displayName, password, acceptPrivacy }
POST /api/auth/verify            { token }
POST /api/auth/verify/resend     { email }
POST /api/users/:id/approve      (admin)
POST /api/users/:id/invite       (admin) send the invitation again
```

## Storage quota

- `books.source_bytes` is the size of the current tree, updated with every
  commit (upload, save, init).
- A user's usage is the sum over the books they own (co-owners each count a
  shared book, as `max_books` does).
- A change that grows a book is refused (413) when it would take any of its
  owners over `max_storage_mb`; shrinking always works. Admins are never
  limited.
- The account page and the admin's user page show usage against the limit.

## Legal pages

- Instance settings: `imprint` and `privacy`, each `{ url }` or
  `{ markdown }`. Markdown is rendered to HTML on the server and sanitised
  (no scripts, no raw HTML).
- Shown at `/imprint` and `/privacy` on the admin origin (no login needed),
  linked from every admin page, the sign-up form, and the login pages on
  book hosts.

## Upgrades

- At startup, books whose published build was made by another Hyperbook
  version are rebuilt (`REBUILD_ON_UPGRADE`, default on). The rebuild
  publishes only if the published build is still the one it replaces, so a
  teacher's unpublished edits stay unpublished: it builds the published
  commit, not the newest one.
- These builds queue behind teachers' builds.

## Backups

- `node dist/server/main.js backup <dir>` (and `docker compose exec`)
  writes a consistent copy of the database (SQLite online backup) next to
  a copy of `books/` (repositories only; builds are rebuilt). Safe while
  the platform runs.
- The README explains what to keep: the backup, `CREDENTIALS_KEY` and
  `.env`; how to restore; and that builds come back by rebuilding.

## Work order

1. *(done)* Accounts: columns, verification and invitation tokens, login
   checks; migration (existing users verified and approved).
2. *(done)* Sign-up modes in instance settings; sign-up, verify and resend
   API; rate limits; emails.
3. *(done)* Admin: approve/decline, invitations from "Add user".
4. *(done)* Web: sign-up, verify and "check your email" pages; settings
   for modes. `MAIL_OUTBOX_DIR` writes emails as files (development, tests).
5. *(done)* Storage quota: `source_bytes`, enforcement, usage display.
6. *(done)* Legal pages: settings, rendering, routes, links, privacy
   acceptance. Sign-up can only be opened with a privacy policy.
7. *(done)* Rebuild on upgrade (`trigger = 'upgrade'`, `replaces_build_id`).
8. *(done)* Backup command, README (backups, restore, launch checklist).
   Startup also rebuilds published books whose build is missing (after a
   restore).
9. *(done)* Browser tests: sign-up with approval, invitation, quota, legal
   pages (the other modes are covered by API tests).

## Out of scope for M4

Paid plans and payment, single sign-on (M5), deleting inactive accounts
automatically, a terms-of-use document with versioned acceptance.

---

# M5: Custom domains

Goal: a teacher who is allowed to (entitlement `custom_domain`) gives a
hosted book a domain of their own, e.g. `informatik.schule.de`. Once it
works, the book is served there, and its address on the books domain
redirects to it.

## Decisions (2026-10-28)

| Topic | Decision |
|---|---|
| How many | One custom domain per book. |
| Proof of ownership | A CNAME to `<slug>.<BOOKS_DOMAIN>` (or a former slug of the book). It names this one book, and only the domain's owner can create it. No TXT record (changed 2026-10-28: one record is enough, as on GitHub Pages). |
| Apex domains | Not supported: they need A/AAAA records, which every book shares, so they would not say which book a domain belongs to. |
| Active | When the CNAME is found; checked when the domain is set and on "Check again". Not checked again afterwards. |
| One origin | A book with an active domain redirects (301) every `GET`/`HEAD` on `<slug>.<BOOKS_DOMAIN>` to it, so students' local state and login cookie live on one origin. `/_hyperbook/api/*` is not redirected and accepts both origins. |
| Who | Owners of hosted books, with `custom_domain`. Removing always works; losing the entitlement keeps a domain that is already set. |
| Instance | No new variables. Caddy's `ask` admits active custom domains; the wildcard example gets an on-demand block for them. |

## Data model

```
books  + domain (lowercase host, null), domain_verified_at,
         domain_checked_at, domain_problem (text shown to the teacher)
         unique index on domain where domain_verified_at is not null
```

Two books may claim the same domain while neither is active (so nobody can
squat on a name), but only one can make it active.

## Rules for the name

A host name of at least two labels, letters/digits/hyphens, TLD of letters,
at most 253 characters. Refused: the admin host, `BOOKS_DOMAIN`, and any
name inside or above either of them (it would share a site with the admin
UI or other books).

## API (admin host)

```
PUT    /books/:id/domain         { domain } → claim it, check once
POST   /books/:id/domain/check   check again; activates when the CNAME is found
DELETE /books/:id/domain
```

Books carry `domain: { name, active, target, checkedAt, problem } | null`, and `url` is the custom domain's origin once active.
Audit: `book.domain.set`, `book.domain.activate`, `book.domain.remove`.

## Serving

- Host routing: admin host, `*.BOOKS_DOMAIN`, then active custom domains
  (port stripped); other hosts 404.
- Login links, QR codes and impersonation links use the book's public
  origin, so printed lists point at the custom domain.
- The student API's origin check accepts the book's own origin on the books
  domain and on its custom domain.
- `tls-check` answers 200 for active custom domains.

DNS lookups go through a small resolver in `Deps` (CNAME only, 5 s
timeout), so tests use a fake.

## Work order

1. *(done)* Plan (this section).
2. *(done)* Schema, migration, resolver, domain rules and checks with tests.
3. *(done)* API routes, host routing, redirects, origins, `tls-check`; tests.
4. *(done)* Web: "Custom domain" section on the book page with the DNS
   record and its status; browser test.
5. *(done)* Caddy examples and README.

## Notes from building M5 custom domains

- The TXT record of the first version was dropped: the CNAME has to name
  this book exactly, which proves ownership on its own. Left open: a book is
  deleted, its DNS record stays, and a new book takes the slug; that book
  could then claim the domain.
- Activation re-checks that no other book made the domain active meanwhile;
  the partial unique index is the last guard.
- In development the custom domain is served on the books' port, so
  `publicOrigin` appends the port of `BOOKS_DOMAIN`.
- The Caddy examples were not validated with a Caddy binary on the build
  machine.

## Out of scope for M5 custom domains

Several domains per book, re-checking active domains periodically,
custom domains for preview hosts, certificates for domains on the wildcard
setup without on-demand TLS.

---

# M5: Address suffixes and name requests

Goal: on a public instance, short and generic addresses (`physik`,
`mathe`) go to books an admin judged good enough, not to whoever came first.

## Decisions (2026-10-28)

| Topic | Decision |
|---|---|
| Suffix mode | Instance setting `slugSuffix`, off by default. When on, teachers' books get `<name>-<suffix>`, e.g. `physik-edac`. The suffix (4 readable characters) belongs to the book and stays when the teacher renames it. Admins choose freely. |
| Name requests | In suffix mode, an owner asks for an address without the suffix and says what the book is. One open request per book; several books may ask for the same name. |
| Deciding | Admins see open requests with a link to the book's current address. Approving renames the book (the old address redirects) and declines other open requests for that name; declining takes an optional note. The teacher gets an email (when email works); admins get one per new request. |
| Granted names | Teachers cannot rename a book with a granted name. An admin may revoke it: the book goes back to `<name>-<suffix>`, and the freed name redirects there until it is given to another book. |

## Data model

```
books          + slug_suffix (null: none), slug_granted_at, slug_granted_by
slug_requests  id, book_id, slug, description, status ('pending'|'approved'|'declined'|'withdrawn'),
               requested_by, decided_by, decided_at, note, created_at
```

## API (admin host)

```
POST   /books/:id/slug-request        { slug, description }   owner; replaces an open request
DELETE /books/:id/slug-request        owner withdraws it
GET    /slug-requests                 admin; open ones, oldest first
POST   /slug-requests/:id/approve     admin
POST   /slug-requests/:id/decline     admin { note }
POST   /books/:id/slug/revoke         admin { note }
```

Books carry `slugSuffix`, `slugGranted` and `slugRequest` (the open one, or
the last decision). `POST /books` and `PATCH /books/:id` take the name
without the suffix in suffix mode; a name already ending in the book's
suffix is accepted as well. Audit: `book.slug.request`, `.withdraw`,
`.approve`, `.decline`, `.revoke`.

## Work order

1. *(done)* Plan (this section).
2. *(done)* Setting, schema, suffix on create and rename; tests.
3. *(done)* Requests, decisions, revoking, emails; tests.
4. *(done)* Web: suffix in the book forms, request form on the book page, an
   "Addresses" page for admins, the setting; browser test.
5. *(done)* README.

## Notes from building address suffixes

- Saving a book's settings sends its address unchanged; an unchanged address
  is left alone, so a book made before suffix mode keeps its address until
  the teacher renames it.
- A new book retries with a fresh suffix if `<name>-<suffix>` is taken.
- The admin who granted an address is kept (`slug_granted_by`, set null when
  that account is deleted); drizzle-kit left `ON DELETE` out of the added
  column, so migration 0007 was edited by hand.

# M6: Local git workflow

## Goal

Teachers (owners and editors) can `git clone` a book from the platform, work
locally, and `git push` to `main`. Publishing is recorded as tags; the live
site can be rolled back to a tag. Pushes never trigger a publish build, so
many small commits cannot overwhelm the build queue.

## Decisions

- Repo is main-only. Pushes of other refs, deletes, non-fast-forwards and
  client-created tags are rejected (pre-receive hook + `receive.deny*`).
- A push triggers no publish build — only the quota check, a `book.push`
  audit entry and the `books.commit_count` bump. The instance setting
  `gitPushUpdatesPreview` (default off) additionally enqueues a preview-only
  build (`trigger: "push"`, `publish: false`).
- Publish history = tags: `v1`, `v2`, … plus a moving `published` tag; only
  the last two `v<N>` tags (and the builds they point at) are kept. `N` is the
  highest existing tag number + 1, so republishing a commit never rewrites a
  tag. Rollback to a tag is instant when its build is still kept, otherwise
  the tag's commit is rebuilt (`trigger: "rollback"`, goes live on success,
  does not move the preview). `main` is never rewritten.
- Git smart HTTP on the admin origin: `GET/POST /api/books/:id/git/…`,
  mounted outside the `/api` sub-app so `originCheck` does not apply (the git
  content types are not CORS-safelisted, so cross-site POSTs fail their
  preflight and no CORS headers are ever sent). Clone URL:
  `https://git@<ADMIN_ORIGIN>/api/books/<id>/git`.
- Auth: per book+user API tokens (`git_tokens`, hash-only, revocable,
  `lastUsedAt`, max 10 active per user+book), Basic auth with the token as
  password (username `git`), membership re-checked per request, failure and
  per-book op rate limits. Session cookies are not accepted on git routes.
- Push request bodies are capped (`uploadMaxBytes`, streaming counter +
  `receive.maxInputSize`); the unpacked tree size is enforced by the
  pre-receive hook (`HB_MAX_BYTES` env = the book's quota).
- Editor-save CAS semantics are unchanged: a save against a pre-push baseOid
  fails with 409; a push after an editor commit is non-FF and rejected.
- Staleness: `books.commit_count` (bumped on push by the rev-list count and
  by 1 on editor commits/uploads) minus a build's `commitCount` snapshot.
- SSH keys as a second transport were considered and rejected for now (second
  exposed port, host keys, new protocol surface; the HTTPS token path covers
  clone/push with tighter per-book scoping).

## Data model (Drizzle, migration 0010)

- `books.commit_count` integer, default 0.
- `builds.commit_count` integer (snapshot at enqueue), `builds.note` text;
  `builds.trigger` gains `push` and `rollback` (text enum).
- `git_tokens`: `id_hash` PK (sha256 of the token), `book_id`, `user_id`,
  `label`, `last_used_at`, `revoked_at`, `created_at`.

## API (admin host)

```
GET    /books/:id/git/info/refs?service=git-{upload,receive}-pack   Basic token
POST   /books/:id/git/git-upload-pack                               Basic token
POST   /books/:id/git/git-receive-pack                              Basic token
GET    /books/:id/git/tokens                  session; list (no secrets)
POST   /books/:id/git/tokens                  session { label? } → token shown once
DELETE /books/:id/git/tokens/:tokenId          session; owner or the token's own user
POST   /books/:id/publish                     session { note? ≤200 chars }
POST   /books/:id/rollback                    session { tag: "v<N>" }
```

`GET /books/:id/builds` rows carry `tags` (tag names at the build's commit),
`note` and `commitCount`; books carry `commitCount`. Audit:
`book.push`, `book.git.token.create`, `book.git.token.revoke`, `book.publish`,
`book.rollback`.

## Instance setting

`gitPushUpdatesPreview` (boolean, default false) in the admin settings; also
returned by `GET /instance/public` so the book page can explain the behavior.

## Web

Publishing section of the book page: "Work locally (git)" block — clone
command with copy button (`https://git@<host>/api/books/<id>/git`), token
create (shown once in a dialog) / list / revoke, explainer (main-only, pull
before push, `git checkout published` = live site, `git log main ^published` =
unpublished changes, reload the editor after pull/push, no submodules/LFS,
`http.postBuffer` for large pushes), credential-helper hint. Publish button
with optional note; builds table shows tags, notes and a "Roll back"
confirmation on tagged succeeded builds; staleness hint ("main is N commits
ahead of the live site/preview"); "Download source (zip)".

## Tests

`tests/git-http.test.ts`: real `git` binary against the app on an ephemeral
port (Host header override) — clone/push with bookkeeping, token auth
(wrong/revoked/cross-book/limit), ref rules (tag/branch/delete/non-FF),
quota refusal, publish tags, instant vs. rebuild rollback, editor-save vs.
push CAS both directions, `gitPushUpdatesPreview` on/off.
`tests/git.test.ts`: `parseRefUpdates`. `tests/builds.test.ts`: tag-aligned
pruning. Layout under `platforms/cloud/tests`.

## Work order

1. *(done)* Schema + migration 0010, git.ts helpers (pre-receive hook, tags,
   rev-list, `parseRefUpdates`, exported `spawnGit`).
2. *(done)* Git smart HTTP routes + token routes; mounted in admin/app.ts.
3. *(done)* Push bookkeeping, pre-receive quota/ref rules, no publish build.
4. *(done)* Tags on publish/rollback, tag-aligned pruning, rollback route.
5. *(done)* Instance setting, staleness counters, web UI.
6. *(done)* Tests; this doc.
