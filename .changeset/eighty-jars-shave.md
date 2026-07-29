---
"@hyperbook/cloud": patch
---

Make the cloud server easier to run and safer to update:

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
