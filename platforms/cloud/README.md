# Hyperbook Cloud

A self-hosted platform for [Hyperbook](https://github.com/openpatch/hyperbook):
teachers publish their books and manage anonymous student accounts in the
browser.
See [the plan](../../docs/cloud-platform.md) for where this is going.

> **Status:** milestones M0 (accounts, books, groups, students, printable
> login cards), M1 (upload, build and host books) and M2 (student login,
> saving students' work, private books), M3 (editing books in the
> browser) and M4 (sign-up, storage quotas, legal pages, backups) are done.

## What it does

- **Admins** add teachers (who get an invitation by email), decide who may
  sign up on their own, set what each teacher may do (entitlements: private
  books, number of books, storage), configure the instance (name, imprint
  and privacy policy, reserved book addresses) and read the activity log.
- **Teachers** create books, each with an address `<slug>.<BOOKS_DOMAIN>`,
  share them with colleagues as owners or editors, and add groups (classes).
  They write their book in the browser (a file tree, a Markdown editor,
  uploads, a form for the book's settings, and the elements' own editors for
  learning maps, drawings, Java memory diagrams, bitflow assessments and
  structograms) and see every save in a preview
  beside the editor; students see the changes once a teacher publishes them.
  A book can also be uploaded as a zip, which is built and published right
  away. Every save and upload is a git commit; the source and the built
  website can be downloaded.
- **Students** get anonymous accounts per book (`student01`, `student02`, …)
  with a short password and a QR code. Teachers print cut-out cards for the
  students and a class list for themselves, where they write the real names.
  The platform never stores names. Students log in to their book (password
  or QR code), and what they do in its interactive elements is saved, so
  they can continue on any device.
- **Private books** can only be read by their students; others are asked to
  log in. Teachers open a student's work read-only with "View as student".

Student passwords and QR keys are stored twice: hashed, to check logins, and
encrypted with `CREDENTIALS_KEY`, so lists can be printed again. Every view of
them is recorded in the activity log.

## AI writing assistant

The editor has an optional writing assistant that knows the hyperbook
format, looks through the whole book, and answers while the teacher writes;
it may also propose new files, edits and deletions — always as a git diff the
teacher accepts or denies before anything is applied. See
[the assistant plan](../../docs/cloud-ai-assistant.md).

It speaks the OpenAI chat-completions protocol, so any provider works.
**Mistral** and **local hosting** are the recommended setups:

```bash
# Mistral
AI_BASE_URL=https://api.mistral.ai/v1
AI_API_KEY=…                     # console.mistral.ai
AI_MODEL=mistral-medium-latest

# Ollama on the same machine: no cost, and no book content leaves the school
AI_BASE_URL=http://localhost:11434/v1
AI_API_KEY=ollama
AI_MODEL=qwen2.5:14b              # `ollama pull …` first; in Docker use
                                 # http://host.docker.internal:11434/v1

# OpenAI, OpenRouter and Anthropic (via its OpenAI compatibility layer) work
# the same way:
#   https://api.openai.com/v1        https://openrouter.ai/api/v1
#   https://api.anthropic.com/v1
```

Set the three `AI_*` variables together — or none of them, and the assistant
stays hidden. Two entitlements control it per teacher, like everything else:
_AI assistant_ (on/off) and _AI requests per day_ (a quota that refills each
UTC day); admins are never limited. Everything a teacher does goes through
the server, which keeps the provider's key, rate limits, audits requests
(metadata only) and stores no conversations.

**Privacy:** the provider sees the book content of the requests it is asked
about. Choosing the provider — and mentioning it in the instance's privacy
policy — is the admin's decision; a local Ollama keeps everything on the
school's machine.

## Languages

The platform speaks English and German (`src/shared/i18n`, one catalog per
language; a test fails when the German one misses a key). The language of the
pages, API errors and emails is the signed-in user's choice (account page,
`users.locale`), else the instance default (admin settings, `defaultLocale`;
"automatic" follows the browser), else the browser's `Accept-Language`, else
English. Visitors' choice is kept in `localStorage`, and `<html lang>` is set
before the first paint. New strings go into `src/shared/i18n/locales/en.ts`
first; `de.ts` is typed against it. Pages are migrated to `t()` area by area —
auth pages, shell and account page are done, the editor and the admin pages
follow.

## How it is served

One process answers these hosts, told apart by the `Host` header:

| Host | What |
|---|---|
| `ADMIN_ORIGIN` (e.g. `cloud.example.org`) | Admin UI and API |
| `<slug>.<BOOKS_DOMAIN>` (e.g. `physics.example.page`) | Books |
| `<slug>--preview.<BOOKS_DOMAIN>` | A book's newest save, rendered page by page, for its teachers |
| A book's custom domain (e.g. `physik.schule.de`) | The book, once the domain is active; see [Custom domains](#custom-domains) |

Books run scripts their teachers wrote, so they never share an origin
with the admin UI. Best is a separate registered domain for books
(`example.page` next to `example.org`); a subdomain like `books.example.org`
also works, and so do books directly below the admin host (admin on
`example.org`, books on `<slug>.example.org`), because the admin session
cookie is a `__Host-` cookie that other hosts cannot set or overwrite.

A reverse proxy in front terminates TLS and must pass the `Host` header
through unchanged (Caddy does by default; with nginx use
`proxy_set_header Host $host`). Books need a wildcard DNS record
(`*.example.page`). Two Caddy configurations are in [`deploy/`](deploy/):

- [`Caddyfile.on-demand`](deploy/Caddyfile.on-demand): a certificate per book,
  issued on its first visit. Works with every DNS provider. Caddy asks
  `/api/tls-check?domain=…` first, which only allows the admin host,
  existing books and active custom domains.
- [`Caddyfile.wildcard`](deploy/Caddyfile.wildcard): one wildcard certificate
  through the DNS-01 challenge. For large instances; needs a Caddy build
  with your DNS provider's module. Custom domains still get their
  certificates on demand.

### Custom domains

Teachers whose entitlements allow it (Settings → Default entitlements, or
per user: "Custom domains") give a hosted book a domain of their own on the
book's page, and create one DNS record, which the page shows:

| Type | Name | Value |
|---|---|---|
| CNAME | `physik.schule.de` | `<slug>.<BOOKS_DOMAIN>` |

The CNAME names this one book, and only whoever controls the domain's DNS
can create it, so it is the proof of ownership as well (a CNAME to a slug
the book had before a rename counts too). A/AAAA records do not count:
every book shares the server's addresses. So a domain without a subdomain
(`schule.de`), which cannot have a CNAME, is not supported. Once the record
is found, the domain is active: the book is served there (Caddy gets a certificate on the first
visit) and its address on `BOOKS_DOMAIN` redirects to it, so students keep
one login and one set of saved state. Login links and QR codes printed from
then on use the custom domain. A domain can be active for one book at a
time, and the platform's own domains (and anything inside or above them)
are refused.

### Students on book hosts

Everything students use lives under `/_hyperbook/` on the book's own host:
the login page (also the target of the QR codes), and the API that logs in
and saves (`/_hyperbook/api/…`). Hosted books use it same-origin with an
HttpOnly cookie; the platform sets `"cloud": { "sameOrigin": true }` when it
builds them. A book hosted elsewhere (marked so in its settings) sets
`"cloud": { "url": "https://<slug>.<BOOKS_DOMAIN>", "id": "<slug>" }` and
uses a Bearer token; CORS admits only the origin of its external address.

Changing requests must come from the book's own origin (or carry a Bearer
token), because books on sibling subdomains count as the same site for
cookies.

### Preview

Each save is built for the book's preview host, which only the book's
owners and editors can open. The editor frames it and hands the teacher over
with a one-time code; the preview host then keeps its own session cookie
(`SameSite=None`, `Partitioned`, since it is a third party inside the
editor). A browser that blocks even partitioned cookies shows the preview
in a new tab instead. Wildcard DNS and certificates already cover these
hosts, and `tls-check` knows them.

### Builds

An upload is unpacked (paths and sizes are checked first), committed to the
book's git repository and built with the Hyperbook CLI from this repository,
so books always build with the version the platform ships. A finished build
replaces the published one in a single step; a failed build leaves the
published book as it was.

Builds are teacher-written content and run sandboxed: a child process under
Node's permission model that may only read the CLI and the book and write the
book's job directory, with no child processes or native addons, an empty
environment (no secrets), a memory limit and a timeout. The permission model
does not block network access; builds need none, so restrict the container's
egress if you want that guaranteed. Favicons are not generated from a book's
logo in the sandbox; a book can include its own `favicon.ico`.

Limits are set in `.env`: `UPLOAD_MAX_MB`, `BOOK_MAX_MB`, `BUILD_CONCURRENCY`,
`BUILD_TIMEOUT_SECONDS`, `BUILD_MEMORY_MB` (see `.env.example`).

## Production

```bash
cd platforms/cloud
cp .env.example .env      # set ADMIN_ORIGIN, BOOKS_DOMAIN, CREDENTIALS_KEY,
                          # ADMIN_EMAIL and ADMIN_PASSWORD
docker compose up -d
```

The server refuses to start with missing or unsafe settings and says which.
On the first start it creates the admin account from `ADMIN_EMAIL` and
`ADMIN_PASSWORD`.

### Without Docker (pm2)

The platform also runs as a plain Node process, e.g. with pm2 next to other
apps. The workflow `.github/workflows/deploy-cloud.yml` builds it, the
Hyperbook CLI and the element assets in GitHub Actions, copies them to the
server with rsync, installs the runtime dependencies there (better-sqlite3
is native, so it is built for the server's own CPU) and restarts pm2. The
server needs Node 22 or later, `git`, `rsync` and pm2.

Once, on the server (here `/home/openpatch/projects/hyperbook-cloud`):

1. Create the folder and its `.env` (see `.env.example`), with
   `DATA_DIR=/home/openpatch/projects/hyperbook-cloud/data` and
   `chmod 600 .env`. Nothing outside `data/` and `.env` is kept between
   deploys.
2. Add the app to pm2's ecosystem file:

   ```js
   {
     name: "hyperbook-cloud",
     cwd: "hyperbook-cloud/platforms/cloud",
     script: "dist/server/main.js",
     node_args: "--env-file=../../.env",
     env: { NODE_ENV: "production", PORT: 3001 },
     // Running builds are stopped and the database closed on shutdown.
     kill_timeout: 30000,
     time: true,
   },
   ```

3. In the repository's GitHub settings, create the environment `cloud` with
   the variables `DEPLOY_PATH` (the folder above) and `DEPLOY_HOST`
   (`hyperbook.cloud`, for the health check), and the secrets
   `DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER` and `DEPLOY_SSH_KEY` (a private key
   without passphrase whose public half is in the user's
   `~/.ssh/authorized_keys`).
4. Run the workflow once (it fails at the restart, since pm2 does not know
   the app yet), then `pm2 start ecosystem.config.js --only hyperbook-cloud`
   and `pm2 save`. Later deploys restart it themselves.

Backups work as with Docker:
`node --env-file=.env platforms/cloud/dist/server/main.js backup <dir>`
from the folder above.

Without a container, the build sandbox (Node's permission model) is the
only thing between a book's build and the other files of the user the
platform runs as. Running it as a user of its own keeps those apart.

### Email

Set `SMTP_*` in `.env`. With email, the platform sends invitations,
confirmation links and password resets, and sign-up can be opened; without
it, admins add teachers with a generated password that is shown once.

### Who may make an account

Under Settings → Sign-up, an admin picks one of:

| Mode | Who |
|---|---|
| Closed (default) | Only admins add teachers; they get an invitation link to choose a password. |
| Open | Anyone, after confirming their email address. |
| Listed domains | Anyone with an address at one of the listed domains (and their subdomains). |
| With approval | Anyone, after confirming the address and an admin's approval (admins get an email). |

Every mode but "Closed" needs email and a privacy policy, which people
accept when they sign up.

### Limits

Entitlements (Settings → Default entitlements, or per user) limit how many
books a teacher owns and how much they store. Storage counts the files of
the books they own (each owner counts a shared book); built websites and
history do not count. A save that would go over the limit is refused;
deleting files always works. Admins are never limited.

### Book addresses

Teachers choose their books' addresses. On a public instance, turn on
"Teachers' addresses get an ending of their own" (Settings → General): each
teacher's book then gets a short ending of its own (`physik-edac`), which
stays when they rename it, so nobody can take a short, general address like
`physik` for themselves. Admins choose addresses freely.

Owners ask for an address without the ending on the book's page and say
what the book is. Admins find the requests under Addresses (and by email),
look at the book, and grant or decline, with a note to the teacher. A
granted address can be taken back on the book's page: the book returns to
its address with ending, and the freed address redirects there until it is
given to another book.

### Imprint and privacy policy

Under Settings, each is either a link to an existing page or Markdown that
the platform shows at `/imprint` and `/privacy`. Both are linked from every
page of the platform and from the students' login page on book hosts.

### Element runtimes

Element runtimes (Pyodide for PyIDE, Excalidraw, GeoGebra, ...) are the bulk
of a built book — together about 500 MB. The platform extracts them once per
Hyperbook version into `data/shared-runtimes/<version>/` and serves them on
every book host at `/_hyperbook/assets/<version>/`, with a year of immutable
caching: builds link there instead of copying the runtimes into every book,
which keeps builds fast and their output small. Under Settings → Element
runtimes, admins choose per element whether books load its runtime from this
instance or from the element's public CDN; the choice is the default for
books that do not decide in their own `hyperbook.json` (`elements.*.cdn`),
where `false` keeps a local copy in the book and a URL its own CDN. Teachers
who download a build as a zip get one whose runtimes load from the platform.

`data/asset-cache/` holds the runtimes the CLI unpacked for builds, so the
next build does not unpack them again. On start, versions no kept build was
made with are deleted; both directories are part of the data volume and are
recreated on a fresh instance.

### Updates

After an update of the image, published books that were built with another
Hyperbook version are rebuilt in the background, after teachers' own builds
(`REBUILD_ON_UPGRADE=false` turns that off). A rebuild never publishes
unpublished edits: it builds the published version again, and it is
discarded if a teacher publishes in the meantime.

Before a database migration the server writes a copy of the database next to
it, named `database.before-migration-<time>.sqlite`.

### Backups

Everything lives on the `/data` volume: `database.sqlite` (accounts, books,
students and their saved work) and `books/`, one git repository and the
latest builds per book. A consistent copy while the server runs:

```bash
docker compose exec cloud node dist/server/main.js backup /data/backups/$(date +%F)
```

It holds the database and every book's repository (builds are left out),
and refuses a folder that is not empty. Copy it off the server, e.g. with
`restic` or `rsync`, and keep these with it:

- `CREDENTIALS_KEY` (and your `.env`). Without it, students can still log in,
  but their passwords and QR codes cannot be shown or printed again; a
  teacher would have to reset them.

To restore: stop the platform, put `database.sqlite` and `books/` of a
backup into an empty `/data` volume, start it with the same `.env`. Published
books are rebuilt on start (their builds were not in the backup); until
then they show "not published yet".

### Launch checklist

1. DNS: the admin host and a wildcard for `*.<BOOKS_DOMAIN>`, ideally a
   registrable domain of its own.
2. TLS: one of the Caddy examples in [`deploy/`](deploy/).
3. `.env`: `ADMIN_ORIGIN`, `BOOKS_DOMAIN`, a new `CREDENTIALS_KEY`
   (`openssl rand -base64 32`), `ADMIN_EMAIL`/`ADMIN_PASSWORD`, `SMTP_*`.
4. Settings: name, imprint and privacy policy, default entitlements
   (books, storage), sign-up mode.
5. A scheduled backup (above) that is copied off the server, and one test
   restore.
6. Log in as a teacher, make a book, publish it, print student cards, log
   in as a student on a phone.

## Development

```bash
pnpm install
pnpm --filter "hyperbook..." build   # the CLI that builds books, with its element runtimes
pnpm --filter @hyperbook/cloud dev
```

- Admin UI: http://localhost:5173 (Vite; proxies `/api` to the server)
- Books: http://`<slug>`.books.localhost:3001 — browsers resolve every
  `*.localhost` name to your own machine, so no DNS setup is needed.
- Data goes to `./data`. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` on the first
  run to get an admin account.
- Ports taken? `PORT=3101 WEB_PORT=5273 pnpm --filter @hyperbook/cloud dev`

Checks:

```bash
pnpm --filter @hyperbook/cloud test        # unit and API tests
pnpm --filter @hyperbook/cloud typecheck
pnpm --filter @hyperbook/cloud build
pnpm --filter @hyperbook/cloud test:e2e    # browser tests against the build;
                                           # uses /usr/bin/chromium or CHROMIUM_PATH
```

After changing `src/server/db/schema.ts`, generate a migration with
`pnpm --filter @hyperbook/cloud db:generate` and commit it.

### Layout

```
src/server/          Hono server
  app.ts             Host dispatch: admin host vs. book hosts
  admin/             admin API (routes/) and the built app
  books/             book hosts: serves published builds
  hosting/           git repositories, zip import, build queue, sandbox
  db/                Drizzle schema, migrations runner, first-admin seed
  domain/            books, students, entitlements, instance settings, slugs
  auth/ crypto/      passwords, sessions, sealing, tokens
src/shared/          zod schemas used by both server and web app
src/web/             React app (React Router, TanStack Query, shadcn/ui)
  app.css            shadcn variables mapped onto Hyperbook's tokens
drizzle/             generated SQL migrations
tests/               API tests (Vitest), tests/e2e browser tests
```

The web app calls the API through Hono's typed client, so a changed route
shows up as a type error in the app.
