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

```bash
# Install dependencies
npm install

# Start in development mode (auto-restart on file changes)
npm run dev
```

The server starts at `http://localhost:3001/` with default credentials `admin` / `admin123`.

## Configuration

Copy `.env.example` to `.env` and adjust the values:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment (`development` or `production`) | `development` |
| `JWT_SECRET` | Secret key for JWT tokens — **must change in production** | `default-secret-...` |
| `JWT_EXPIRES_IN` | JWT token lifetime | `24h` |
| `ADMIN_USERNAME` | Initial admin username (first run only) | `admin` |
| `ADMIN_PASSWORD` | Initial admin password (first run only) | `admin123` |
| `DATABASE_PATH` | Path to SQLite database file | `./database.sqlite` |
| `SMTP_HOST` | SMTP server hostname | — |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USER` | SMTP username | — |
| `SMTP_PASS` | SMTP password | — |
| `SMTP_FROM` | Sender email address | `noreply@example.com` |
| `BASE_URL` | Public URL (used in password reset links and for CORS) | required |

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

## Production Deployment with PM2

### 1. Prerequisites

```bash
# Install Node.js 18+ and npm
# Then install PM2 globally
npm install -g pm2
```

### 2. Setup

```bash
# Clone and install
git clone <repo-url>
cd hyperbook/platforms/cloud
npm install --production

# Create production config
cp .env.example .env
```

Edit `.env` with production values:

```env
PORT=3001
NODE_ENV=production

# Generate a strong random secret
JWT_SECRET=your-random-secret-here-at-least-32-chars

ADMIN_USERNAME=admin
ADMIN_PASSWORD=a-strong-admin-password

# Persistent database location
DATABASE_PATH=/var/lib/hyperbook-cloud/database.sqlite

# SMTP for password reset
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=smtp-password
SMTP_FROM=noreply@example.com

BASE_URL=https://cloud.example.com
```

### 3. Create an ecosystem file

Create `ecosystem.config.js`:

```js
module.exports = {
  apps: [
    {
      name: "hyperbook-cloud",
      script: "./bin/www",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: "256M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/var/log/hyperbook-cloud/error.log",
      out_file: "/var/log/hyperbook-cloud/out.log",
      merge_logs: true,
    },
  ],
};
```

> **Note:** Since Hyperbook Cloud uses SQLite, only run **1 instance**. SQLite does not support concurrent writes from multiple processes.

### 4. Start with PM2

```bash
# Create log directory
sudo mkdir -p /var/log/hyperbook-cloud
sudo chown $USER:$USER /var/log/hyperbook-cloud

# Create database directory
sudo mkdir -p /var/lib/hyperbook-cloud
sudo chown $USER:$USER /var/lib/hyperbook-cloud

# Start the application
pm2 start ecosystem.config.js

# Check status
pm2 status
pm2 logs hyperbook-cloud

# Enable startup on boot
pm2 startup
pm2 save
```

### 5. Reverse Proxy (Nginx)

Place behind Nginx for HTTPS and static caching:

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

### 6. Common PM2 Commands

```bash
pm2 start hyperbook-cloud      # Start
pm2 stop hyperbook-cloud       # Stop
pm2 restart hyperbook-cloud    # Restart
pm2 reload hyperbook-cloud     # Zero-downtime reload
pm2 delete hyperbook-cloud     # Remove from PM2
pm2 logs hyperbook-cloud       # View logs
pm2 monit                      # Real-time monitoring dashboard
```

### 7. Updating

```bash
cd hyperbook/platforms/cloud
git pull
npm install --production
pm2 restart hyperbook-cloud
```

## Backups

The entire application state lives in a single SQLite file. Back it up regularly:

```bash
# One-time backup
cp /var/lib/hyperbook-cloud/database.sqlite /backups/hyperbook-cloud-$(date +%F).sqlite

# Cron job (daily at 2 AM)
0 2 * * * cp /var/lib/hyperbook-cloud/database.sqlite /backups/hyperbook-cloud-$(date +\%F).sqlite
```

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

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/store/:hyperbookId` | Get stored data for current user |
| `POST` | `/api/store/:hyperbookId` | Save data `{ data }` |

## Database

Hyperbook Cloud uses SQLite via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3). The schema is automatically created and migrated on startup.

### Tables

- `hyperbooks` — Hyperbook definitions (slug, name, url, description)
- `groups` — Student groups within hyperbooks
- `users` — All accounts (admin, teacher, student)
- `permissions` — Per-user permission grants
- `stores` — Per-user, per-hyperbook JSON data

### Password Storage

- **Admin & Teacher** passwords are hashed with bcrypt
- **Student** passwords are stored in plain text (for printable credential cards)
