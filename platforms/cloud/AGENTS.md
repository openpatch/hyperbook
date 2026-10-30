# AGENTS.md — platforms/cloud

Safety rules for working on the cloud platform. These exist because
`platforms/cloud/database.sqlite` (and `platforms/cloud/data/`) is the **real
development database** — tests and experiments must never open, migrate, or
delete it.

## Deleting files in shared tmp

- **Never `rm -rf` with an unquoted glob** (`rm -rf /tmp/foo/*`, `rm -rf "$DIR"/*`
  where `DIR` may be empty, etc.) in a shared tmp dir like `/tmp` or
  `os.tmpdir()`. An empty or wrong variable turns it into `rm -rf /*`-class
  destruction of other processes' files. (This is shellcheck **SC2115**.)
- **Delete only paths you created yourself.** Create the directory with
  `mkdtempSync(path.join(os.tmpdir(), "..."))`, capture the returned name in a
  variable, and later remove exactly that path — e.g.
  `rmSync(dir, { recursive: true, force: true })` or `rm -rf "$dir"` (quoted,
  captured name only). See `tests/e2e/server.ts` and `tests/helpers.ts` for the
  pattern; `tests/setup.ts` removes only the `mkdtemp` dirs recorded in
  `dataDirs`.

## E2E and test runs

- Every e2e/test run uses a **fresh tmpdir** (`mkdtemp` under `os.tmpdir()`)
  for `DATA_DIR`, a **throwaway database** (`openDb(":memory:")` for unit
  tests; for the spawned e2e server the DB lives inside the mkdtemp `DATA_DIR`),
  and **port 0 / an ephemeral port** (`listen(0)` and read the assigned port —
  see `freePort()` in `tests/e2e/server.ts`). Never hard-code a port.
- **Never point `DATA_DIR` or the DB at the repo.** `platforms/cloud/database.sqlite`
  and `platforms/cloud/data/` are the real dev database; no test, script, or
  agent run may use, back up, migrate, or delete them. If you need the real
  data, say so explicitly — don't let a default (`DATA_DIR` unset → `./data`
  relative to cwd) silently resolve into the package directory.

## Piping test output

- When piping `test:e2e` into `tail`/`less` under a timeout, use
  `set -o pipefail` first, so a failing run cannot be masked by the exit code
  of the last pipe stage:

  ```sh
  set -o pipefail
  timeout 600 pnpm --filter @hyperbook/cloud test:e2e | tail -n 40
  ```

## i18n: no hardcoded user-facing text

Every string a user can read — pages, components, the editor, toasts,
`aria-label`s, dialog titles, server validation messages, emails — comes from
the shared catalog in `src/shared/i18n/`. **Never hardcode English UI text** in
a string literal, template literal, or JSX text node; write the string as a
key in both catalogs and translate it:

- **Web components:** `useTranslation()` from `react-i18next`, then
  `t("section.key")`. Text containing markup (links, `<code>`) goes through
  `<Trans i18nKey=...>` with an `<a>`-style placeholder in the message.
- **Non-React modules** (CodeMirror extensions, editors):
  `import i18next from "i18next"` and `i18next.t("section.key")`.
- **Server code:** `createT(locale)` from `src/shared/i18n`.
- **Validation messages:** zod `message:` and error strings are catalog keys
  (`validation.*`); the client translates them through `useMessage`/
  `FormError`. Keys with dynamic parts use `{{param}}` interpolation, plurals
  use the `_one`/`_other` suffixes (pass `count`).

The English catalog (`locales/en.ts`) is the source of truth and defines the
key shape; `locales/de.ts` is typed against it, and `tests/i18n.test.ts`
fails when a key is missing in any locale. When you add a key to `en.ts`, add
the German translation to `de.ts` in the same change — run
`pnpm --filter @hyperbook/cloud test` (or at least `npx vitest run
tests/i18n.test.ts`) to confirm the catalogs stay in sync.

## Enforcement

`scripts/guard-test-safety.mjs` (repo root) rejects, in the husky pre-commit
hook and in CI:

- `rm` with the recursive flag plus an unquoted `*` in shell scripts
  (`*.sh`, `.husky/*`) and in `package.json` `scripts` (SC2115-style), and
- hard-coded ports or references to the real `database.sqlite` in
  `platforms/cloud/tests/e2e/**/*.ts` (including `server.ts`).

Keep it green: run `node scripts/guard-test-safety.mjs` after touching scripts
or e2e files.
