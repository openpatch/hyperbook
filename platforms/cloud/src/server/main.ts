import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { backup as backupInstance } from "./backup";
import { deleteExpired } from "./auth/sessions";
import { deleteExpiredPreviewSessions } from "./auth/preview-sessions";
import { deleteExpiredStudentSessions } from "./auth/student-sessions";
import { ConfigError, loadConfig } from "./config";
import { cdnElements, getInstanceSettings } from "./domain/instance";
import { migrateDb, openDb } from "./db/client";
import { ensureFirstAdmin } from "./db/seed";
import { BuildQueue } from "./hosting/builds";
import { Renderers } from "./hosting/renders";
import {
  pruneAssetCache,
  pruneSharedRuntimes,
  sharedAssetsBaseFor,
} from "./hosting/runtimes";
import { clearTmp, repoDir } from "./hosting/storage";
import { fillMissingSourceBytes } from "./domain/storage";
import { headCommit, listTree } from "./hosting/git";
import { hyperbookVersion } from "./hosting/runner";
import { createDns } from "./dns";
import { createUrlFetcher } from "./https";
import { createMailer } from "./mail";

async function start() {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }

  // `main.js backup <dir>`: copy the running instance, then exit.
  if (process.argv[2] === "backup") {
    const target = process.argv[3];
    if (!target) {
      console.error("Usage: node dist/server/main.js backup <empty folder>");
      process.exit(1);
    }
    const { dest, books } = await backupInstance(config, target);
    console.log(`Backed up the database and ${books} book(s) to ${dest}`);
    console.log("Keep CREDENTIALS_KEY (and your .env) safe as well: without it, student logins cannot be printed again.");
    return;
  }

  mkdirSync(config.dataDir, { recursive: true });
  const file = path.join(config.dataDir, "database.sqlite");
  const { db, sqlite } = openDb(file);

  // Both the source (src/server/main.ts) and the bundle (dist/server/main.js)
  // sit two levels below the package root, next to drizzle/.
  const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));
  const { applied, backup } = migrateDb(sqlite, db, { migrationsFolder, file });
  if (applied > 0) {
    console.log(
      `Applied ${applied} database migration(s)` +
        (backup ? `; the previous database was saved as ${backup}` : ""),
    );
  }

  switch (await ensureFirstAdmin(db, config.firstAdmin)) {
    case "created":
      console.log(`Created the first admin account (${config.firstAdmin!.email})`);
      break;
    case "missing":
      console.warn(
        "There is no admin account yet. Set ADMIN_EMAIL and ADMIN_PASSWORD and restart to create one.",
      );
      break;
  }

  const removeExpired = () => {
    deleteExpired(db);
    deleteExpiredStudentSessions(db);
    deleteExpiredPreviewSessions(db);
  };
  removeExpired();
  const cleanup = setInterval(removeExpired, 60 * 60 * 1000);
  cleanup.unref();

  const webRoot =
    config.env === "production"
      ? fileURLToPath(new URL("../web", import.meta.url))
      : undefined;

  clearTmp(config);

  // Element runtimes are extracted once per Hyperbook version and served to
  // every book; builds copy only the small integration scripts. A build
  // extracts the runtimes of the elements its book uses (see runner.ts), a
  // reader's first request extracts anything else. Admins may load single
  // elements from their public CDN instead (Settings → Element runtimes).
  // Drop versions and download cache entries nothing uses anymore.
  const settings = () => getInstanceSettings(db);
  const sharedAssets = sharedAssetsBaseFor(config, cdnElements(settings()));
  if (sharedAssets)
    console.log(`Element runtimes: one copy for all books, served at ${sharedAssets}`);
  pruneSharedRuntimes(db, config);
  await pruneAssetCache(config);

  await fillMissingSourceBytes(db, async (bookId) => {
    const repo = repoDir(config, bookId);
    const commit = await headCommit(repo).catch(() => null);
    return commit ? (await listTree(repo, commit)).reduce((sum, e) => sum + e.size, 0) : null;
  });
  const builds = new BuildQueue(db, config);
  builds.start();
  const rebuilding = builds.enqueueRebuilds({ upgrades: config.build.rebuildOnUpgrade });
  if (rebuilding > 0) console.log(`Rebuilding ${rebuilding} book(s) with Hyperbook ${hyperbookVersion(config)}`);

  const renders = new Renderers(config, undefined, () => cdnElements(settings()));
  const app = createApp(
    { config, db, mailer: createMailer(config), builds, renders, dns: createDns(), fetchUrl: createUrlFetcher() },
    { webRoot },
  );
  const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
    console.log(`Hyperbook Cloud listening on port ${info.port}`);
    console.log(`  admin  ${config.adminOrigin}`);
    console.log(`  books  ${config.booksProtocol}//<slug>.${config.booksDomain}`);
  });

  const shutdown = () => {
    server.close(async () => {
      renders.closeAll();
      await builds.stop();
      sqlite.close();
      process.exit(0);
    });
    // Idle keep-alive connections would hold close() open indefinitely.
    if ("closeAllConnections" in server) server.closeAllConnections();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

await start();
