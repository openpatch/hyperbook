import { CHEERPJ_LOADER_URL, WORKER_URL } from "./constants.js";

/**
 * One CheerpJ worker per page. The JVM runs on the worker's own thread, so a
 * program that never ends is stopped by terminating the worker; the next run
 * then starts a fresh one (the runtime files are in the browser's HTTP cache
 * by then).
 */
let worker = null;

export const getWorker = () => {
  if (!worker) {
    worker = new Worker(WORKER_URL);
    worker.postMessage({ type: "init", loaderUrl: CHEERPJ_LOADER_URL });
  }
  return worker;
};

export const killWorker = () => {
  worker?.terminate();
  worker = null;
};
