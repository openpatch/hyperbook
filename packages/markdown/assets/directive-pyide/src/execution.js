import { installedMicropipPackages, turtleModules } from "./state.js";
import { appendOutputLine, appendOutputErrorLine } from "./output.js";
import { getRuntime } from "./pyodide.js";
import { scriptLooksLikeTurtle } from "./constants.js";
import { askStdinAsync, askStdinSync, hideStdinField } from "./stdin.js";

export { scriptLooksLikeTurtle };

/**
 * Whether this runtime can suspend a synchronous Python call on a JS promise
 * (WebAssembly JSPI, via pyodide.ffi.run_sync). Probed once per runtime, by
 * actually doing it — feature-sniffing WebAssembly.Suspending is not enough,
 * since the runtime also has to have been loaded with stack switching on.
 */
const runSyncSupport = new Map();

const PROBE_RUN_SYNC = `
def _hyperbook_probe():
    try:
        from pyodide.ffi import run_sync
        import js
    except Exception:
        return False
    try:
        run_sync(js.Promise.resolve(True))
        return True
    except Exception:
        return False

_hyperbook_probe()
`;

/**
 * Shadows the builtin input() in the script's own namespace. Writing the
 * prompt through sys.stdout keeps it in the output panel, like a terminal.
 */
const INPUT_SHIM = `
def input(prompt=""):
    import sys
    from pyodide.ffi import run_sync

    text = "" if prompt is None else str(prompt)
    if text:
        sys.stdout.write(text)
        sys.stdout.flush()
    answer = run_sync(__hyperbook_ask_stdin(text))
    answer = "" if answer is None else str(answer)
    # A terminal echoes what was typed and the Enter that ended it; nothing
    # does that here, so the transcript has to include it explicitly.
    sys.stdout.write(answer + "\\n")
    sys.stdout.flush()
    return answer
`;

/**
 * turtle's own dialogs. The JS module can only offer blocking versions, since
 * a JS function cannot await on Python's behalf — so when Python can be
 * suspended we replace them with ones that read from the page instead.
 *
 * Both the functional interface (`from turtle import *`) and the screen object
 * (`Screen().numinput(...)`) have to be covered; they hold separate references
 * to the same underlying functions.
 */
const TURTLE_INPUT_SHIM = `
def _hyperbook_patch_turtle():
    import turtle
    from pyodide.ffi import run_sync

    def _label(title, prompt):
        return " ".join(str(part) for part in (title, prompt) if part).strip()

    def textinput(title="", prompt=""):
        return run_sync(__hyperbook_ask_stdin(_label(title, prompt)))

    def numinput(title="", prompt="", default=None, minval=None, maxval=None):
        hint = ""
        if minval is not None and maxval is not None:
            hint = " [{0}, {1}]".format(minval, maxval)
        elif minval is not None:
            hint = " [>= {0}]".format(minval)
        elif maxval is not None:
            hint = " [<= {0}]".format(maxval)
        while True:
            answer = run_sync(__hyperbook_ask_stdin(_label(title, prompt) + hint))
            # An empty answer stands in for tkinter's Cancel button.
            if answer is None or str(answer).strip() == "":
                return default
            try:
                value = float(str(answer).strip().replace(",", "."))
            except ValueError:
                continue
            if minval is not None and value < minval:
                continue
            if maxval is not None and value > maxval:
                continue
            return value

    # Screen() hands back one shared object, so patching it once is enough.
    try:
        screen = turtle.Screen()
        screen.numinput = numinput
        screen.textinput = textinput
    except Exception:
        pass

    try:
        turtle.numinput = numinput
        turtle.textinput = textinput
    except Exception:
        pass
    if getattr(turtle, "numinput", None) is not numinput:
        # The JS module rejected the assignment; shadow it with a real Python
        # module so \`from turtle import *\` still picks up the patched names.
        import sys
        import types

        wrapper = types.ModuleType("turtle")
        for name in dir(turtle):
            try:
                setattr(wrapper, name, getattr(turtle, name))
            except Exception:
                pass
        wrapper.numinput = numinput
        wrapper.textinput = textinput
        sys.modules["turtle"] = wrapper
        sys.modules["jturtle"] = wrapper

_hyperbook_patch_turtle()
del _hyperbook_patch_turtle
`;

const supportsRunSync = async (id, pyodide) => {
  if (runSyncSupport.has(id)) return runSyncSupport.get(id);
  let supported = false;
  const dict = pyodide.globals.get("dict");
  const probeGlobals = dict();
  try {
    supported = !!(await pyodide.runPythonAsync(PROBE_RUN_SYNC, {
      globals: probeGlobals,
      locals: probeGlobals,
      filename: "<hyperbook-probe>",
    }));
  } catch {
    supported = false;
  } finally {
    probeGlobals.destroy();
    dict.destroy();
  }
  runSyncSupport.set(id, supported);
  return supported;
};

export const resetCanvas = (canvas) => {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  context?.clearRect(0, 0, canvas.width, canvas.height);
};

// Browser/Pyodide needs periodic yielding for top-level pygame loops.
const hasExplicitMain = (code) => {
  const text = String(code || "");
  return (
    /^(\s*)(?:async\s+def|def)\s+main\s*\(/m.test(text) ||
    /__name__\s*==\s*["']__main__["']/.test(text)
  );
};

const looksLikeTopLevelGameLoop = (code) => {
  const text = String(code || "");
  const hasPygame =
    /(?:^|\W)(?:import\s+pygame\b|from\s+pygame\b\s+import\b)/m.test(text);
  const hasSasPygame =
    /(?:^|\W)(?:import\s+sas_pygame\b|from\s+sas_pygame\b\s+import\b)/m.test(
      text,
    );
  const hasAnyWhile = /^\s*while\s+.+:\s*$/m.test(text);
  if (!hasAnyWhile) return false;
  return (hasPygame || hasSasPygame) && hasAnyWhile;
};

const indentBlock = (source, spaces) => {
  const pad = " ".repeat(spaces);
  return String(source || "")
    .split(/\r\n|\r|\n/)
    .map((line) => (line.length ? pad + line : line))
    .join("\n");
};

const wrapTopLevelIntoAsyncMain = (userCode) => {
  const code = String(userCode || "").replace(/\r\n/g, "\n");

  if (hasExplicitMain(code)) return code;

  const lines = code.split("\n");
  const keep = [];
  const body = [];

  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (/^\s*$/.test(line)) {
      keep.push(line);
      index += 1;
      continue;
    }
    if (/^\s*#/.test(line)) {
      keep.push(line);
      index += 1;
      continue;
    }
    if (/^\s*(?:from\s+\S+\s+import\b|import\s+\S+)/.test(line)) {
      keep.push(line);
      index += 1;
      continue;
    }

    if (/^\s*(?:def|async\s+def|class)\s+/.test(line)) {
      keep.push(line);
      index += 1;
      while (index < lines.length) {
        const nextLine = lines[index];
        if (/^\s*$/.test(nextLine)) {
          keep.push(nextLine);
          index += 1;
          continue;
        }
        if (
          /^\S/.test(nextLine) &&
          !/^\s*#/.test(nextLine) &&
          !/^\s*(?:from\s+\S+\s+import\b|import\s+\S+)/.test(nextLine) &&
          !/^\s*(?:def|async\s+def|class)\s+/.test(nextLine)
        ) {
          break;
        }
        keep.push(nextLine);
        index += 1;
      }
      continue;
    }
    break;
  }

  for (; index < lines.length; index += 1) {
    body.push(lines[index]);
  }

  let bodyText = body.join("\n");
  bodyText = bodyText.replace(/^([ \t]*\n)+/, "");
  bodyText = bodyText.replace(/(\n[ \t]*)+$/, "");
  bodyText = bodyText.replace(/\t/g, "    ");
  if (!bodyText.replace(/[\s\n]+/g, "").length) return code;

  const injected = bodyText
    .replace(
      /^(\s*)(\w+\s*\.\s*tick\s*\([^\)]*\)\s*)$/gm,
      "$1$2\n$1await asyncio.sleep(0)",
    )
    .replace(
      /^(\s*)(pygame\s*\.\s*display\s*\.\s*flip\s*\(\s*\)\s*)$/gm,
      "$1$2\n$1await asyncio.sleep(0)",
    )
    .replace(
      /^([\t ]*)([A-Za-z_][\w]*(?:\s*\.\s*[A-Za-z_][\w]*)*\s*\.\s*step\s*\([^\)]*\)\s*)(#.*)?$/gm,
      "$1$2$3\n$1await asyncio.sleep(0)",
    );

  const hasAsyncio = /(?:^|\W)import\s+asyncio\b/m.test(code);
  const hasPygameImport =
    /(?:^|\W)(?:import\s+pygame\b|from\s+pygame\b\s+import\b)/m.test(code);
  const prelude = [
    "# --- auto-wrapped by IDE for browser pygame compatibility ---",
    ...(hasAsyncio ? [] : ["import asyncio"]),
    ...(hasPygameImport ? [] : ["import pygame"]),
    "",
    "async def main():",
    indentBlock(injected, 4),
    "",
    "await main()",
    "# --- end auto-wrapped ---",
    "",
  ].join("\n");

  let keepText = keep.join("\n");
  if (keepText && !keepText.endsWith("\n")) keepText += "\n";
  if (keepText && !/\n\s*\n$/.test(keepText)) keepText += "\n";

  return keepText + prelude;
};

export const maybeAutoWrapPygame = (code) => {
  try {
    const text = String(code || "");
    if (!looksLikeTopLevelGameLoop(text)) return text;
    return wrapTopLevelIntoAsyncMain(text);
  } catch {
    return String(code || "");
  }
};

export const ensureMicropipPackages = async (id, pyodide, packages = []) => {
  if (packages.length === 0) return;
  if (!installedMicropipPackages.has(id)) {
    installedMicropipPackages.set(id, new Set());
  }
  const installed = installedMicropipPackages.get(id);
  const toInstall = packages.filter((pkg) => !installed.has(pkg));
  if (toInstall.length === 0) return;

  await pyodide.loadPackage("micropip");
  const micropip = pyodide.pyimport("micropip");
  try {
    for (const pkg of toInstall) {
      await micropip.install(pkg);
      installed.add(pkg);
    }
  } finally {
    micropip?.destroy?.();
  }
};

export const executeScript = async (
  id,
  script,
  context = {},
  packages = [],
) => {
  const filename = "<exec>";
  try {
    const pyodide = await getRuntime(id);
    const { canvas, ...globalsContext } = context;
    const decoder = new TextDecoder("utf-8");
    const executableScript = maybeAutoWrapPygame(script);

    if (canvas) {
      try {
        resetCanvas(canvas);
        const usesTurtle = scriptLooksLikeTurtle(executableScript);
        if (usesTurtle) {
          turtleModules.get(id)?.__bindCanvas(canvas);
          turtleModules.get(id)?.__resetState();
        } else {
          turtleModules.get(id)?.__deactivate?.();
          canvas.style.width = "";
          canvas.style.height = "";
        }
        pyodide.canvas.setCanvas2D(canvas);
      } catch (error) {
        appendOutputErrorLine(id, `Canvas setup failed: ${error.message}`);
      }
    }

    let lastStdinPrompt = "";
    pyodide.setStdout({
      write: (msg) => {
        const text = typeof msg === "string" ? msg : decoder.decode(msg);
        if (text.endsWith("\n")) {
          lastStdinPrompt = "";
        } else {
          lastStdinPrompt += text;
        }
        appendOutputLine(id, text);
        return msg?.length ?? text.length;
      },
    });
    pyodide.setStdin({
      // Reached by sys.stdin reads, and by input() when Python cannot be
      // suspended. Both block the main thread; there is no way around that
      // without stack switching.
      stdin: () => {
        const promptText = lastStdinPrompt;
        lastStdinPrompt = "";
        const value = askStdinSync(id, promptText);
        // Echo the answer, as a terminal would — see INPUT_SHIM.
        appendOutputLine(id, `${value}\n`);
        return value;
      },
    });
    pyodide.setStderr({
      write: (msg) => {
        const text = typeof msg === "string" ? msg : decoder.decode(msg);
        appendOutputErrorLine(id, text);
        return msg?.length ?? text.length;
      },
    });

    await ensureMicropipPackages(id, pyodide, packages);
    await pyodide.loadPackagesFromImports(executableScript);
    const canSuspend = await supportsRunSync(id, pyodide);
    const dict = pyodide.globals.get("dict");
    const globals = dict();
    try {
      for (const [key, value] of Object.entries(globalsContext)) {
        globals.set(key, value);
      }
      if (canSuspend) {
        // Shadow input() in the script's namespace so it reads from the page
        // instead of blocking the main thread in window.prompt().
        globals.set("__hyperbook_ask_stdin", (promptText) =>
          askStdinAsync(id, promptText),
        );
        await pyodide.runPythonAsync(INPUT_SHIM, {
          globals,
          locals: globals,
          filename: "<hyperbook-stdin>",
        });
        if (scriptLooksLikeTurtle(executableScript)) {
          await pyodide.runPythonAsync(TURTLE_INPUT_SHIM, {
            globals,
            locals: globals,
            filename: "<hyperbook-stdin>",
          });
        }
      }
      const results = await pyodide.runPythonAsync(executableScript, {
        globals,
        locals: globals,
        filename,
      });
      return { results };
    } finally {
      hideStdinField(id);
      globals.destroy();
      dict.destroy();
      if (canvas) {
        try {
          await pyodide.runPythonAsync(
            `import sys as _sys
_pg = _sys.modules.get('pygame')
if _pg:
    try:
        _pg.quit()
    except Exception:
        pass`,
            { filename: "<cleanup>" },
          );
        } catch (e) {
          console.warn("pygame cleanup failed:", e);
        }
      }
    }
  } catch (error) {
    let message = error.message;
    if (message.startsWith("Traceback")) {
      const lines = message?.split("\n") || [];
      const i = lines.findIndex((line) => line.includes(filename));
      message = i >= 0 ? lines[0] + "\n" + lines.slice(i).join("\n") : message;
    }
    return { error: message };
  }
};
