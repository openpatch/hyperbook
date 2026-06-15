import { i18nGet } from "./utils.js";

let workerRequestId = 0;

// Two separate worker instances: one for rendering, one for parameter extraction.
// This allows both to run concurrently in truly separate threads.
export const workerSlots = {
  render: { promise: null, pending: new Map() },
  param: { promise: null, pending: new Map() },
};

export const getWorker = async (slot, scriptBase) => {
  if (!window.Worker) {
    throw new Error(
      i18nGet("openscad-render-failed", "OpenSCAD render failed"),
    );
  }
  const s = workerSlots[slot];
  if (!s.promise) {
    s.promise = new Promise((resolve, reject) => {
      try {
        const worker = new Worker(
          new URL(scriptBase + "worker.js", window.location.href),
          {
            type: "module",
          },
        );

        worker.addEventListener("message", (event) => {
          const { requestId, ok, result, error } = event.data || {};
          if (!requestId || !s.pending.has(requestId)) return;
          const pending = s.pending.get(requestId);
          s.pending.delete(requestId);
          if (ok) {
            pending.resolve(result);
            return;
          }
          const workerError = new Error(
            error?.message || "OpenSCAD worker request failed",
          );
          if (Array.isArray(error?.stderr)) {
            workerError.stderr = error.stderr;
          }
          pending.reject(workerError);
        });

        worker.addEventListener("error", (event) => {
          const workerError = new Error(
            event?.message || "OpenSCAD worker crashed",
          );
          for (const { reject } of s.pending.values()) reject(workerError);
          s.pending.clear();
          s.promise = null;
        });

        worker.addEventListener("messageerror", () => {
          const workerError = new Error("OpenSCAD worker message error");
          for (const { reject } of s.pending.values()) reject(workerError);
          s.pending.clear();
          s.promise = null;
        });

        resolve(worker);
      } catch (error) {
        s.promise = null;
        reject(error);
      }
    });
  }
  return s.promise;
};

export const callWorker = async (slot, type, payload, scriptBase, transfer = []) => {
  const worker = await getWorker(slot, scriptBase);
  const s = workerSlots[slot];
  const requestId = ++workerRequestId;
  return new Promise((resolve, reject) => {
    s.pending.set(requestId, { resolve, reject });
    try {
      worker.postMessage({ requestId, type, payload }, transfer);
    } catch (error) {
      s.pending.delete(requestId);
      reject(error);
    }
  });
};

export const getInvocationStderr = (invocationResult) =>
  (invocationResult?.mergedOutputs || [])
    .filter((entry) => typeof entry?.stderr === "string")
    .map((entry) => entry.stderr);

export const buildParamUiInWorker = async (
  code,
  libraryNames = [],
  binaryFiles = [],
  currentOverrides = {},
  id = "",
  scriptBase,
) => {
  try {
    const result = await callWorker("param", "buildParamForm", {
      code,
      libraryNames,
      binaryFiles,
      currentOverrides,
      id,
    }, scriptBase);
    return {
      hasParams: Boolean(result?.hasParams),
      html: typeof result?.html === "string" ? result.html : "",
      values:
        result?.values && typeof result.values === "object"
          ? result.values
          : {},
    };
  } catch (e) {
    console.warn("[openscad] Worker param UI build failed:", e);
    return {
      hasParams: false,
      html: "",
      values: {},
    };
  }
};
