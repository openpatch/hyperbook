import { PYODIDE_CDN } from "./constants.js";
import { runtimes, turtleModules, interruptBuffers } from "./state.js";
import { createTurtleJsFFI } from "./turtle-ffi.js";
import { createPytamaroJsFFI } from "./pytamaro-ffi.js";

const loadPyodideScript = () => {
  if (window.loadPyodide) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PYODIDE_CDN;
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
  const pyodide = await loadPyodide();
  if (typeof pyodide.registerJsModule === "function") {
    const turtleModule = createTurtleJsFFI(id);
    turtleModule.__setPyodide(pyodide);
    pyodide.registerJsModule("turtle", turtleModule);
    pyodide.registerJsModule("jturtle", turtleModule);
    pyodide.registerJsModule("pytamaro_js_ffi", createPytamaroJsFFI());
    turtleModules.set(id, turtleModule);
  }
  if (
    typeof SharedArrayBuffer !== "undefined" &&
    window.crossOriginIsolated &&
    typeof pyodide.setInterruptBuffer === "function"
  ) {
    const interruptBuffer = new Int32Array(new SharedArrayBuffer(4));
    pyodide.setInterruptBuffer(interruptBuffer);
    interruptBuffers.set(id, interruptBuffer);
  }
  runtimes.set(id, pyodide);
  return pyodide;
};
