import fs from "fs/promises";
import path from "path";

/**
 * Running from source means the package root has no `assets` or `locales`
 * next to it: `pnpm build` only ever puts them in dist/, and both are
 * gitignored. The dev/build tests need them where the source expects them.
 *
 * This has to happen once, before any test file runs. When each file staged
 * for itself, a second file could see the destination directory already there
 * — created by a copy still in flight — skip staging, and then build against
 * half of the assets. That surfaced as an ENOENT on `__hyperbook_assets/i18n.js`
 * mid-build, which the dev server reported as a rebuild error instead of the
 * reload the test was waiting for.
 *
 * The copy still goes to a scratch directory and is renamed into place, so a
 * run killed halfway through cannot leave a partial tree behind for the next
 * one to trust.
 */
export default async function stageBundledFiles() {
  const pkg = path.join(__dirname, "..");
  const markdownDist = path.join(
    pkg,
    "node_modules",
    "@hyperbook",
    "markdown",
    "dist",
  );

  for (const name of ["assets", "locales"]) {
    const dest = path.join(pkg, name);
    if (await fs.stat(dest).catch(() => null)) continue;

    const staging = `${dest}.staging-${process.pid}`;
    await fs.rm(staging, { recursive: true, force: true });
    await fs.cp(path.join(markdownDist, name), staging, { recursive: true });
    try {
      await fs.rename(staging, dest);
    } catch (e: any) {
      // Someone else published a complete tree first — theirs is as good as ours.
      if (e.code !== "EEXIST" && e.code !== "ENOTEMPTY") throw e;
      await fs.rm(staging, { recursive: true, force: true });
    }
  }
}
