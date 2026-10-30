#!/usr/bin/env node
// Test-safety guard, enforced by the husky pre-commit hook and CI.
//
// Rejects:
//   1. `rm` with the recursive flag plus an *unquoted* glob in shell scripts
//      (*.sh, .husky/*, and package.json "scripts") — the shellcheck SC2115
//      class of bug, e.g. `rm -rf /tmp/foo/*` in a shared tmp dir.
//   2. Hard-coded ports (listen(<n> with n !== 0, PORT set to a numeric
//      literal, http://localhost:<digits> style URLs) or references to the
//      real database file (`database.sqlite`) in
//      platforms/cloud/tests/e2e/**/*.ts — e2e runs must use port 0 and a
//      throwaway DB in a fresh mkdtemp dir (see platforms/cloud/AGENTS.md).
//
// Dependency-free on purpose: it must run before `pnpm install` in CI and
// inside the pre-commit hook. Exit code 1 lists every violation.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "_"]);

const violations = [];
function fail(file, line, text, rule) {
  violations.push(`${path.relative(root, file)}:${line}: ${rule}\n    ${text.trim()}`);
}

/** Walks the repo (skipping node_modules/.git/dist) and yields file paths. */
function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

// --- Rule 1: rm -r* with an unquoted glob in shell-ish text (SC2115) --------

/** Removes quoted spans so a `*` inside quotes is not mistaken for a glob. */
function stripQuotes(line) {
  return line.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, '""');
}

function checkShellLine(file, lineNo, line) {
  const bare = stripQuotes(line);
  const rm = bare.match(/\brm\s+((?:-{1,2}[^\s#]+\s+)*)/);
  if (!rm) return;
  const flags = rm[1].replace(/\s+/g, "");
  if (!flags.includes("r")) return; // only recursive rm can wipe a tree
  if (bare.includes("*")) {
    fail(file, lineNo, line, "rm with -r and an unquoted * (SC2115): delete only paths you created (captured mkdtemp name), quoted");
  }
}

function checkShellFile(file) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => checkShellLine(file, i + 1, line));
}

/**
 * JS/TS files in scripts/ dirs may shell out (`execSync("rm -rf /tmp/*")`);
 * there the quotes are JS quotes, so the glob reaches the shell intact.
 * Flag any rm command with flags plus a `*` on the same line.
 */
function checkScriptJsLine(file, lineNo, line) {
  if (/^\s*(\/\/|\/\*|\*|#)/.test(line)) return; // comment lines document the rule, they don't break it
  if (/\brm\s+(-[\w-]+\s+)+[^#\n]*\*/.test(line)) {
    fail(file, lineNo, line, "rm with flags and a glob in a scripts/ file (SC2115-class): delete only paths you created (captured mkdtemp name)");
  }
}

function checkPackageJson(file) {
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return; // not our problem here
  }
  for (const [name, script] of Object.entries(pkg.scripts ?? {})) {
    String(script)
      .split(/\n|&&|\|\|/)
      // package.json scripts run in a shell, so the shell rules apply.
      .forEach((part, i) => checkShellLine(file, i + 1, part));
  }
}

// --- Rule 2: e2e files must not hard-code ports or the real DB --------------

const E2E_DIR = path.join(root, "platforms/cloud/tests/e2e");

function checkE2eFile(file) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      const lineNo = i + 1;
      const listen = line.match(/\blisten\s*\(\s*(\d+)/);
      if (listen && Number(listen[1]) !== 0) {
        fail(file, lineNo, line, `hard-coded port in listen(${listen[1]}): use listen(0) and read the assigned port (freePort())`);
      }
      const portEnv = line.match(/\bPORT\s*[:=]\s*["'`]?(\d{2,5})\b/);
      if (portEnv) {
        fail(file, lineNo, line, `hard-coded PORT=${portEnv[1]}: use an ephemeral port (port 0), never a fixed one`);
      }
      const urlPort = line.match(/\b(?:localhost|127\.0\.0\.1|\[::1\]|books\.localhost):(\d{2,5})\b/);
      if (urlPort) {
        fail(file, lineNo, line, `hard-coded port :${urlPort[1]} in a URL: build the origin from the ephemeral port`);
      }
      if (/database\.sqlite/.test(line)) {
        fail(file, lineNo, line, "references the real database.sqlite: e2e must use a throwaway DB (:memory: or inside a mkdtemp DATA_DIR), never the repo's platforms/cloud/database.sqlite");
      }
    });
}

// --- Run --------------------------------------------------------------------

for (const file of walk(root)) {
  const inScriptsDir = /(^|\/)scripts\/[^/]+\.(mjs|cjs|js|ts)$/.test(file);
  if (file.endsWith(".sh") || file.startsWith(path.join(root, ".husky") + path.sep)) checkShellFile(file);
  else if (inScriptsDir) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => checkScriptJsLine(file, i + 1, line));
  } else if (path.basename(file) === "package.json") checkPackageJson(file);
}

if (statSync(E2E_DIR).isDirectory()) {
  for (const file of walk(E2E_DIR)) {
    if (file.endsWith(".ts")) checkE2eFile(file);
  }
}

if (violations.length > 0) {
  console.error(`guard-test-safety: ${violations.length} violation(s):\n\n${violations.join("\n\n")}\n`);
  console.error("See platforms/cloud/AGENTS.md: no rm -r with unquoted globs in shared tmp;");
  console.error("e2e runs use a fresh tmpdir, port 0, and a throwaway database.");
  process.exit(1);
}
console.log("guard-test-safety: ok (no rm -r with unquoted globs, no hard-coded e2e ports/DB)");
