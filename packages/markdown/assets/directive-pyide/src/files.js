/**
 * Puts an IDE's workspace into its Pyodide file system before a run, so the
 * main file can `import helpers` and `open("data.csv")`.
 *
 * Every pyide has its own Pyodide (see pyodide.js), so the files of one
 * directive never show up in another.
 */

export const WORKDIR = "/home/pyodide";

/** Paths written for each directive, so files removed since can be deleted. */
const writtenFiles = new Map();

/** Binary files are fetched once per page load. */
const binaryCache = new Map();

const fetchBinary = (url) => {
  if (!binaryCache.has(url)) {
    binaryCache.set(
      url,
      fetch(url).then(async (response) => {
        if (!response.ok) throw new Error(`${response.status} ${url}`);
        return new Uint8Array(await response.arrayBuffer());
      }),
    );
  }
  return binaryCache.get(url);
};

/**
 * Forgets the reader's own modules, so an edited helpers.py is imported anew
 * instead of the version cached by the previous run.
 */
const FORGET_WORKSPACE_MODULES = `
def __hyperbook_forget_workspace_modules(root):
    import importlib, os, sys
    for name, module in list(sys.modules.items()):
        file = getattr(module, "__file__", None) or ""
        if file.startswith(root + "/"):
            del sys.modules[name]
    if root not in sys.path:
        sys.path.insert(0, root)
    os.chdir(root)
    importlib.invalidate_caches()

__hyperbook_forget_workspace_modules(${JSON.stringify(WORKDIR)})
del __hyperbook_forget_workspace_modules
`;

/**
 * The files a run needs on disk: everything but tests, which run as scripts
 * of their own, and the solution a drawing is compared with.
 * @param {import("../../hyperbook.types.js").HyperbookIdeFile[]} files
 */
export const filesForDisk = (files) =>
  files.filter(
    (file) =>
      !file.role &&
      typeof file.path === "string" &&
      (typeof file.content === "string" || typeof file.url === "string"),
  );

/**
 * Writes the workspace below WORKDIR and removes what an earlier run wrote
 * that is no longer part of it.
 *
 * @param {string} id
 * @param {*} pyodide
 * @param {import("../../hyperbook.types.js").HyperbookIdeFile[]} files
 * @returns {Promise<string[]>} Warnings, e.g. a binary file that failed to load.
 */
export const syncWorkspaceFiles = async (id, pyodide, files) => {
  const FS = pyodide.FS;
  const previous = writtenFiles.get(id) || new Set();
  const current = new Set();
  const warnings = [];

  for (const file of filesForDisk(files)) {
    const target = `${WORKDIR}/${file.path}`;
    let data = file.content;
    if (typeof data !== "string") {
      try {
        data = await fetchBinary(file.url);
      } catch (error) {
        warnings.push(`Could not load ${file.path}: ${error.message}`);
        continue;
      }
    }
    const dir = target.slice(0, target.lastIndexOf("/"));
    FS.mkdirTree(dir);
    FS.writeFile(target, data);
    current.add(target);
  }

  for (const target of previous) {
    if (current.has(target)) continue;
    try {
      FS.unlink(target);
    } catch {
      // Already gone, e.g. the program deleted it itself.
    }
  }
  writtenFiles.set(id, current);

  pyodide.runPython(FORGET_WORKSPACE_MODULES, {
    filename: "<hyperbook-workspace>",
  });
  return warnings;
};
