/*
 * CheerpJ worker of the javaide element: loads the JVM, compiles the
 * workspace with the JDK's javac and runs the entry classes, streaming the
 * Java console back to the page. Terminating the worker stops the program.
 */

let initialized = false;
let loaderUrl = null;
/** Index of the entry class currently running, for its output messages. */
let currentEntry = null;

const send = (msg) => self.postMessage(msg);

const captureConsole = () => {
  for (const level of ["log", "info", "warn", "error"]) {
    const original = self.console[level]?.bind(self.console);
    self.console[level] = (...args) => {
      const text =
        args.map((a) => (typeof a === "string" ? a : String(a))).join(" ") +
        "\n";
      send({
        type: "output",
        stream: level === "warn" || level === "error" ? "err" : "out",
        entry: currentEntry,
        text,
      });
      original?.(...args);
    };
  }
};

self.onmessage = async (event) => {
  const msg = event.data || {};
  if (msg.type === "init") {
    loaderUrl = msg.loaderUrl;
    return;
  }
  if (msg.type !== "run") return;
  const { runId, files = [], entries = [] } = msg;
  try {
    if (!initialized) {
      importScripts(loaderUrl);
      captureConsole();
      // CheerpJ 5 ships the full JDK for every supported Java version, so
      // javac below is the JDK's own compiler.
      await self.cheerpjInit({ version: 17, status: "none" });
      initialized = true;
    }
    const outDir = `/files/hyperbook-${runId}`;
    // /str/ holds flat string files, so every workspace file goes in under its
    // own file name.
    const sources = [];
    for (const file of files) {
      const name = String(file.path || "").split("/").pop();
      if (!name) continue;
      const vpath = `/str/${name}`;
      if (typeof file.content === "string") {
        self.cheerpOSAddStringFile(vpath, file.content);
      } else if (file.url) {
        const response = await fetch(file.url);
        const buffer = await response.arrayBuffer();
        self.cheerpOSAddStringFile(vpath, new Uint8Array(buffer));
      } else {
        continue;
      }
      if (name.toLowerCase().endsWith(".java")) sources.push(vpath);
    }
    currentEntry = null;
    const compileCode = await self.cheerpjRunMain(
      "com.sun.tools.javac.Main",
      outDir,
      "-encoding",
      "UTF-8",
      "-d",
      outDir,
      ...sources,
    );
    send({ type: "compile-done", runId, exitCode: compileCode });
    if (compileCode !== 0) {
      send({ type: "all-done", runId });
      return;
    }
    for (let i = 0; i < entries.length; i++) {
      currentEntry = i;
      send({ type: "entry-start", runId, index: i });
      const exitCode = await self.cheerpjRunMain(entries[i].className, outDir);
      send({ type: "entry-done", runId, index: i, exitCode });
    }
    currentEntry = null;
    send({ type: "all-done", runId });
  } catch (error) {
    send({ type: "error", runId, text: String((error && error.stack) || error) });
  }
};
