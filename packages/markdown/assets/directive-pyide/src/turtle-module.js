import turtleSource from "./turtle.py";
import { createTurtleCanvas } from "./turtle-canvas.js";

/** Where turtle.py is placed in Pyodide's file system; first on sys.path. */
const MODULE_DIR = "/lib/hyperbook";

/**
 * Make `import turtle` work in a Pyodide runtime: CPython's turtle module
 * (turtle.py) drawing on the canvas of the pyide element `id`.
 * @returns the canvas backend, which the pyide element drives between runs.
 */
export const installTurtle = (pyodide, id) => {
  const canvas = createTurtleCanvas(id);
  pyodide.registerJsModule("_hyperbook_turtle", canvas);
  pyodide.FS.mkdirTree(MODULE_DIR);
  pyodide.FS.writeFile(`${MODULE_DIR}/turtle.py`, turtleSource);
  // Earlier versions also offered the module as jturtle.
  pyodide.FS.writeFile(
    `${MODULE_DIR}/jturtle.py`,
    "import sys, turtle\nsys.modules[__name__] = turtle\n",
  );
  pyodide.runPython(
    `__import__("sys").path.insert(0, ${JSON.stringify(MODULE_DIR)})`,
  );
  return canvas;
};

/**
 * Forget the turtle module, so the next import starts from scratch -- as it
 * would when a program is started anew -- instead of reusing the screen,
 * turtles and settings of the previous run.
 */
export const forgetTurtleModule = (pyodide) =>
  pyodide.runPython(
    ["turtle", "jturtle"]
      .map((name) => `__import__("sys").modules.pop("${name}", None)`)
      .join("\n"),
  );
