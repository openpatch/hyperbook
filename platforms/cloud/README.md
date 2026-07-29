# Hyperbook Cloud

A web-based student management platform for [Hyperbook](https://github.com/openpatch/hyperbook). It allows teachers and administrators to manage hyperbooks, groups, and student accounts with per-user data persistence.

## Features

- **Hyperbook Management** — Create, update, and delete hyperbooks
- **Group & Student Management** — Organize students into groups with bulk import (CSV), random generation, and printable credential cards
- **User & Permission System** — Create teacher accounts with fine-grained, per-hyperbook permissions
- **Student Data Store** — Per-user, per-hyperbook JSON data persistence (used by hyperbook frontends)
- **Impersonation** — Admins and teachers can view a hyperbook as a specific student (read-only)
- **Password Reset** — Email-based password reset for teachers and admins via SMTP

## Quick Start

### With Docker (recommended)

```bash
cd platforms/cloud
cp .env.example .env      # set JWT_SECRET and BASE_URL
docker compose up -d
```

The admin interface is at `http://localhost:3001/`, with the credentials from
`ADMIN_USERNAME` / `ADMIN_PASSWORD` on first run.

Updating is:

```bash
docker compose pull && docker compose up -d
```

Images are published per release as `ghcr.io/openpatch/hyperbook-cloud:<version>`.
Pin one in `docker-compose.yml` so upgrading is something you choose rather
than something that happens.

### From source

Requires Node.js 20 or newer, because `better-sqlite3` is a native module built
against a specific Node ABI.

```bash
pnpm install
pnpm --filter @hyperbook/cloud dev
```

The server starts at `http://localhost:3001/` with default credentials
`admin` / `admin123`.

## Configuration

Copy `.env.example` to `.env` and adjust the values:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| `JWT_SECRET` | Signs every session token. **Required in production**; the server refuses to start with the placeholder or with fewer than 32 characters. | — |
| `BASE_URL` | Public URL. **Required in production.** Used for password reset links and CORS. | — |
| `PORT` | Server port | `3001` |
| `NODE_ENV` | `development` or `production` | `development` |
| `JWT_EXPIRES_IN` | JWT token lifetime | `24h` |
| `ADMIN_USERNAME` | Initial admin username (first run only) | `admin` |
| `ADMIN_PASSWORD` | Initial admin password (first run only) | `admin123` |
| `DATABASE_PATH` | SQLite file. Ignored under Compose, which uses a volume. | `./database.sqlite` |
| `SNAPSHOT_THRESHOLD` | Events before the server compacts them into a snapshot | `100` |
| `SMTP_HOST` | SMTP server hostname | — |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USER` | SMTP username | — |
| `SMTP_PASS` | SMTP password | — |
| `SMTP_FROM` | Sender email address | `noreply@example.com` |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Leave every `SMTP_*` value empty to run without email. Setting only some of
them is rejected in production, because a half configuration silently sends
nothing.

## Users & Permissions

There are three roles:

| Role | Description |
|---|---|
| **admin** | Full access to everything. Can manage teachers and their permissions. |
| **teacher** | Scoped access based on assigned permissions. Can log in to the admin interface. |
| **student** | Can only authenticate via the API and read/write their own data store. |

### Permission Types

Permissions are string-based and assigned per teacher by an admin.

| Permission | Scope | Description |
|---|---|---|
| `hyperbooks:create` | Global | Create new hyperbooks |
| `hyperbook:<id>:read` | Per hyperbook | View hyperbook, its groups, and students |
| `hyperbook:<id>:update` | Per hyperbook | Update hyperbook details |
| `hyperbook:<id>:delete` | Per hyperbook | Delete hyperbook |
| `hyperbook:<id>:groups:create` | Per hyperbook | Create groups |
| `hyperbook:<id>:groups:update` | Per hyperbook | Update groups |
| `hyperbook:<id>:groups:delete` | Per hyperbook | Delete groups |
| `hyperbook:<id>:students:create` | Per hyperbook | Create students |
| `hyperbook:<id>:students:update` | Per hyperbook | Update student passwords |
| `hyperbook:<id>:students:delete` | Per hyperbook | Delete students |

Permissions are managed at **Admin → Users → (select user) → Permissions** using a checkbox matrix.

## Production Deployment

In production the server refuses to start until `JWT_SECRET` and `BASE_URL` are
set, and it will tell you exactly what is missing. This is deliberate: with the
placeholder secret, anyone who has read this repository can mint a valid token
for any account, and nothing in the logs would say so.

### With Docker Compose

`docker-compose.yml` in this directory is the whole deployment. Edit `.env`,
then:

```bash
docker compose up -d
docker compose logs -f
```

It binds to `127.0.0.1:3001` by default, expecting a reverse proxy in front for
TLS — see [Reverse Proxy](#reverse-proxy) below. The database lives on a named
volume, so `docker compose down` does not take it with it.

> If you replace the named volume with a bind mount (`./data:/data`), make the
> host directory writable by UID 1000, which the container runs as. Otherwise
> the first upgrade refuses to start: it cannot write its backup, and it will
> not migrate without one.

### With PM2

If you would rather not use containers:

```bash
git clone https://github.com/openpatch/hyperbook.git
cd hyperbook
pnpm install --filter @hyperbook/cloud --prod
cd platforms/cloud
cp .env.example .env      # edit it
npm install -g pm2
pm2 start ecosystem.config.js
pm2 startup && pm2 save
```

`ecosystem.config.js` is committed alongside this README. It logs to
`./logs/` and keeps the database wherever `DATABASE_PATH` points.

> Run **one** instance only. SQLite does not support concurrent writes from
> multiple processes, so `instances: 1` is not a starting point to tune.

Update with:

```bash
git pull
pnpm install --filter @hyperbook/cloud --prod
pm2 restart hyperbook-cloud
```

### Reverse Proxy

```nginx
server {
    listen 443 ssl http2;
    server_name cloud.example.com;

    ssl_certificate     /etc/letsencrypt/live/cloud.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cloud.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name cloud.example.com;
    return 301 https://$host$request_uri;
}
```

`/api/health` returns `200` once the server is up, for uptime checks and
container orchestration.

## Schema Migrations

The schema is versioned with SQLite's `user_version` and migrated on startup.

- Each migration runs at most once, in order, and the version is only recorded
  after it succeeds — so an interrupted upgrade re-runs the step rather than
  skipping it.
- **The database is copied aside before any migration that has work to do**, via
  `VACUUM INTO`, next to the database file as `<name>.v<version>-<timestamp>.backup`.
  The five most recent are kept. If the copy cannot be written, the migration
  does not run.
- Starting a build **older** than the one that last wrote the database is
  refused, rather than left to read columns it does not understand.

Adding a schema change means appending an entry to `MIGRATIONS` in
`lib/migrations.js`. Never edit or renumber an existing one: deployments have
already run it and will not run it again.

## Backups

All state is one SQLite file. Upgrades back it up on their own (see above), but
that is not a substitute for a schedule.

Use `VACUUM INTO` rather than `cp`: it takes a consistent copy of a database
that is being written to, which a file copy does not.

```bash
# Docker
docker compose exec -T cloud node -e "\
  new (require('better-sqlite3'))('/data/database.sqlite', { readonly: true })\
    .exec(\"VACUUM INTO '/data/backup-$(date +%F).sqlite'\")"

# From source
node -e "\
  new (require('better-sqlite3'))(process.env.DATABASE_PATH, { readonly: true })\
    .exec(\"VACUUM INTO '/backups/hyperbook-cloud-$(date +%F).sqlite'\")"
```

Restoring is stopping the server, putting the file back, and starting it again.

## API Reference

All API routes require a JWT Bearer token obtained via `POST /api/auth/login`.

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Login with `{ username, password }` → returns `{ token, user }` |
| `POST` | `/api/auth/verify` | Verify token validity |

### Admin — Hyperbooks

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/hyperbooks` | List hyperbooks (scoped by permissions for teachers) |
| `POST` | `/api/hyperbooks` | Create hyperbook `{ slug, name, url?, description? }` |
| `PUT` | `/api/hyperbooks/:id` | Update hyperbook |
| `DELETE` | `/api/hyperbooks/:id` | Delete hyperbook |

### Admin — Groups

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/hyperbooks/:hbId/groups` | List groups for a hyperbook |
| `POST` | `/api/hyperbooks/:hbId/groups` | Create group `{ name, description? }` |
| `PUT` | `/api/groups/:id` | Update group |
| `DELETE` | `/api/groups/:id` | Delete group |

### Admin — Students

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/students?groupId=X` | List students |
| `POST` | `/api/students` | Create student `{ username, password, groupId }` |
| `POST` | `/api/students/bulk` | Bulk create `{ students: [...], groupId }` |
| `POST` | `/api/students/bulk-csv` | Bulk create from CSV `{ csv, groupId }` |
| `PUT` | `/api/students/:id/password` | Reset student password |
| `DELETE` | `/api/students/:id` | Delete student |
| `GET` | `/api/students/:id/store` | Download student's stored data |
| `POST` | `/api/impersonate/:id` | Generate impersonation token |

### Admin — Users & Permissions (admin only)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/users` | List teachers |
| `POST` | `/api/users` | Create teacher `{ username, password, email? }` |
| `PUT` | `/api/users/:id` | Update teacher `{ username, email? }` |
| `PUT` | `/api/users/:id/password` | Reset teacher password |
| `DELETE` | `/api/users/:id` | Delete teacher |
| `GET` | `/api/users/:id/permissions` | List teacher permissions |
| `POST` | `/api/users/:id/permissions` | Grant permission `{ permission }` |
| `DELETE` | `/api/users/:id/permissions` | Revoke permission `{ permission }` |

### Student Data Store

Hyperbooks sync through these. See
[the Cloud documentation](https://openpatch.org/hyperbook/en/book/configuration/cloud)
for how the client uses them.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/store/:hyperbookId` | Reconstructed state (latest snapshot with events replayed on top) |
| `POST` | `/api/store/:hyperbookId/events` | Append a batch of events. Takes `afterEventId`; answers `409` if the client is behind |
| `POST` | `/api/store/:hyperbookId/snapshot` | Replace all state. Discards that user's events and previous snapshots |

## Database

Hyperbook Cloud uses SQLite via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3). The schema is created and migrated on startup — see [Schema Migrations](#schema-migrations).

### Tables

- `hyperbooks` — Hyperbook definitions (slug, name, url, description)
- `groups` — Student groups within hyperbooks
- `users` — All accounts (admin, teacher, student)
- `permissions` — Per-user permission grants
- `events` — Per-user, per-hyperbook change log, one row per store write
- `snapshots` — Compacted state, written every `SNAPSHOT_THRESHOLD` events

A `stores` table held one JSON blob per user before event sourcing. It is
folded into `snapshots` on upgrade and then dropped.

### Password Storage

- **Admin & Teacher** passwords are hashed with bcrypt
- **Student** passwords are stored in plain text (for printable credential cards)
