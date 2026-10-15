import { PYODIDE_INDEX_URL } from "./constants.js";
import { runtimes, turtleModules, interruptBuffers } from "./state.js";
import { installTurtle } from "./turtle-module.js";
import { createPytamaroJsFFI } from "./pytamaro-ffi.js";

const loadPyodideScript = () => {
  if (window.loadPyodide) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = new URL("pyodide.js", PYODIDE_INDEX_URL).href;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Pyodide"));
    document.head.appendChild(script);
  });
};

const pyodideReadyPromise = (async () => {
  await loadPyodideScript();
  return window.loadPyodide;
})();

export const getRuntime = async (id) => {
  if (runtimes.has(id)) {
    return runtimes.get(id);
  }
  const loadPyodide = await pyodideReadyPromise;
  const pyodide = await loadPyodide({ indexURL: PYODIDE_INDEX_URL });
  if (typeof pyodide.registerJsModule === "function") {
    turtleModules.set(id, installTurtle(pyodide, id));
    pyodide.registerJsModule("pytamaro_js_ffi", createPytamaroJsFFI());
  }
  if (typeof pyodide.setInterruptBuffer === "function") {
    // Python runs on the page's own thread and reads the buffer whenever it
    // runs, so a plain buffer serves as well as a shared one.
    const interruptBuffer =
      typeof SharedArrayBuffer !== "undefined" && window.crossOriginIsolated
        ? new Int32Array(new SharedArrayBuffer(4))
        : new Int32Array(1);
    pyodide.setInterruptBuffer(interruptBuffer);
    interruptBuffers.set(id, interruptBuffer);
  }
  runtimes.set(id, pyodide);
  return pyodide;
};
