/**
 * @type {Map<string, any>}
 */
export const runtimes = new Map();
/**
 * @type {Map<string, Set<string>>}
 */
export const installedMicropipPackages = new Map();
/**
 * @type {Map<string, any>}
 */
export const turtleModules = new Map();

/**
 * `executing`: the script itself (not the setup around it) is running.
 * `finishing`: the script has returned, but the turtle is still drawing.
 * @type {Map<string, { running: boolean, stopping: boolean, stopRequested: boolean, executing: boolean, finishing: boolean, type: "run" | "test" | null }>}
 */
export const executionStates = new Map();
/**
 * @type {Map<string, Int32Array>}
 */
export const interruptBuffers = new Map();

/**
 * @type {Map<string, string>}
 */
export const pytamaroStdoutCarry = new Map();

export const getExecutionState = (id) => {
  if (!executionStates.has(id)) {
    executionStates.set(id, {
      running: false,
      stopping: false,
      stopRequested: false,
      executing: false,
      finishing: false,
      type: null,
    });
  }
  return executionStates.get(id);
};
