/// <reference path="../hyperbook.types.js" />

/**
 * Python IDE with code execution.
 * @type {HyperbookPython}
 * @memberof hyperbook
 * @see hyperbook.store
 * @see hyperbook.i18n
 */
hyperbook.python = (function () {
  const PYODIDE_CDN = "https://cdn.jsdelivr.net/pyodide/v0.29.4/full/pyodide.js";

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

  /**
   * @type {Map<string, any>}
   */
  const runtimes = new Map();
  /**
   * @type {Map<string, Set<string>>}
   */
  const installedMicropipPackages = new Map();
  /**
   * @type {Map<string, any>}
   */
  const turtleModules = new Map();

  /**
   * @type {Map<string, { running: boolean, stopping: boolean, stopRequested: boolean, type: "run" | "test" | null }>}
   */
  const executionStates = new Map();
  /**
   * @type {Map<string, Int32Array>}
   */
  const interruptBuffers = new Map();

  const getExecutionState = (id) => {
    if (!executionStates.has(id)) {
      executionStates.set(id, {
        running: false,
        stopping: false,
        stopRequested: false,
        type: null,
      });
    }
    return executionStates.get(id);
  };

  const getRuntime = async (id) => {
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

  const PYTAMARO_URI_BEGIN = "@@@PYTAMARO_DATA_URI_BEGIN@@@";
  const PYTAMARO_URI_END = "@@@PYTAMARO_DATA_URI_END@@@";
  /**
   * @type {Map<string, string>}
   */
  const pytamaroStdoutCarry = new Map();
  const pytamaroCanvasTargets = new Set();

  const getOutput = (id) => {
    return document.getElementById(id)?.getElementsByClassName("output")[0];
  };

  const getCanvas = (id) => {
    return document.getElementById(id)?.getElementsByClassName("canvas")[0];
  };

  const setPytamaroCanvasTarget = (id, enabled) => {
    if (enabled) {
      pytamaroCanvasTargets.add(id);
    } else {
      pytamaroCanvasTargets.delete(id);
    }
  };

  const renderPytamaroDataUri = (id, container, dataUri) => {
    if (id && pytamaroCanvasTargets.has(id)) {
      const canvas = getCanvas(id);
      const context = canvas?.getContext?.("2d");
      if (canvas && context) {
        const img = new Image();
        img.onload = () => {
          const width = Math.max(1, img.naturalWidth || img.width);
          const height = Math.max(1, img.naturalHeight || img.height);
          canvas.width = width;
          canvas.height = height;
          context.clearRect(0, 0, width, height);
          context.drawImage(img, 0, 0, width, height);
        };
        img.onerror = () => {
          appendOutputErrorLine(id, "Failed to render pytamaro graphic.");
        };
        img.src = dataUri;
        return;
      }
    }

    const img = document.createElement("img");
    img.src = dataUri;
    img.style.maxWidth = "100%";
    img.style.display = "block";
    container.appendChild(img);
  };

  /**
   * Renders a message that may contain pytamaro data URI image markers into
   * the given container, creating <img> elements for each embedded image.
   */
  const renderOutputSegments = (container, message, id = null) => {
    let remaining = String(message);
    while (remaining.length > 0) {
      const beginIdx = remaining.indexOf(PYTAMARO_URI_BEGIN);
      if (beginIdx === -1) {
        container.appendChild(document.createTextNode(remaining));
        break;
      }
      if (beginIdx > 0) {
        container.appendChild(document.createTextNode(remaining.slice(0, beginIdx)));
      }
      const afterBegin = remaining.slice(beginIdx + PYTAMARO_URI_BEGIN.length);
      const endIdx = afterBegin.indexOf(PYTAMARO_URI_END);
      if (endIdx === -1) {
        container.appendChild(document.createTextNode(remaining.slice(beginIdx)));
        break;
      }
      const dataUri = afterBegin.slice(0, endIdx);
      renderPytamaroDataUri(id, container, dataUri);
      remaining = afterBegin.slice(endIdx + PYTAMARO_URI_END.length);
    }
  };

  const scriptLooksLikeTurtle = (script) => {
    return /\bfrom\s+turtle\s+import\b|\bimport\s+turtle\b/.test(String(script || ""));
  };

  const getTrailingPrefixLength = (text, marker) => {
    const max = Math.min(text.length, marker.length - 1);
    for (let len = max; len > 0; len -= 1) {
      if (text.endsWith(marker.slice(0, len))) {
        return len;
      }
    }
    return 0;
  };

  const appendText = (output, text) => {
    if (!text) return;
    output.appendChild(document.createTextNode(text));
  };

  const appendOutputLine = (id, message) => {
    const output = getOutput(id);
    if (!output) return;
    const msg = String(message ?? "");
    const carry = pytamaroStdoutCarry.get(id) || "";
    let combined = carry + msg;
    pytamaroStdoutCarry.delete(id);

    // Fast path for regular stdout chunks.
    if (!combined.includes(PYTAMARO_URI_BEGIN) && carry.length === 0) {
      const partialBeginLength = getTrailingPrefixLength(combined, PYTAMARO_URI_BEGIN);
      if (partialBeginLength > 0) {
        const visible = combined.slice(0, combined.length - partialBeginLength);
        appendText(output, visible);
        pytamaroStdoutCarry.set(id, combined.slice(combined.length - partialBeginLength));
      } else {
        appendText(output, combined);
      }
      return;
    }

    while (combined.length > 0) {
      const beginIdx = combined.indexOf(PYTAMARO_URI_BEGIN);
      if (beginIdx === -1) {
        const partialBeginLength = getTrailingPrefixLength(combined, PYTAMARO_URI_BEGIN);
        const visible = combined.slice(0, combined.length - partialBeginLength);
        appendText(output, visible);
        if (partialBeginLength > 0) {
          pytamaroStdoutCarry.set(id, combined.slice(combined.length - partialBeginLength));
        }
        break;
      }

      appendText(output, combined.slice(0, beginIdx));
      const afterBegin = combined.slice(beginIdx + PYTAMARO_URI_BEGIN.length);
      const endIdx = afterBegin.indexOf(PYTAMARO_URI_END);
      if (endIdx === -1) {
        // Keep incomplete marker and continue when the next stdout chunk arrives.
        pytamaroStdoutCarry.set(id, combined.slice(beginIdx));
        break;
      }

      const dataUri = afterBegin.slice(0, endIdx);
      renderPytamaroDataUri(id, output, dataUri);
      combined = afterBegin.slice(endIdx + PYTAMARO_URI_END.length);
    }
  };

  const appendOutputErrorLine = (id, message) => {
    const output = getOutput(id);
    if (!output) return;
    const line = document.createElement("span");
    line.classList.add("error-line");
    line.textContent = String(message);
    output.appendChild(line);
  };

  const appendOutput = (output, message, isError = false, id = null) => {
    if (!output || message === undefined || message === null) return;
    if (isError) {
      const line = document.createElement("span");
      line.classList.add("error-line");
      line.textContent = String(message);
      output.appendChild(line);
      return;
    }
    const msg = String(message);
    if (msg.includes(PYTAMARO_URI_BEGIN)) {
      renderOutputSegments(output, msg, id);
      return;
    }
    output.appendChild(document.createTextNode(msg));
  };

  const clearPytamaroStdoutCarry = (id) => {
    pytamaroStdoutCarry.delete(id);
    pytamaroCanvasTargets.delete(id);
  };

  const updateFullscreenButtonState = (elem, button) => {
    if (!elem || !button) return;
    const isFullscreen = document.fullscreenElement === elem;
    const label = hyperbook.i18n.get("ide-fullscreen-enter");
    button.textContent = "⛶";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.classList.toggle("active", isFullscreen);
  };

  const toggleFullscreen = async (elem) => {
    if (!elem) return;
    if (document.fullscreenElement === elem) {
      await document.exitFullscreen();
      return;
    }
    await elem.requestFullscreen();
  };

  const syncFullscreenButtons = () => {
    const elems = document.getElementsByClassName("directive-pyide");
    for (const elem of elems) {
      const fullscreen = elem.getElementsByClassName("fullscreen")[0];
      updateFullscreenButtonState(elem, fullscreen);
    }
  };

  const releaseKeyboardCapture = (id) => {
    const elem = document.getElementById(id);
    if (!elem) return;
    const canvas = elem.getElementsByClassName("canvas")[0];
    canvas?.blur?.();
  };

  const resetCanvas = (canvas) => {
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const createTurtleJsFFI = (id) => {
    const DEFAULT_LINE_WIDTH = 1;
    const DEFAULT_FONT_SIZE = 8;
    const TK_TEXT_X_OFFSET = -1;
    const DEFAULT_TURTLE_SCREEN_WIDTH = 400;
    const TURTLE_SIZE = 20;

    let pyodide = null;
    let canvas = null;
    let context = null;
    let cssWidth = 0;
    let cssHeight = 0;
    let dpr = 1;
    let active = false;

    let x = 0;
    let y = 0;
    let heading = 0;
    let renderedX = 0;
    let renderedY = 0;
    let renderedHeading = 0;
    let penDown = true;
    let turtleVisible = true;
    let renderedTurtleVisible = true;
    let strokeColor = "#000000";
    let fillColor = "#000000";
    let backgroundColor = "#ffffff";
    let backgroundImage = null;
    let fontSize = DEFAULT_FONT_SIZE;
    let currentFontFamily = "Arial";
    let currentFontStyle = "normal";
    let colorMode = 1.0;
    let delayMs = 80;
    let turtleSpeed = 3;
    let screenWidth = null;
    let screenHeight = null;
    let filling = false;
    let fillPath = null;
    let currentPath = null;
    /** @type {Array<any>} */
    let paths = [];
    let operationQueue = [];
    let queueGeneration = 0;
    let queueRunning = false;
    const textMeasureCanvas = document.createElement("canvas");
    const textMeasureContext = textMeasureCanvas.getContext("2d");

    const normalizeAngle = (angle) => {
      const value = Number(angle) || 0;
      return ((value % 360) + 360) % 360;
    };

    const toRadians = (angle) => (Number(angle) * Math.PI) / 180;
    const toCanvasX = (value) => cssWidth / 2 + value;
    const toCanvasY = (value) => cssHeight / 2 - value;
    const toPlainNumber = (value, fallback = Number.NaN) => {
      if (value === null || value === undefined) return fallback;
      if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
      if (typeof value === "bigint") return Number(value);
      if (typeof value.toJs === "function") {
        return toPlainNumber(value.toJs({ pyproxies: [] }), fallback);
      }
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : fallback;
    };
    const toPlainBoolean = (value, fallback = false) => {
      if (value === null || value === undefined) return fallback;
      if (typeof value === "boolean") return value;
      if (typeof value === "number") return value !== 0;
      if (typeof value === "bigint") return value !== 0n;
      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (!normalized) return fallback;
        if (["false", "0", "no", "off"].includes(normalized)) return false;
        if (["true", "1", "yes", "on"].includes(normalized)) return true;
      }
      if (typeof value.toJs === "function") {
        return toPlainBoolean(value.toJs({ pyproxies: [] }), fallback);
      }
      return Boolean(value);
    };
    const fontSizeToCanvasUnits = (value) => {
      const numeric = toPlainNumber(value, Number.NaN);
      if (!Number.isFinite(numeric) || numeric === 0) {
        const fallback = DEFAULT_FONT_SIZE;
        return { size: `${fallback}pt`, pxApprox: (fallback * 96) / 72 };
      }
      if (numeric < 0) {
        return { size: `${Math.abs(numeric)}px`, pxApprox: Math.abs(numeric) };
      }
      return { size: `${numeric}pt`, pxApprox: (numeric * 96) / 72 };
    };
    const toPlainString = (value, fallback = "") => {
      if (value === null || value === undefined) return fallback;
      if (typeof value === "string") return value;
      if (typeof value.toJs === "function") {
        return toPlainString(value.toJs({ pyproxies: [] }), fallback);
      }
      return String(value);
    };
    const toSequence = (value) => {
      if (value === null || value === undefined) return null;
      if (Array.isArray(value)) return value;
      if (typeof value === "string") return [value];
      if (typeof value.toJs === "function") {
        return toSequence(value.toJs({ pyproxies: [] }));
      }
      if (typeof value[Symbol.iterator] === "function") {
        try {
          return Array.from(value);
        } catch {}
      }
      if (typeof value === "object" && "length" in value) {
        try {
          return Array.from(value);
        } catch {}
      }
      return null;
    };
    const toPlainObject = (value) => {
      if (value === null || value === undefined) return null;
      if (typeof value.toJs === "function") {
        try {
          return toPlainObject(value.toJs({ pyproxies: [], dict_converter: Object.fromEntries }));
        } catch {
          return toPlainObject(value.toJs({ pyproxies: [] }));
        }
      }
      if (typeof value !== "object" || Array.isArray(value)) return null;
      return value;
    };
    const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
    const isWriteKwargsObject = (value) => {
      const obj = toPlainObject(value);
      if (!obj) return false;
      return (
        hasOwn(obj, "arg") ||
        hasOwn(obj, "text") ||
        hasOwn(obj, "move") ||
        hasOwn(obj, "align") ||
        hasOwn(obj, "font")
      );
    };
    const normalizeFontStyle = (value) => {
      const style = toPlainString(value, "normal").trim().toLowerCase();
      if (!style || style === "normal") return "";
      const parts = style.split(/\s+/).filter(Boolean);
      const hasItalic = parts.includes("italic");
      const hasBold = parts.includes("bold");
      if (hasItalic && hasBold) return "italic bold";
      if (hasBold) return "bold";
      if (hasItalic) return "italic";
      return style;
    };
    const normalizeTextAlign = (value) => {
      const align = toPlainString(value, "left").trim().toLowerCase();
      if (align === "center" || align === "right") return align;
      return "left";
    };
    const buildCanvasFont = (family, size, style) => {
      const { size: canvasSize } = fontSizeToCanvasUnits(size);
      const stylePart = normalizeFontStyle(style);
      return `${stylePart ? `${stylePart} ` : ""}${canvasSize} ${toPlainString(family, "Arial")}`;
    };
    const measureTurtleText = (text, family, size, style) => {
      const font = buildCanvasFont(family, size, style);
      const { pxApprox } = fontSizeToCanvasUnits(size);
      const ctx = textMeasureContext || context;
      if (!ctx) {
        return {
          font,
          width: String(text || "").length * pxApprox * 0.6,
          descent: pxApprox * 0.2,
        };
      }
      ctx.font = font;
      ctx.textAlign = "left";
      const metrics = ctx.measureText(String(text || ""));
      return {
        font,
        width: metrics.width,
        left: metrics.actualBoundingBoxLeft || 0,
        right: metrics.actualBoundingBoxRight || metrics.width,
        ascent:
          metrics.fontBoundingBoxAscent ||
          metrics.actualBoundingBoxAscent ||
          pxApprox * 0.8,
        descent:
          metrics.fontBoundingBoxDescent ||
          metrics.actualBoundingBoxDescent ||
          pxApprox * 0.2,
      };
    };
    const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
    const clearQueue = () => {
      queueGeneration += 1;
      operationQueue = [];
      queueRunning = false;
    };
    const enqueueOperation = (fn) => {
      if (delayMs <= 0) {
        fn();
        return;
      }
      const generation = queueGeneration;
      operationQueue.push({ fn, generation });
      if (queueRunning) return;
      queueRunning = true;
      void (async () => {
        try {
          while (operationQueue.length > 0) {
            const operation = operationQueue.shift();
            if (!operation || operation.generation !== queueGeneration) {
              continue;
            }
            operation.fn();
            if (delayMs > 0) {
              await sleep(delayMs);
            }
          }
        } finally {
          queueRunning = false;
        }
      })();
    };

    const ensureContext = () => {
      if (!canvas) {
        canvas = getCanvas(id);
      }
      if (!canvas) return false;
      if (!context) {
        context = canvas.getContext("2d");
      }
      return !!context;
    };

    const setupCanvasResolution = () => {
      if (!ensureContext()) return false;
      dpr = window.devicePixelRatio || 1;
      const wrapperRect = canvas.parentElement?.getBoundingClientRect?.();
      const panelWidth =
        wrapperRect?.width || canvas.parentElement?.clientWidth || canvas.clientWidth || canvas.width || 800;
      const panelHeight =
        wrapperRect?.height || canvas.parentElement?.clientHeight || canvas.clientHeight || canvas.height || 400;
      const width = Math.max(
        1,
        Math.floor(screenWidth !== null ? screenWidth : panelWidth),
      );
      const height = Math.max(
        1,
        Math.floor(screenHeight !== null ? screenHeight : panelHeight),
      );
      cssWidth = width;
      cssHeight = height;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.width = Math.max(1, Math.floor(cssWidth * dpr));
      canvas.height = Math.max(1, Math.floor(cssHeight * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    };

    const makePath = (overrides = {}) => ({
      down: penDown,
      stroke: strokeColor,
      lineWidth: DEFAULT_LINE_WIDTH,
      fontsize: fontSize,
      fontfamily: currentFontFamily,
      fontstyle: currentFontStyle,
      fill: false,
      fillstyle: fillColor,
      points: [{ x, y }],
      ...overrides,
    });

    const beginCurrentPath = () => {
      currentPath = makePath();
      paths.push(currentPath);
      return currentPath;
    };

    const commitStyleToNewPath = () => {
      currentPath = makePath({
        down: penDown,
        lineWidth: currentPath?.lineWidth ?? DEFAULT_LINE_WIDTH,
      });
      paths.push(currentPath);
      return currentPath;
    };

    const ensurePath = () => {
      if (!currentPath) {
        beginCurrentPath();
      }
      return currentPath;
    };

    const drawBackground = () => {
      context.save();
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.fillStyle = backgroundColor;
      context.fillRect(0, 0, cssWidth, cssHeight);
      if (backgroundImage?.complete && backgroundImage.naturalWidth > 0) {
        context.drawImage(backgroundImage, 0, 0, cssWidth, cssHeight);
      }
      context.restore();
    };

    const drawPathSegment = (path) => {
      if (!path?.points?.length) return;

      if (path.fill) {
        context.beginPath();
        path.points.forEach((point, index) => {
          const px = toCanvasX(point.x);
          const py = toCanvasY(point.y);
          if (index === 0) {
            context.moveTo(px, py);
          } else {
            context.lineTo(px, py);
          }
        });
        context.closePath();
        context.fillStyle = path.fillstyle;
        context.fill();
        return;
      }

      let startedLine = false;
      context.beginPath();
      for (const point of path.points) {
        const px = toCanvasX(point.x);
        const py = toCanvasY(point.y);
        if (point.text !== undefined) {
          const family = point.fontfamily || path.fontfamily || "Arial";
          const style = point.fontstyle || path.fontstyle || "normal";
          const size = point.fontsize ?? path.fontsize ?? DEFAULT_FONT_SIZE;
          const text = String(point.text);
          const metrics = measureTurtleText(text, family, size, style);
          const align = normalizeTextAlign(point.align);
          const left = metrics.left || 0;
          const right = metrics.right || metrics.width || 0;
          const descent = metrics.descent || 0;
          const anchorX = px + TK_TEXT_X_OFFSET;
          let drawX = anchorX + left;
          if (align === "center") {
            drawX = anchorX + (left - right) / 2;
          } else if (align === "right") {
            drawX = anchorX - right;
          }
          const drawY = py - descent;
          context.font = metrics.font;
          context.fillStyle = point.color || path.stroke;
          context.textAlign = "left";
          context.textBaseline = "alphabetic";
          context.fillText(text, drawX, drawY);
          continue;
        }
        if (point.dotRadius) {
          context.beginPath();
          context.arc(px, py, point.dotRadius, 0, 2 * Math.PI);
          context.fillStyle = point.color || path.fillstyle || path.stroke;
          context.fill();
          context.beginPath();
          startedLine = false;
          continue;
        }
        if (!startedLine || point.move || !path.down) {
          context.moveTo(px, py);
          startedLine = true;
          continue;
        }
        context.lineTo(px, py);
      }

      if (path.down) {
        context.strokeStyle = path.stroke;
        context.lineWidth = path.lineWidth || DEFAULT_LINE_WIDTH;
        context.stroke();
      }
    };

    const drawTurtle = () => {
      if (!renderedTurtleVisible) return;
      context.save();
      context.translate(toCanvasX(renderedX), toCanvasY(renderedY));
      context.rotate(-toRadians(renderedHeading));
      context.beginPath();
      context.moveTo(TURTLE_SIZE / 2, 0);
      context.lineTo(-TURTLE_SIZE / 2, TURTLE_SIZE / 3);
      context.lineTo(-TURTLE_SIZE / 4, 0);
      context.lineTo(-TURTLE_SIZE / 2, -TURTLE_SIZE / 3);
      context.closePath();
      context.fillStyle = "#2f9e44";
      context.strokeStyle = "#1b5e20";
      context.lineWidth = 1;
      context.fill();
      context.stroke();
      context.restore();
    };

    const draw = () => {
      if (!active) return;
      if (!setupCanvasResolution()) return;
      drawBackground();
      paths.forEach(drawPathSegment);
      drawTurtle();
    };

    const resetState = () => {
      paths = [];
      currentPath = null;
      fillPath = null;
      x = 0;
      y = 0;
      heading = 0;
      renderedX = 0;
      renderedY = 0;
      renderedHeading = 0;
      penDown = true;
      turtleVisible = true;
      renderedTurtleVisible = true;
      strokeColor = "#000000";
      fillColor = "#000000";
      backgroundColor = "#ffffff";
      backgroundImage = null;
      fontSize = DEFAULT_FONT_SIZE;
      currentFontFamily = "Arial";
      currentFontStyle = "normal";
      colorMode = 1.0;
      screenWidth = null;
      screenHeight = null;
      filling = false;
      active = true;
      clearQueue();
      beginCurrentPath();
      draw();
    };

    const deactivate = () => {
      active = false;
      clearQueue();
      paths = [];
      currentPath = null;
      fillPath = null;
      turtleVisible = false;
      renderedTurtleVisible = false;
    };

    const bindCanvas = (nextCanvas) => {
      canvas = nextCanvas || getCanvas(id);
      context = canvas?.getContext?.("2d") || null;
      if (canvas) {
        canvas.tabIndex = 0;
      }
      if (!currentPath) {
        beginCurrentPath();
      }
      draw();
    };

    const toColorString = (value) => {
      if (typeof value === "string") {
        return value;
      }
      if (value && typeof value.toJs === "function") {
        return toColorString(value.toJs({ pyproxies: [] }));
      }
      if (Array.isArray(value) || (value && typeof value === "object" && "length" in value)) {
        const parts = Array.from(value).slice(0, 3).map((part) => Number(part));
        if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
          throw new Error(`bad color sequence: ${String(value)}`);
        }
        if (colorMode === 1.0) {
          if (parts.some((part) => part < 0 || part > 1)) {
            throw new Error(`bad color sequence: ${String(value)}`);
          }
          const [r, g, b] = parts.map((part) => Math.round(part * 255));
          return `rgb(${r}, ${g}, ${b})`;
        }
        if (colorMode === 255) {
          if (parts.some((part) => part < 0 || part > 255)) {
            throw new Error(`bad color sequence: ${String(value)}`);
          }
          const [r, g, b] = parts.map((part) => Math.round(part));
          return `rgb(${r}, ${g}, ${b})`;
        }
        throw new Error(`bad color sequence: ${String(value)}`);
      }
      return "#000000";
    };

    const getPenState = () => ({
      pendown: penDown,
      pencolor: strokeColor,
      fillcolor: fillColor,
      pensize: currentPath?.lineWidth ?? DEFAULT_LINE_WIDTH,
      speed: turtleSpeed,
      shown: turtleVisible,
    });

    const forward = (distance) => {
      if (!ensureContext()) return;
      const path = ensurePath();
      const fill = filling ? fillPath : null;
      const length = Number(distance) || 0;
      const nextX = x + length * Math.cos(toRadians(heading));
      const nextY = y + length * Math.sin(toRadians(heading));
      x = nextX;
      y = nextY;
      const point = { x, y, move: !penDown };
      enqueueOperation(() => {
        renderedX = point.x;
        renderedY = point.y;
        path.points.push(point);
        if (fill) {
          fill.points.push({ x, y });
        }
        draw();
      });
    };

    const backward = (distance) => forward(-Number(distance || 0));
    const right = (angle) => {
      heading = normalizeAngle(heading - Number(angle || 0));
      const nextHeading = heading;
      enqueueOperation(() => {
        renderedHeading = nextHeading;
        draw();
      });
    };
    const left = (angle) => {
      heading = normalizeAngle(heading + Number(angle || 0));
      const nextHeading = heading;
      enqueueOperation(() => {
        renderedHeading = nextHeading;
        draw();
      });
    };
    const penup = () => {
      penDown = false;
      commitStyleToNewPath();
      draw();
    };
    const pendownFn = () => {
      penDown = true;
      commitStyleToNewPath();
      draw();
    };
    const goto_ = (a, b) => {
      if (!ensureContext()) return;
      let nextX = Number(a);
      let nextY = Number(b);
      if (b === undefined && (Array.isArray(a) || (a && typeof a === "object"))) {
        const source =
          a && typeof a.toJs === "function" ? a.toJs({ pyproxies: [] }) : a;
        nextX = Number(source?.[0] ?? source?.x ?? 0);
        nextY = Number(source?.[1] ?? source?.y ?? 0);
      }
      x = Number.isFinite(nextX) ? nextX : 0;
      y = Number.isFinite(nextY) ? nextY : 0;
      const path = ensurePath();
      const fill = filling ? fillPath : null;
      const point = { x, y, move: !penDown };
      enqueueOperation(() => {
        renderedX = point.x;
        renderedY = point.y;
        path.points.push(point);
        if (fill) {
          fill.points.push({ x, y });
        }
        draw();
      });
    };
    const setx = (value) => goto_(Number(value), y);
    const sety = (value) => goto_(x, Number(value));
    const position = () => [x, y];
    const xcor = () => x;
    const ycor = () => y;
    const heading_ = () => heading;
    const setheading = (angle) => {
      heading = normalizeAngle(angle);
      const nextHeading = heading;
      enqueueOperation(() => {
        renderedHeading = nextHeading;
        draw();
      });
    };
    const home = () => {
      goto_(0, 0);
      setheading(0);
    };
    const towards = (tx, ty) => {
      const dx = Number(tx) - x;
      const dy = Number(ty) - y;
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return 0;
      return normalizeAngle((Math.atan2(dy, dx) * 180) / Math.PI);
    };
    const speed = (value = 0) => {
      const numeric = Number(value);
      turtleSpeed = Number.isFinite(numeric) ? numeric : 0;
      delayMs = turtleSpeed <= 0 ? 0 : Math.max(0, Math.round(300 / turtleSpeed));
      return delayMs;
    };
    const colormode = (mode = undefined) => {
      if (mode === undefined) return colorMode;
      const numeric = Number(mode);
      if (numeric !== 1 && numeric !== 255) {
        throw new Error("colormode must be 1.0 or 255");
      }
      colorMode = numeric;
      return colorMode;
    };
    const screensize = (canvwidth = undefined, canvheight = undefined, bg = undefined) => {
      if (canvwidth === undefined && canvheight === undefined && bg === undefined) {
        return [screenWidth || cssWidth || 0, screenHeight || cssHeight || 0];
      }
      if (canvwidth !== undefined && canvwidth !== null) {
        const width = Math.floor(Number(canvwidth));
        if (Number.isFinite(width) && width > 0) {
          screenWidth = width;
        }
      }
      if (canvheight !== undefined && canvheight !== null) {
        const height = Math.floor(Number(canvheight));
        if (Number.isFinite(height) && height > 0) {
          screenHeight = height;
        }
      }
      if (bg !== undefined && bg !== null) {
        backgroundColor = toColorString(bg);
      }
      draw();
      if (canvas?.parentElement) {
        const wrapper = canvas.parentElement;
        wrapper.scrollLeft = Math.max(0, (cssWidth - wrapper.clientWidth) / 2);
        wrapper.scrollTop = Math.max(0, (cssHeight - wrapper.clientHeight) / 2);
      }
      return [screenWidth || cssWidth || 0, screenHeight || cssHeight || 0];
    };
    const color = (...args) => {
      const stroke = toColorString(args[0]);
      const fill = args.length > 1 ? toColorString(args[1]) : stroke;
      strokeColor = stroke;
      fillColor = fill;
      commitStyleToNewPath();
      if (filling && fillPath) {
        fillPath.fillstyle = fillColor;
      }
      draw();
    };
    const pencolor = (value) => {
      strokeColor = toColorString(value);
      commitStyleToNewPath();
      draw();
    };
    const fillcolor = (value) => {
      fillColor = toColorString(value);
      if (filling && fillPath) {
        fillPath.fillstyle = fillColor;
      }
      commitStyleToNewPath();
      draw();
    };
    const pensize = (value) => {
      ensurePath().lineWidth = Math.max(1, Number(value) || DEFAULT_LINE_WIDTH);
      commitStyleToNewPath();
      draw();
    };
    const width = (value) => pensize(value);
    const begin_fill = () => {
      if (filling) return;
      filling = true;
      fillPath = makePath({
        down: false,
        fill: true,
        stroke: "transparent",
        lineWidth: 1,
        fillstyle: fillColor,
      });
      paths.push(fillPath);
      draw();
    };
    const end_fill = () => {
      filling = false;
      fillPath = null;
      commitStyleToNewPath();
      draw();
    };
    const dot = (size = 5, colorValue = null) => {
      const segment = makePath({
        down: false,
        fill: false,
        stroke: colorValue ? toColorString(colorValue) : strokeColor,
        fillstyle: colorValue ? toColorString(colorValue) : strokeColor,
        points: [
          {
            x,
            y,
            dotRadius: Math.max(0.5, Number(size) || 5) / 2,
            color: colorValue ? toColorString(colorValue) : strokeColor,
          },
        ],
      });
      enqueueOperation(() => {
        paths.push(segment);
        draw();
      });
    };
    const circle = (radius, steps = 120) => {
      const numericRadius = Number(radius) || 0;
      const stepCount = Math.max(8, Number(steps) | 0);
      const circumference = 2 * Math.PI * Math.abs(numericRadius);
      const stepLength = circumference / stepCount;
      const stepTurn = (360 / stepCount) * (numericRadius >= 0 ? 1 : -1);
      for (let index = 0; index < stepCount; index += 1) {
        forward(stepLength);
        left(stepTurn);
      }
    };
    const write = (text, move = false, align = "left", font = null) => {
      let writeText = text;
      let writeMove = move;
      let writeAlign = align;
      let writeFont = font;
      const applyWriteKwargs = (candidate) => {
        if (!isWriteKwargsObject(candidate)) return;
        const kwargs = toPlainObject(candidate);
        if (!kwargs) return;
        if (hasOwn(kwargs, "arg")) writeText = kwargs.arg;
        else if (hasOwn(kwargs, "text")) writeText = kwargs.text;
        if (hasOwn(kwargs, "move")) writeMove = kwargs.move;
        if (hasOwn(kwargs, "align")) writeAlign = kwargs.align;
        if (hasOwn(kwargs, "font")) writeFont = kwargs.font;
      };
      applyWriteKwargs(writeText);
      applyWriteKwargs(writeMove);
      applyWriteKwargs(writeAlign);
      applyWriteKwargs(writeFont);
      if (isWriteKwargsObject(writeFont)) writeFont = null;

      let family = currentFontFamily;
      let size = fontSize;
      let style = currentFontStyle;
      try {
        const source = toSequence(writeFont);
        if (source?.length) {
          if (source[0]) family = toPlainString(source[0], family);
          if (source[1] !== undefined && source[1] !== null) {
            size = toPlainNumber(source[1], size);
          }
          if (source[2]) style = toPlainString(source[2], style);
        }
      } catch {}
      const normalizedAlign = normalizeTextAlign(writeAlign);
      const segment = makePath({
        down: false,
        fill: false,
        stroke: strokeColor,
        points: [
          {
            x,
            y,
            text: String(writeText),
            align: normalizedAlign,
            fontsize: size,
            fontfamily: family,
            fontstyle: style,
            color: strokeColor,
          },
        ],
      });
      if (toPlainBoolean(writeMove, false)) {
        const metrics = measureTurtleText(String(writeText), family, size, style);
        const left = metrics.left || 0;
        const right = metrics.right || metrics.width || 0;
        const align = normalizeTextAlign(normalizedAlign);
        const textWidth = left + right;
        if (align === "left") {
          x += TK_TEXT_X_OFFSET + textWidth;
        } else if (align === "center") {
          x += TK_TEXT_X_OFFSET + right;
        } else {
          x += TK_TEXT_X_OFFSET;
        }
        commitStyleToNewPath();
      }
      enqueueOperation(() => {
        paths.push(segment);
        draw();
      });
    };
    const setfontsize = (value) => {
      const nextSize = toPlainNumber(value, DEFAULT_FONT_SIZE);
      fontSize = Math.max(1, Number.isFinite(nextSize) ? nextSize : DEFAULT_FONT_SIZE);
      commitStyleToNewPath();
      draw();
    };
    const bgcolor = (value) => {
      backgroundColor = toColorString(value);
      draw();
    };
    const bgpic = (filename = "") => {
      const name = String(filename || "").trim();
      if (!name) {
        backgroundImage = null;
        draw();
        return;
      }
      const fs = pyodide?.FS;
      if (!fs) return;
      const candidates = [
        name,
        `/home/pyodide/${name}`,
        `/home/pyodide/files/${name}`,
        `/home/pyodide/uploads/${name}`,
      ];
      for (const candidate of candidates) {
        try {
          const data = fs.readFile(candidate);
          const blob = new Blob([data], { type: "image/*" });
          const url = URL.createObjectURL(blob);
          const image = new Image();
          image.onload = () => {
            backgroundImage = image;
            draw();
            URL.revokeObjectURL(url);
          };
          image.onerror = () => URL.revokeObjectURL(url);
          image.src = url;
          return;
        } catch {}
      }
    };
    const clear = () => {
      clearQueue();
      paths = [];
      currentPath = null;
      fillPath = null;
      beginCurrentPath();
      draw();
    };
    const reset = () => {
      resetState();
    };
    const showturtle = () => {
      turtleVisible = true;
      enqueueOperation(() => {
        renderedTurtleVisible = true;
        draw();
      });
    };
    const hideturtle = () => {
      turtleVisible = false;
      enqueueOperation(() => {
        renderedTurtleVisible = false;
        draw();
      });
    };
    const isvisible = () => turtleVisible;
    const pen = (options = undefined) => {
      if (options === undefined) {
        return getPenState();
      }
      const source =
        options && typeof options.toJs === "function"
          ? options.toJs({ pyproxies: [], dict_converter: Object.fromEntries })
          : options;
      if (!source || typeof source !== "object") return getPenState();
      if ("pendown" in source) {
        penDown = !!source.pendown;
      }
      if ("pencolor" in source) {
        strokeColor = toColorString(source.pencolor);
      }
      if ("fillcolor" in source) {
        fillColor = toColorString(source.fillcolor);
      }
      if ("pensize" in source) {
        ensurePath().lineWidth = Math.max(1, Number(source.pensize) || DEFAULT_LINE_WIDTH);
      }
      if ("shown" in source) {
        turtleVisible = !!source.shown;
        renderedTurtleVisible = turtleVisible;
      }
      commitStyleToNewPath();
      draw();
      return getPenState();
    };

    const api = {
      __bindCanvas: bindCanvas,
      __deactivate: deactivate,
      __redraw: draw,
      __resetState: resetState,
      __setPyodide: (runtime) => {
        pyodide = runtime;
      },
      forward,
      fd: forward,
      backward,
      bk: backward,
      back: backward,
      right,
      rt: right,
      left,
      lt: left,
      goto: (...args) => goto_(...args),
      setpos: (...args) => goto_(...args),
      setposition: (...args) => goto_(...args),
      setx,
      sety,
      setheading,
      seth: setheading,
      home,
      circle,
      dot,
      position,
      pos: position,
      xcor,
      ycor,
      heading: heading_,
      towards,
      pendown: pendownFn,
      pd: pendownFn,
      down: pendownFn,
      penup,
      pu: penup,
      up: penup,
      pensize,
      width,
      pen,
      write,
      setfontsize,
      color,
      pencolor,
      fillcolor,
      begin_fill,
      end_fill,
      bgcolor,
      bgpic,
      reset,
      clear,
      speed,
      colormode,
      screensize,
      showturtle,
      st: showturtle,
      hideturtle,
      ht: hideturtle,
      isvisible,
    };

    return api;
  };

  const createPytamaroJsFFI = () => {
    const floatBuffer = new ArrayBuffer(4);
    const floatView = new DataView(floatBuffer);

    const unProxy = (obj) => {
      if (typeof obj === "object" && obj !== null && typeof obj.toJs === "function") {
        try {
          return obj.toJs({ pyproxies: [], dict_converter: Object.fromEntries });
        } catch (e) {
          console.error("Error converting PyProxy:", e);
          return obj;
        }
      }
      return obj;
    };

    const uint32ToFloat = (u32) => {
      floatView.setUint32(0, u32 >>> 0, false);
      return floatView.getFloat32(0, false);
    };

    const decodePoint = (value, width, height) => {
      const packed = typeof value === "bigint" ? value : BigInt(value || 0);
      const x = uint32ToFloat(Number((packed >> 32n) & 0xffffffffn));
      const y = uint32ToFloat(Number(packed & 0xffffffffn));
      return { x: x * width * 0.5, y: -y * height * 0.5 };
    };

    const colorToCss = (value) => {
      const argb =
        typeof value === "bigint"
          ? Number(value & 0xffffffffn)
          : Number(value >>> 0);
      const a = ((argb >> 24) & 0xff) / 255;
      const r = (argb >> 16) & 0xff;
      const g = (argb >> 8) & 0xff;
      const b = argb & 0xff;
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    };

    const rotatePoint = (point, pivot, angleRad) => {
      const dx = point.x - pivot.x;
      const dy = point.y - pivot.y;
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);
      return {
        x: pivot.x + dx * cos - dy * sin,
        y: pivot.y + dx * sin + dy * cos,
      };
    };

    const buildGraphic = (specs) => {
      const stack = [];
      const measureCanvas = document.createElement("canvas");
      const measureCtx = measureCanvas.getContext("2d");

      for (const spec of specs || []) {
        if (!spec || typeof spec !== "object") continue;
        const type = spec.t;
        if (
          type === "Empty" ||
          type === "Rectangle" ||
          type === "Ellipse" ||
          type === "CircularSector" ||
          type === "Triangle" ||
          type === "Text"
        ) {
          let width = 0;
          let height = 0;
          let pin = { x: 0, y: 0 };
          let draw = () => {};

          if (type === "Rectangle") {
            width = Math.max(0, Number(spec.width) || 0);
            height = Math.max(0, Number(spec.height) || 0);
            const fill = colorToCss(spec.color);
            draw = (ctx) => {
              ctx.fillStyle = fill;
              ctx.fillRect(-width / 2, -height / 2, width, height);
            };
          } else if (type === "Ellipse") {
            width = Math.max(0, Number(spec.width) || 0);
            height = Math.max(0, Number(spec.height) || 0);
            const fill = colorToCss(spec.color);
            draw = (ctx) => {
              ctx.beginPath();
              ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, 2 * Math.PI);
              ctx.fillStyle = fill;
              ctx.fill();
            };
          } else if (type === "CircularSector") {
            const radius = Math.max(0, Number(spec.radius) || 0);
            const angle = Number(spec.angle) || 0;
            width = radius * 2;
            height = radius * 2;
            const fill = colorToCss(spec.color);
            draw = (ctx) => {
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.arc(0, 0, radius, 0, (-angle * Math.PI) / 180, true);
              ctx.closePath();
              ctx.fillStyle = fill;
              ctx.fill();
            };
          } else if (type === "Triangle") {
            const side1 = Math.max(0, Number(spec.side1) || 0);
            const side2 = Math.max(0, Number(spec.side2) || 0);
            const angle = (Number(spec.angle) || 0) * (Math.PI / 180);
            const p1 = { x: 0, y: 0 };
            const p2 = { x: side1, y: 0 };
            const p3 = { x: side2 * Math.cos(angle), y: -side2 * Math.sin(angle) };
            const centroid = {
              x: (p1.x + p2.x + p3.x) / 3,
              y: (p1.y + p2.y + p3.y) / 3,
            };
            const points = [p1, p2, p3].map((p) => ({
              x: p.x - centroid.x,
              y: p.y - centroid.y,
            }));
            const xs = points.map((p) => p.x);
            const ys = points.map((p) => p.y);
            width = Math.max(...xs) - Math.min(...xs);
            height = Math.max(...ys) - Math.min(...ys);
            const fill = colorToCss(spec.color);
            draw = (ctx) => {
              ctx.beginPath();
              ctx.moveTo(points[0].x, points[0].y);
              ctx.lineTo(points[1].x, points[1].y);
              ctx.lineTo(points[2].x, points[2].y);
              ctx.closePath();
              ctx.fillStyle = fill;
              ctx.fill();
            };
          } else if (type === "Text") {
            const text = String(spec.text || "");
            const fontName = String(spec.font_name || "sans-serif");
            const textSize = Math.max(1, Number(spec.text_size) || 1);
            const fill = colorToCss(spec.color);
            measureCtx.font = `${textSize}px ${fontName}`;
            const metrics = measureCtx.measureText(text);
            width = Math.max(0, metrics.width || 0);
            const ascent = metrics.actualBoundingBoxAscent || textSize * 0.8;
            const descent = metrics.actualBoundingBoxDescent || textSize * 0.2;
            height = ascent + descent;
            pin = { x: -width / 2, y: (ascent - descent) / 2 };
            draw = (ctx) => {
              ctx.fillStyle = fill;
              ctx.font = `${textSize}px ${fontName}`;
              ctx.textAlign = "left";
              ctx.textBaseline = "alphabetic";
              const centerY = (descent - ascent) / 2;
              ctx.fillText(text, -width / 2, -centerY);
            };
          }

          stack.push({ width, height, pin, draw });
          continue;
        }

        if (type === "Pin") {
          const child = stack.pop();
          if (!child) continue;
          const pin = decodePoint(spec.pin, child.width, child.height);
          stack.push({ ...child, pin });
          continue;
        }

        if (type === "Rotate") {
          const child = stack.pop();
          if (!child) continue;
          const angleDeg = Number(spec.angle) || 0;
          const angleRad = (-angleDeg * Math.PI) / 180;
          const corners = [
            { x: -child.width / 2, y: -child.height / 2 },
            { x: child.width / 2, y: -child.height / 2 },
            { x: child.width / 2, y: child.height / 2 },
            { x: -child.width / 2, y: child.height / 2 },
          ].map((p) => rotatePoint(p, child.pin, angleRad));
          const minX = Math.min(...corners.map((p) => p.x));
          const maxX = Math.max(...corners.map((p) => p.x));
          const minY = Math.min(...corners.map((p) => p.y));
          const maxY = Math.max(...corners.map((p) => p.y));
          const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
          const offset = { x: -center.x, y: -center.y };
          const pin = { x: child.pin.x + offset.x, y: child.pin.y + offset.y };

          stack.push({
            width: maxX - minX,
            height: maxY - minY,
            pin,
            draw: (ctx) => {
              ctx.save();
              ctx.translate(offset.x, offset.y);
              ctx.translate(child.pin.x, child.pin.y);
              ctx.rotate(angleRad);
              ctx.translate(-child.pin.x, -child.pin.y);
              child.draw(ctx);
              ctx.restore();
            },
          });
          continue;
        }

        if (type === "Compose") {
          const bg = stack.pop();
          const fg = stack.pop();
          if (!fg || !bg) continue;
          const fgPin = spec.fg_pin
            ? decodePoint(spec.fg_pin, fg.width, fg.height)
            : fg.pin;
          const bgPin = spec.bg_pin
            ? decodePoint(spec.bg_pin, bg.width, bg.height)
            : bg.pin;

          const bgCenter = { x: 0, y: 0 };
          const fgCenter = { x: bgPin.x - fgPin.x, y: bgPin.y - fgPin.y };
          const minX = Math.min(
            fgCenter.x - fg.width / 2,
            bgCenter.x - bg.width / 2,
          );
          const maxX = Math.max(
            fgCenter.x + fg.width / 2,
            bgCenter.x + bg.width / 2,
          );
          const minY = Math.min(
            fgCenter.y - fg.height / 2,
            bgCenter.y - bg.height / 2,
          );
          const maxY = Math.max(
            fgCenter.y + fg.height / 2,
            bgCenter.y + bg.height / 2,
          );

          const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
          const fgOffset = {
            x: fgCenter.x - center.x,
            y: fgCenter.y - center.y,
          };
          const bgOffset = {
            x: bgCenter.x - center.x,
            y: bgCenter.y - center.y,
          };
          const pin = spec.pin
            ? decodePoint(spec.pin, maxX - minX, maxY - minY)
            : { x: bgPin.x - center.x, y: bgPin.y - center.y };

          stack.push({
            width: maxX - minX,
            height: maxY - minY,
            pin,
            draw: (ctx) => {
              ctx.save();
              ctx.translate(bgOffset.x, bgOffset.y);
              bg.draw(ctx);
              ctx.restore();
              ctx.save();
              ctx.translate(fgOffset.x, fgOffset.y);
              fg.draw(ctx);
              ctx.restore();
            },
          });
        }
      }

      return (
        stack[stack.length - 1] || {
          width: 0,
          height: 0,
          pin: { x: 0, y: 0 },
          draw: () => {},
        }
      );
    };

     return {
      js_graphic_size: (specs) => {
        try {
          const unproxiedSpecs = unProxy(specs);
          const graphic = buildGraphic(unproxiedSpecs);
          return { width: graphic.width, height: graphic.height };
        } catch (e) {
          console.error("js_graphic_size error:", e);
          throw e;
        }
      },
      js_render_graphic: (specs, scalingFactor, debug) => {
        try {
          const unproxiedSpecs = unProxy(specs);
          const graphic = buildGraphic(unproxiedSpecs);
          const width = Math.max(1, Math.ceil(graphic.width));
          const height = Math.max(1, Math.ceil(graphic.height));
          const scale = Math.max(1, Number(scalingFactor) || 1);
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.ceil(width * scale));
          canvas.height = Math.max(1, Math.ceil(height * scale));
          const ctx = canvas.getContext("2d");
          ctx.scale(scale, scale);
          ctx.translate(width / 2, height / 2);
          graphic.draw(ctx);

          if (debug) {
            ctx.strokeStyle = "red";
            ctx.lineWidth = 1 / scale;
            ctx.strokeRect(-width / 2, -height / 2, width, height);
            ctx.strokeStyle = "rgba(255, 255, 0, 0.8)";
            ctx.beginPath();
            ctx.moveTo(graphic.pin.x - 8, graphic.pin.y);
            ctx.lineTo(graphic.pin.x + 8, graphic.pin.y);
            ctx.moveTo(graphic.pin.x, graphic.pin.y - 8);
            ctx.lineTo(graphic.pin.x, graphic.pin.y + 8);
            ctx.stroke();
          }

          return canvas.toDataURL("image/png");
        } catch (e) {
          console.error("js_render_graphic error:", e);
          throw e;
        }
      },
      js_save: (filename, content) => {
        const link = document.createElement("a");
        link.href = String(content || "");
        link.download = String(filename || "graphic.png");
        link.click();
      },
    };
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
      /(?:^|\W)(?:import\s+sas_pygame\b|from\s+sas_pygame\b\s+import\b)/m.test(text);
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

  const maybeAutoWrapPygame = (code) => {
    try {
      const text = String(code || "");
      if (!looksLikeTopLevelGameLoop(text)) return text;
      return wrapTopLevelIntoAsyncMain(text);
    } catch {
      return String(code || "");
    }
  };

  const ensureMicropipPackages = async (id, pyodide, packages = []) => {
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

  const executeScript = async (id, script, context = {}, packages = []) => {
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

  const requestStop = (id) => {
    const state = getExecutionState(id);
    const hasRuntime = runtimes.has(id);
    if ((!state.running && !hasRuntime) || state.stopRequested) return;
    state.stopRequested = true;
    state.stopping = true;
    const interruptBuffer = interruptBuffers.get(id);
    if (interruptBuffer) {
      interruptBuffer[0] = 2;
      appendOutputLine(id, "Stop requested. Interrupting execution...");
    } else {
      appendOutputLine(id, hyperbook.i18n.get("pyide-stop-reloading"));
    }
    releaseKeyboardCapture(id);
    updateRunning();
    if (!interruptBuffer) {
      window.setTimeout(() => {
        window.location.reload();
      }, 50);
    }
  };

  const handleStopClick = (event) => {
    const elem = event.currentTarget.closest(".directive-pyide");
    if (!elem?.id) return;
    requestStop(elem.id);
  };

  const getRunningInstanceId = () => {
    const elems = document.getElementsByClassName("directive-pyide");
    for (const elem of elems) {
      if (getExecutionState(elem.id).running) {
        return elem.id;
      }
    }
    return null;
  };

  const updateRunning = () => {
    const runningInstanceId = getRunningInstanceId();
    const elems = document.getElementsByClassName("directive-pyide");
    for (let elem of elems) {
      const run = elem.getElementsByClassName("run")[0];
      const test = elem.getElementsByClassName("test")[0];
      const stop = elem.getElementsByClassName("stop")[0];
      const editor = elem.getElementsByClassName("editor")[0];
      const editorCm = editor?._cm;
      const state = getExecutionState(elem.id);
      const hasRuntime = runtimes.has(elem.id);
      const hasInterrupt = interruptBuffers.has(elem.id);
      const lockedByOther =
        runningInstanceId !== null &&
        runningInstanceId !== elem.id &&
        !state.running;

      stop?.removeEventListener("click", handleStopClick);
      run.classList.remove("stopping");
      run.classList.remove("locked");
      test?.classList.remove("stopping");
      test?.classList.remove("locked");
      stop?.classList.remove("stopping");
      elem.classList.toggle("locked-by-other", lockedByOther);

      if (state.running || lockedByOther) {
        editor?.classList.add("running");
        editorCm?.setReadOnly(true);
        if (state.running && state.type === "run") {
          run.textContent = hyperbook.i18n.get("pyide-running");
          run.disabled = true;
          run.classList.add("running");
          if (test) {
            test.classList.add("running");
            test.disabled = true;
          }
        } else if (state.running && state.type === "test" && test) {
          test.textContent = hyperbook.i18n.get("pyide-testing");
          test.disabled = true;
          test.classList.add("running");
          run.classList.add("running");
          run.disabled = true;
        } else {
          const lockLabel = lockedByOther
            ? "pyide-locked-other-instance-running"
            : "pyide-run";
          run.textContent = hyperbook.i18n.get(lockLabel);
          run.classList.add("running");
          run.classList.toggle("locked", lockedByOther);
          run.disabled = true;
          if (test) {
            test.textContent = hyperbook.i18n.get(
              lockedByOther ? "pyide-locked-other-instance-running" : "pyide-test",
            );
            test.classList.toggle("locked", lockedByOther);
            test.classList.add("running");
            test.disabled = true;
          }
        }

        if (stop) {
          const stopLabel = hasInterrupt ? "pyide-stop" : "pyide-stop-refresh";
          if (state.running) {
            stop.textContent = state.stopping
              ? hyperbook.i18n.get("pyide-stopping")
              : hyperbook.i18n.get(stopLabel);
            stop.disabled = false;
            stop.addEventListener("click", handleStopClick);
          } else {
            stop.textContent = hyperbook.i18n.get(stopLabel);
            stop.disabled = true;
          }
          stop.classList.toggle("stopping", state.stopping);
        }
      } else {
        editor?.classList.remove("running");
        editorCm?.setReadOnly(false);
        run.classList.remove("stopping");
        run.classList.remove("running");
        run.textContent = hyperbook.i18n.get("pyide-run");
        run.disabled = false;
        if (test) {
          test.classList.remove("stopping");
          test.classList.remove("running");
          test.textContent = hyperbook.i18n.get("pyide-test");
          test.disabled = false;
        }
        if (stop) {
          stop.classList.remove("stopping");
          stop.classList.remove("running");
          stop.textContent = hyperbook.i18n.get(
            hasInterrupt ? "pyide-stop" : "pyide-stop-refresh",
          );
          stop.disabled = true;
        }
      }
    }
  };

  const setupSplitter = (
    elem,
    container,
    editorContainer,
    splitter,
    onSplitChanged,
  ) => {
    if (!container || !editorContainer || !splitter) return;

    const minPanelSize = 120;

    const getIsHorizontal = () =>
      getComputedStyle(elem).flexDirection.startsWith("row");

    const applySplitSize = (rawSize, isHorizontal) => {
      const total = isHorizontal ? elem.clientWidth : elem.clientHeight;
      const splitterSize = isHorizontal ? splitter.offsetWidth : splitter.offsetHeight;
      const maxSize = Math.max(
        minPanelSize,
        total - splitterSize - minPanelSize
      );
      const clamped = Math.max(minPanelSize, Math.min(rawSize, maxSize));
      container.style.flex = `0 0 ${clamped}px`;
      return clamped;
    };

    const applyStoredSplitSize = () => {
      const isHorizontal = getIsHorizontal();
      elem.classList.toggle("split-horizontal", isHorizontal);
      elem.classList.toggle("split-vertical", !isHorizontal);
      const key = isHorizontal ? "splitHorizontal" : "splitVertical";
      const rawStored = Number(elem.dataset[key]);
      if (!Number.isFinite(rawStored) || rawStored <= 0) {
        container.style.flex = "";
        return;
      }
      applySplitSize(rawStored, isHorizontal);
    };

    applyStoredSplitSize();

    splitter.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      splitter.setPointerCapture(event.pointerId);

      const isHorizontal = getIsHorizontal();
      const key = isHorizontal ? "splitHorizontal" : "splitVertical";
      const startPointer = isHorizontal ? event.clientX : event.clientY;
      const startSize = isHorizontal
        ? container.getBoundingClientRect().width
        : container.getBoundingClientRect().height;

      elem.classList.add("resizing");

      const onPointerMove = (moveEvent) => {
        const pointer = isHorizontal ? moveEvent.clientX : moveEvent.clientY;
        const delta = pointer - startPointer;
        const size = applySplitSize(startSize + delta, isHorizontal);
        elem.dataset[key] = String(Math.round(size));
      };

      const onPointerUp = () => {
        elem.classList.remove("resizing");
        splitter.removeEventListener("pointermove", onPointerMove);
        splitter.removeEventListener("pointerup", onPointerUp);
        splitter.removeEventListener("pointercancel", onPointerUp);
        const splitHorizontal = Number(elem.dataset.splitHorizontal);
        const splitVertical = Number(elem.dataset.splitVertical);
        onSplitChanged?.({
          ...(Number.isFinite(splitHorizontal) && splitHorizontal > 0
            ? { splitHorizontal: Math.round(splitHorizontal) }
            : {}),
          ...(Number.isFinite(splitVertical) && splitVertical > 0
            ? { splitVertical: Math.round(splitVertical) }
            : {}),
        });
      };

      splitter.addEventListener("pointermove", onPointerMove);
      splitter.addEventListener("pointerup", onPointerUp);
      splitter.addEventListener("pointercancel", onPointerUp);
    });

    window.addEventListener("resize", applyStoredSplitSize);
    return applyStoredSplitSize;
  };

  const setupCanvasOutputSplitter = (
    elem,
    container,
    canvasWrapper,
    output,
    splitter,
    onSplitChanged,
  ) => {
    if (!elem || !container || !canvasWrapper || !output || !splitter) return;

    const minPanelSize = 80;

    const getAvailableHeight = () => {
      const tabs = container.querySelector(".buttons");
      const tabsHeight = tabs && tabs.offsetParent !== null ? tabs.offsetHeight : 0;
      return container.clientHeight - tabsHeight - splitter.offsetHeight;
    };

    const applySplitSize = (rawSize) => {
      const total = getAvailableHeight();
      const maxSize = Math.max(minPanelSize, total - minPanelSize);
      const clamped = Math.max(minPanelSize, Math.min(rawSize, maxSize));
      canvasWrapper.style.flex = `0 0 ${clamped}px`;
      output.style.flex = "1 1 0";
      return clamped;
    };

    const applyStoredSplitSize = () => {
      const rawStored = Number(elem.dataset.splitCanvasOutput);
      if (!Number.isFinite(rawStored) || rawStored <= 0) {
        canvasWrapper.style.flex = "1 1 0";
        output.style.flex = "1 1 0";
        return;
      }
      applySplitSize(rawStored);
    };

    splitter.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      splitter.setPointerCapture(event.pointerId);

      const startPointer = event.clientY;
      const startSize = canvasWrapper.getBoundingClientRect().height;

      elem.classList.add("resizing");

      const onPointerMove = (moveEvent) => {
        const delta = moveEvent.clientY - startPointer;
        const size = applySplitSize(startSize + delta);
        elem.dataset.splitCanvasOutput = String(Math.round(size));
      };

      const onPointerUp = () => {
        elem.classList.remove("resizing");
        splitter.removeEventListener("pointermove", onPointerMove);
        splitter.removeEventListener("pointerup", onPointerUp);
        splitter.removeEventListener("pointercancel", onPointerUp);
        const splitCanvasOutput = Number(elem.dataset.splitCanvasOutput);
        if (Number.isFinite(splitCanvasOutput) && splitCanvasOutput > 0) {
          onSplitChanged?.({ splitCanvasOutput: Math.round(splitCanvasOutput) });
        }
      };

      splitter.addEventListener("pointermove", onPointerMove);
      splitter.addEventListener("pointerup", onPointerUp);
      splitter.addEventListener("pointercancel", onPointerUp);
    });

    window.addEventListener("resize", applyStoredSplitSize);
    return applyStoredSplitSize;
  };

  const init = (root) => {
    const elems = root.getElementsByClassName("directive-pyide");

    for (let elem of elems) {
      if (elem.getAttribute("data-pyide-initialized") === "true") continue;
      elem.setAttribute("data-pyide-initialized", "true");

      const editorDiv = elem.getElementsByClassName("editor")[0];
      const container = elem.getElementsByClassName("container")[0];
      const editorContainer = elem.getElementsByClassName("editor-container")[0];
      const splitter = elem.getElementsByClassName("splitter")[0];
      const run = elem.getElementsByClassName("run")[0];
      const test = elem.getElementsByClassName("test")[0];
      const stop = elem.getElementsByClassName("stop")[0];
      const output = elem.getElementsByClassName("output")[0];
      const canvas = elem.getElementsByClassName("canvas")[0];
      const canvasWrapper = elem.getElementsByClassName("canvas-wrapper")[0] || canvas;
      const canvasOutputSplitter = elem.getElementsByClassName("canvas-output-splitter")[0];
      const canvasHeader = elem.getElementsByClassName("canvas-header")[0];
      const outputHeader = elem.getElementsByClassName("output-header")[0];
      const outputBtn = elem.getElementsByClassName("output-btn")[0];
      const canvasBtn = elem.getElementsByClassName("canvas-btn")[0];
      const canvasTabs = outputBtn?.closest(".buttons");

      const copyEl = elem.getElementsByClassName("copy")[0];
      const resetEl = elem.getElementsByClassName("reset")[0];
      const downloadEl = elem.getElementsByClassName("download")[0];
      const fullscreenEl = elem.getElementsByClassName("fullscreen")[0];

      const id = elem.id;
      const hasCanvas = elem.getAttribute("data-canvas") === "true";
      const additionalPackages = Array.from(
        new Set(
          (elem.getAttribute("data-packages") || "")
            .split(",")
            .map((pkg) => pkg.trim())
            .filter((pkg) => pkg.length > 0),
        ),
      );
      const hasPytamaroPackage = additionalPackages.some(
        (pkg) => pkg.toLowerCase() === "pytamaro",
      );
      const scriptLooksLikePytamaro = (script) => {
        return /\bfrom\s+pytamaro\s+import\b|\bimport\s+pytamaro\b/.test(script);
      };
      let pyideState = { id };

      // Initialize CodeMirror
      const initialSource = editorDiv ? editorDiv.textContent : "";
      if (editorDiv) editorDiv.textContent = "";
      const cm = editorDiv ? HyperbookCM.create(editorDiv, {
        lang: editorDiv.dataset.lang || "python",
        value: initialSource,
        onChange: (code) => {
          void persistPyideState({ script: code });
        },
      }) : null;
      // Store CM on the element so updateRunning() can toggle readOnly
      if (editorDiv && cm) editorDiv._cm = cm;

      const getEditorValue = () => cm?.getValue() ?? "";

      pyideState = { ...pyideState, script: getEditorValue() };

      const persistPyideState = (updates = {}) => {
        pyideState = { ...pyideState, ...updates, id };
        return hyperbook.store.db.pyide.put(pyideState);
      };

      copyEl?.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(getEditorValue());
        } catch (error) {
          console.error(error.message);
        }
      });

      resetEl?.addEventListener("click", () => {
        hyperbook.store.db.pyide.delete(id);
        window.location.reload();
      });

      downloadEl?.addEventListener("click", () => {
        const a = document.createElement("a");
        const blob = new Blob([getEditorValue()], { type: "text/plain" });
        a.href = URL.createObjectURL(blob);
        a.download = `script-${id}.py`;
        a.click();
      });

      fullscreenEl?.addEventListener("click", async () => {
        try {
          await toggleFullscreen(elem);
        } catch (error) {
          console.error(error.message);
        }
      });
      updateFullscreenButtonState(elem, fullscreenEl);
      let tests = [];
      try {
        tests = JSON.parse(atob(elem.getAttribute("data-tests")));
      } catch (e) {}

      const isWideCanvasMode = () =>
        hasCanvas && window.matchMedia("(min-width: 1024px)").matches;

      let activeCanvasView = "output";

      const showOutputTab = () => {
        activeCanvasView = "output";
        outputBtn.classList.add("active");
        if (canvasBtn) canvasBtn.classList.remove("active");
        canvasHeader?.classList.add("hidden");
        outputHeader?.classList.add("hidden");
        output.classList.remove("hidden");
        if (canvasWrapper) canvasWrapper.classList.add("hidden");
        canvasOutputSplitter?.classList.add("hidden");
      };
      const showCanvasTab = () => {
        activeCanvasView = "canvas";
        outputBtn.classList.remove("active");
        if (canvasBtn) canvasBtn.classList.add("active");
        canvasHeader?.classList.add("hidden");
        outputHeader?.classList.add("hidden");
        output.classList.add("hidden");
        if (canvasWrapper) canvasWrapper.classList.remove("hidden");
        canvasOutputSplitter?.classList.add("hidden");
        turtleModules.get(id)?.__redraw?.();
      };

      const applyStoredCanvasOutputSplit = setupCanvasOutputSplitter(
        elem,
        container,
        canvasWrapper,
        output,
        canvasOutputSplitter,
        (splitState) => {
          void persistPyideState(splitState);
        },
      );

      const applyCanvasOutputLayout = () => {
        if (!hasCanvas || !canvasWrapper || !canvasOutputSplitter) return;
        if (isWideCanvasMode()) {
          elem.classList.add("canvas-split-mode");
          canvasTabs?.classList.add("hidden");
          output.classList.remove("hidden");
          canvasWrapper.classList.remove("hidden");
          canvasOutputSplitter.classList.remove("hidden");
          canvasHeader?.classList.remove("hidden");
          outputHeader?.classList.remove("hidden");
          outputBtn.classList.add("active");
          outputBtn.disabled = true;
          if (canvasBtn) {
            canvasBtn.classList.add("active");
            canvasBtn.disabled = true;
          }
          applyStoredCanvasOutputSplit?.();
          turtleModules.get(id)?.__redraw?.();
          return;
        }

        elem.classList.remove("canvas-split-mode");
        canvasTabs?.classList.remove("hidden");
        output.style.flex = "";
        canvasWrapper.style.flex = "";
        outputBtn.disabled = false;
        if (canvasBtn) {
          canvasBtn.disabled = false;
        }
        if (activeCanvasView === "canvas") {
          showCanvasTab();
        } else {
          showOutputTab();
        }
      };

      function showOutput() {
        if (isWideCanvasMode()) {
          applyCanvasOutputLayout();
          return;
        }
        showOutputTab();
      }
      function showCanvas() {
        if (isWideCanvasMode()) {
          applyCanvasOutputLayout();
          return;
        }
        showCanvasTab();
      }

      outputBtn?.addEventListener("click", showOutput);
      canvasBtn?.addEventListener("click", showCanvas);
      const applyStoredSplitSize = setupSplitter(
        elem,
        container,
        editorContainer,
        splitter,
        (splitState) => {
          void persistPyideState(splitState);
        },
      );

      let editorStateRestored = false;
      const restoreEditorState = async () => {
        if (editorStateRestored) return;
        editorStateRestored = true;

        const result = await hyperbook.store.db.pyide.get(id);
        if (result) {
          pyideState = { ...pyideState, ...result };
          if (typeof result.script === "string") {
            cm?.setValue(result.script);
          }
          if (
            Number.isFinite(result.splitHorizontal) &&
            result.splitHorizontal > 0
          ) {
            elem.dataset.splitHorizontal = String(Math.round(result.splitHorizontal));
          }
          if (
            Number.isFinite(result.splitVertical) &&
            result.splitVertical > 0
          ) {
            elem.dataset.splitVertical = String(Math.round(result.splitVertical));
          }
          if (
            Number.isFinite(result.splitCanvasOutput) &&
            result.splitCanvasOutput > 0
          ) {
            elem.dataset.splitCanvasOutput = String(
              Math.round(result.splitCanvasOutput),
            );
          }
          applyStoredSplitSize?.();
          applyCanvasOutputLayout();
        }
      };

      void restoreEditorState();

      window.addEventListener("resize", () => {
        applyCanvasOutputLayout();
        turtleModules.get(id)?.__redraw?.();
      });
      applyCanvasOutputLayout();

      test?.addEventListener("click", async () => {
        showOutput();
        const state = getExecutionState(id);
        if (state.running || getRunningInstanceId() !== null) return;
        state.running = true;
        state.type = "test";
        state.stopRequested = false;
        state.stopping = false;
        const interruptBuffer = interruptBuffers.get(id);
        if (interruptBuffer) interruptBuffer[0] = 0;
        updateRunning();

        output.innerHTML = "";
        clearPytamaroStdoutCarry(id);

        const script = getEditorValue();
        try {
          for (let test of tests) {
            if (state.stopRequested) {
              appendOutputLine(id, "Stopped pending test execution.");
              break;
            }

            const testCode = test.code.replace("#SCRIPT#", script);

            const heading = document.createElement("div");
            heading.innerHTML = `== Test ${test.name} ==`;
            heading.classList.add("test-heading");
            output.appendChild(heading);

            const { results, error } = await executeScript(
              id,
              testCode,
              {},
              additionalPackages,
            );
            if (results) {
              appendOutput(output, results);
            } else if (error) {
              appendOutput(output, error, true);
            }
          }
        } catch (e) {
          output.innerHTML = "";
          appendOutput(output, `Error: ${e}`, true);
          console.log(e);
        } finally {
          clearPytamaroStdoutCarry(id);
          state.running = false;
          state.stopping = false;
          state.type = null;
          releaseKeyboardCapture(id);
          updateRunning();
        }
      });

      run?.addEventListener("click", async () => {
        const script = getEditorValue();
        const usesPytamaro = hasPytamaroPackage || scriptLooksLikePytamaro(script);
        const renderPytamaroToCanvas = hasCanvas && canvas && usesPytamaro;
        if (hasCanvas) {
          showCanvas();
        } else {
          showOutput();
        }
        const state = getExecutionState(id);
        if (state.running || getRunningInstanceId() !== null) return;
        state.running = true;
        state.type = "run";
        state.stopRequested = false;
        state.stopping = false;
        const interruptBuffer = interruptBuffers.get(id);
        if (interruptBuffer) interruptBuffer[0] = 0;
        updateRunning();

        output.innerHTML = "";
        clearPytamaroStdoutCarry(id);
        try {
          setPytamaroCanvasTarget(id, renderPytamaroToCanvas);
          const { results, error } = await executeScript(id, script, {
            ...(hasCanvas && canvas ? { canvas } : {}),
          }, additionalPackages);
          if (!state.stopRequested) {
            if (results) {
              appendOutput(output, results, false, id);
            } else if (error) {
              showOutput();
              appendOutput(output, error, true, id);
            }
          } else {
            appendOutputLine(id, "Execution stopped.");
          }
        } catch (e) {
          showOutput();
          output.innerHTML = "";
          appendOutput(output, `Error: ${e}`, true, id);
          console.log(e);
        } finally {
          clearPytamaroStdoutCarry(id);
          state.running = false;
          state.stopping = false;
          state.type = null;
          releaseKeyboardCapture(id);
          updateRunning();
        }
      });

      stop?.addEventListener("click", handleStopClick);
    }
  };

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length) {
        mutation.addedNodes.forEach((node) => {
          if (node.type === 1 && node.classList?.contains("directive-pyide")) {
            init(node);
          }
        });
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener("DOMContentLoaded", () => {
    init(document);
  });
  document.addEventListener("fullscreenchange", syncFullscreenButtons);

  return { init };
})();
