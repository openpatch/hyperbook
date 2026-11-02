/**
 * @type {Map<string, { running: boolean, stopping: boolean, stopRequested: boolean, type: "run" | "test" | null, runId: string | null, worker: Worker | null, onMessage: ((event: MessageEvent) => void) | null, resolve: ((value: unknown) => void) | null }>}
 */
export const executionStates = new Map();

export const getExecutionState = (id) => {
  if (!executionStates.has(id)) {
    executionStates.set(id, {
      running: false,
      stopping: false,
      stopRequested: false,
      type: null,
      runId: null,
      worker: null,
      onMessage: null,
      resolve: null,
    });
  }
  return executionStates.get(id);
};
