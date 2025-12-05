// Setup your project to serve `py-worker.js`. You should also serve
// `pyodide.js`, and all its associated `.asm.js`, `.json`,
// and `.wasm` files as well:
importScripts("https://cdn.jsdelivr.net/pyodide/v0.29.0/full/pyodide.js");

class StdinHandler {
  constructor(results, options) {
    this.results = results;
    this.idx = 0;
    Object.assign(this, options);
  }

  stdin() {
    return this.results[this.idx++];
  }
}

async function loadPyodideAndPackages() {
  var pyodide = await loadPyodide();
  self.pyodide = pyodide;
  await self.pyodide.loadPackage([]);
}
let pyodideReadyPromise = loadPyodideAndPackages();

self.onmessage = async ({ data: { id, type, payload } }) => {
  switch (type) {
    case "run": {
      // make sure loading is done
      await pyodideReadyPromise;
      // Don't bother yet with this line, suppose our API is built in such a way:
      const { python, inputs, ...context } = payload;
      // The worker copies the context in its own "memory" (an object mapping name to values)
      for (const key of Object.keys(context)) {
        self[key] = context[key];
      }

      self.pyodide.setStdin(new StdinHandler(inputs));

      self.pyodide.setStdout({
        batched: (msg) => {
          self.postMessage({ id, type: "stdout", payload: msg });
        },
      });

      self.pyodide.setStderr({
        batched: (msg) => {
          self.postMessage({ id, type: "stderr", payload: msg });
        },
      });

      // Now is the easy part, the one that is similar to working in the main thread:
      const filename = "<exec>";
      try {
        await self.pyodide.loadPackagesFromImports(python);
        const dict = self.pyodide.globals.get("dict");
        const globals = dict();
        let results = await self.pyodide.runPythonAsync(python, {
          globals,
          locals: globals,
          filename,
        });
        globals.destroy();
        dict.destroy();
        self.postMessage({ type: "success", id, payload: results });
      } catch (error) {
        // clean up trackback
        let message = error.message;
        if (message.startsWith("Traceback")) {
          const lines = message?.split("\n") || [];
          const i = lines.findIndex((line) => line.includes(filename));
          message = lines[0] + "\n" + lines.slice(i).join("\n");
          self.postMessage({ type: "error", payload: message, id });
        }
        self.postMessage({ type: "error", payload: message, id });
      }
      break;
    }
    case "setInterruptBuffer": {
      const { interruptBuffer } = payload;
      // make sure loading is done
      await pyodideReadyPromise;
      self.pyodide.setInterruptBuffer(interruptBuffer);
      break;
    }
  }
};
