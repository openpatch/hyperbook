import { installedMicropipPackages, turtleModules } from "./state.js";
import { appendOutputLine, appendOutputErrorLine } from "./output.js";
import { getRuntime } from "./pyodide.js";

export const scriptLooksLikeTurtle = (script) => {
  return /\bfrom\s+turtle\s+import\b|\bimport\s+turtle\b/.test(
    String(script || ""),
  );
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

  const prelude = [
    "# --- auto-wrapped by IDE for browser pygame compatibility ---",
    "import asyncio",
    "import pygame",
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
      stdin: () => {
        const promptText =
          lastStdinPrompt || hyperbook.i18n.get("pyide-input-prompt");
        lastStdinPrompt = "";
        const value = window.prompt(promptText);
        if (value === null) {
          return "";
        }
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
    const dict = pyodide.globals.get("dict");
    const globals = dict();
    try {
      for (const [key, value] of Object.entries(globalsContext)) {
        globals.set(key, value);
      }
      const results = await pyodide.runPythonAsync(executableScript, {
        globals,
        locals: globals,
        filename,
      });
      return { results };
    } finally {
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
      message = lines[0] + "\n" + lines.slice(i).join("\n");
    }
    return { error: message };
  }
};
