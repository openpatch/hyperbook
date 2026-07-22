import { askStdinSync } from "./stdin.js";

export const createTurtleJsFFI = (id) => {
  const DEFAULT_LINE_WIDTH = 1;
  const DEFAULT_FONT_SIZE = 8;
  const DEFAULT_SHAPE = "classic";
  const DEFAULT_SPEED = 3;
  const DEFAULT_DELAY_MS = 80;
  const DEFAULT_UNDO_BUFFER = 1000;

  // CPython's named speeds (turtle.py Turtle.speed)
  const SPEED_NAMES = {
    fastest: 0,
    fast: 10,
    normal: 6,
    slow: 3,
    slowest: 1,
  };

  // Shape polygons in canvas-local coords (+x = forward, +y = down).
  // Derived from CPython/RPi turtle shapes by applying a 90° CCW screen rotation:
  // (sx, sy) → (sy, -sx).
  const TURTLE_SHAPES = {
    classic: [
      [0, 0],
      [-9, 5],
      [-7, 0],
      [-9, -5],
    ],
    arrow: [
      [0, 10],
      [0, -10],
      [10, 0],
    ],
    triangle: [
      [-5.77, -10],
      [11.55, 0],
      [-5.77, 10],
    ],
    square: [
      [-10, -10],
      [10, -10],
      [10, 10],
      [-10, 10],
    ],
    circle: "arc", // rendered as arc, not polygon
    blank: [],
    turtle: [
      [16, 0],
      [14, 2],
      [10, 1],
      [7, 4],
      [9, 7],
      [8, 9],
      [5, 6],
      [1, 7],
      [-3, 5],
      [-6, 8],
      [-8, 6],
      [-5, 4],
      [-7, 0],
      [-5, -4],
      [-8, -6],
      [-6, -8],
      [-3, -5],
      [1, -7],
      [5, -6],
      [8, -9],
      [9, -7],
      [7, -4],
      [10, -1],
      [14, -2],
    ],
  };

  // ---- Shared canvas/screen state ----
  let pyodide = null;
  let canvas = null;
  let context = null;
  let cssWidth = 0;
  let cssHeight = 0;
  let dpr = 1;
  let active = false;
  let backgroundColor = "#ffffff";
  let backgroundImage = null;
  let colorMode = 1.0;
  let delayMs = DEFAULT_DELAY_MS;
  let turtleSpeed = DEFAULT_SPEED;
  let screenWidth = 640;
  let screenHeight = 480;
  let screenMode = "standard";
  let screenTitle = "";
  let tracerN = 1;
  let tracerCounter = 0;
  let operationQueue = [];
  let queueGeneration = 0;
  let queueRunning = false;
  let stampCounter = 0;
  let undoBufferSize = DEFAULT_UNDO_BUFFER;
  // Listener teardown callbacks, so a re-run does not stack duplicate handlers.
  let eventCleanups = [];
  let pendingTimers = [];
  const textMeasureCanvas = document.createElement("canvas");
  const textMeasureContext = textMeasureCanvas.getContext("2d");

  // Registry of all active turtle pens (rendering state objects)
  const allPens = [];

  // ---- Shared helper functions ----
  const getCanvas = (elementId) =>
    document.getElementById(elementId)?.getElementsByClassName("canvas")[0] ||
    null;

  const normalizeAngle = (angle) => {
    const value = Number(angle) || 0;
    return ((value % 360) + 360) % 360;
  };

  const toRadians = (angle) => (Number(angle) * Math.PI) / 180;
  const toCanvasX = (value) => cssWidth / 2 + value;
  const toCanvasY = (value) => cssHeight / 2 - value;
  const toPlainNumber = (value, fallback = Number.NaN) => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "number")
      return Number.isFinite(value) ? value : fallback;
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
        return toPlainObject(
          value.toJs({ pyproxies: [], dict_converter: Object.fromEntries }),
        );
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
  const toColorString = (value) => {
    if (typeof value === "string") {
      return value;
    }
    if (value && typeof value.toJs === "function") {
      return toColorString(value.toJs({ pyproxies: [] }));
    }
    if (
      Array.isArray(value) ||
      (value && typeof value === "object" && "length" in value)
    ) {
      const parts = Array.from(value)
        .slice(0, 3)
        .map((part) => Number(part));
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

  // CPython accepts color("red"), color((r, g, b)) and color(r, g, b); the
  // three-argument form arrives here as three separate numbers.
  const colorFromArgs = (args) => {
    if (args.length === 0) return null;
    if (args.length === 1) return toColorString(args[0]);
    return toColorString(args.map((part) => toPlainNumber(part, Number.NaN)));
  };

  const sleep = (ms) =>
    new Promise((resolve) => window.setTimeout(resolve, ms));
  const clearQueue = () => {
    queueGeneration += 1;
    operationQueue = [];
    queueRunning = false;
  };
  const enqueueOperation = (fn) => {
    // With tracing off nothing is rendered until update(), so pacing the queue
    // would only make the program look like it hangs.
    if (delayMs <= 0 || tracerN === 0) {
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
      wrapperRect?.width ||
      canvas.parentElement?.clientWidth ||
      canvas.clientWidth ||
      canvas.width ||
      800;
    const panelHeight =
      wrapperRect?.height ||
      canvas.parentElement?.clientHeight ||
      canvas.clientHeight ||
      canvas.height ||
      400;
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

  // Draws the turtle cursor polygon at an arbitrary position/orientation. Used
  // both for the live turtle and for stamps.
  const drawCursor = (cursor) => {
    const points =
      TURTLE_SHAPES[cursor.shapeName] ?? TURTLE_SHAPES[DEFAULT_SHAPE];
    if (Array.isArray(points) && points.length === 0) return;
    context.save();
    context.translate(toCanvasX(cursor.x), toCanvasY(cursor.y));
    context.rotate(-toRadians(cursor.heading + (cursor.tilt || 0)));
    // stretchLen runs along the heading (canvas-local +x), stretchWid across it.
    context.scale(cursor.stretchLen || 1, cursor.stretchWid || 1);
    context.fillStyle = cursor.fillColor;
    context.strokeStyle = cursor.penColor;
    context.lineWidth = cursor.outline || 1;
    if (cursor.shapeName === "circle" || !Array.isArray(points)) {
      context.beginPath();
      context.arc(0, 0, 10, 0, 2 * Math.PI);
    } else {
      context.beginPath();
      context.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) {
        context.lineTo(points[i][0], points[i][1]);
      }
      context.closePath();
    }
    context.fill();
    context.stroke();
    context.restore();
  };

  const drawPathSegment = (path) => {
    if (path?.stamp) {
      drawCursor(path.stamp);
      return;
    }
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
        context.font = metrics.font;
        context.fillStyle = point.color || path.stroke;
        context.textAlign = align;
        context.textBaseline = "alphabetic";
        context.fillText(text, px, py);
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

  const drawTurtleShape = (pen) => {
    if (!pen.renderedTurtleVisible) return;
    drawCursor({
      x: pen.renderedX,
      y: pen.renderedY,
      heading: pen.renderedHeading,
      shapeName: pen.shapeName || DEFAULT_SHAPE,
      // CPython fills the cursor with fillcolor and outlines it with pencolor.
      fillColor: pen.shapeFillColor,
      penColor: pen.shapeColor,
      stretchLen: pen.stretchLen,
      stretchWid: pen.stretchWid,
      outline: pen.outlineWidth,
      tilt: pen.tilt,
    });
  };

  const render = () => {
    if (!active) return;
    if (!setupCanvasResolution()) return;
    drawBackground();
    for (const pen of allPens) {
      pen.paths.forEach(drawPathSegment);
    }
    for (const pen of allPens) {
      drawTurtleShape(pen);
    }
  };

  // tracer(0) suppresses rendering entirely until update() is called; tracer(n)
  // renders every n-th drawing operation.
  const draw = () => {
    if (tracerN === 0) return;
    tracerCounter += 1;
    if (tracerN > 1 && tracerCounter % tracerN !== 0) return;
    render();
  };

  // ---- Per-turtle pen factory ----
  const createTurtlePen = () => {
    let x = 0;
    let y = 0;
    let heading = 0;
    let penDown = true;
    let turtleVisible = true;
    let strokeColor = "#000000";
    let fillColor = "#000000";
    // Pen width lives on the turtle, not on the path, so that clear() and other
    // path resets cannot silently drop it back to the default.
    let penWidth = DEFAULT_LINE_WIDTH;
    let fontSize = DEFAULT_FONT_SIZE;
    let currentFontFamily = "Arial";
    let currentFontStyle = "normal";
    let filling = false;
    let fillPath = null;
    let currentPath = null;
    // Angle unit: internal angles are always degrees, user angles are scaled by
    // this factor (degrees() / radians()).
    let degreesPerUnit = 1;
    const undoStack = [];

    // Mutable rendering state exposed to the shared draw() function
    const pen = {
      paths: [],
      renderedX: 0,
      renderedY: 0,
      renderedHeading: 0,
      renderedTurtleVisible: true,
      shapeColor: "#000000",
      shapeFillColor: "#000000",
      shapeName: DEFAULT_SHAPE,
      stretchLen: 1,
      stretchWid: 1,
      outlineWidth: 1,
      tilt: 0,
    };

    // ---- Angle conversion (screen mode + angle unit) ----
    // Internally heading is math-convention degrees (0 = east, CCW positive).
    // Logo mode reports 0 = north with clockwise-positive headings; left()/right()
    // stay visually CCW/CW in both modes, matching CPython.
    const toUserAngle = (internal) =>
      normalizeAngle(screenMode === "logo" ? 90 - internal : internal) /
      degreesPerUnit;
    const toInternalAngle = (user) => {
      const degrees = Number(user || 0) * degreesPerUnit;
      return normalizeAngle(screenMode === "logo" ? 90 - degrees : degrees);
    };

    const pushUndo = (entry) => {
      if (undoBufferSize === 0) return;
      undoStack.push(entry);
      if (undoBufferSize > 0 && undoStack.length > undoBufferSize) {
        undoStack.shift();
      }
    };

    const makePath = (overrides = {}) => ({
      down: penDown,
      stroke: strokeColor,
      lineWidth: penWidth,
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
      pen.paths.push(currentPath);
      return currentPath;
    };

    const commitStyleToNewPath = () => {
      currentPath = makePath();
      pen.paths.push(currentPath);
      return currentPath;
    };

    const ensurePath = () => {
      if (!currentPath) {
        beginCurrentPath();
      }
      return currentPath;
    };

    const getPenState = () => ({
      pendown: penDown,
      pencolor: strokeColor,
      fillcolor: fillColor,
      pensize: penWidth,
      speed: turtleSpeed,
      shown: turtleVisible,
      stretchfactor: [pen.stretchWid, pen.stretchLen],
      outline: pen.outlineWidth,
      tilt: pen.tilt,
    });

    beginCurrentPath();

    // Shared by forward() and goto(): records the move, queues the render and
    // registers the undo entry.
    const moveTo = (nextX, nextY) => {
      const prevX = x;
      const prevY = y;
      const path = ensurePath();
      const fill = filling ? fillPath : null;
      x = nextX;
      y = nextY;
      const point = { x, y, move: !penDown };
      pushUndo(() => {
        x = prevX;
        y = prevY;
        if (path.points[path.points.length - 1] === point) path.points.pop();
        if (fill) fill.points.pop();
        pen.renderedX = prevX;
        pen.renderedY = prevY;
      });
      enqueueOperation(() => {
        pen.renderedX = point.x;
        pen.renderedY = point.y;
        path.points.push(point);
        if (fill) {
          fill.points.push({ x: point.x, y: point.y });
        }
        draw();
      });
    };

    const turnTo = (nextHeading) => {
      const prevHeading = heading;
      heading = normalizeAngle(nextHeading);
      const target = heading;
      pushUndo(() => {
        heading = prevHeading;
        pen.renderedHeading = prevHeading;
      });
      enqueueOperation(() => {
        pen.renderedHeading = target;
        draw();
      });
    };

    const forward = (distance) => {
      if (!ensureContext()) return;
      const length = toPlainNumber(distance, 0) || 0;
      moveTo(
        x + length * Math.cos(toRadians(heading)),
        y + length * Math.sin(toRadians(heading)),
      );
    };

    const backward = (distance) => forward(-toPlainNumber(distance, 0));
    const right = (angle) =>
      turnTo(heading - toPlainNumber(angle, 0) * degreesPerUnit);
    const left = (angle) =>
      turnTo(heading + toPlainNumber(angle, 0) * degreesPerUnit);
    const penup = () => {
      const previous = penDown;
      penDown = false;
      commitStyleToNewPath();
      pushUndo(() => {
        penDown = previous;
        commitStyleToNewPath();
      });
      draw();
    };
    const pendownFn = () => {
      const previous = penDown;
      penDown = true;
      commitStyleToNewPath();
      pushUndo(() => {
        penDown = previous;
        commitStyleToNewPath();
      });
      draw();
    };
    // Accepts (x, y), ((x, y)) and (Vec2D) — all valid CPython call forms.
    const toPoint = (a, b) => {
      if (b !== undefined && b !== null) {
        return [toPlainNumber(a, 0), toPlainNumber(b, 0)];
      }
      const source = toSequence(a);
      if (source && source.length >= 2) {
        return [toPlainNumber(source[0], 0), toPlainNumber(source[1], 0)];
      }
      const obj = a && typeof a === "object" ? a : null;
      if (obj && ("x" in obj || "y" in obj)) {
        return [toPlainNumber(obj.x, 0), toPlainNumber(obj.y, 0)];
      }
      return [toPlainNumber(a, 0), 0];
    };

    const goto_ = (a, b) => {
      if (!ensureContext()) return;
      const [nextX, nextY] = toPoint(a, b);
      moveTo(nextX, nextY);
    };
    const setx = (value) => goto_(toPlainNumber(value, 0), y);
    const sety = (value) => goto_(x, toPlainNumber(value, 0));
    const position = () => [x, y];
    const xcor = () => x;
    const ycor = () => y;
    const heading_ = () => toUserAngle(heading);
    const setheading = (angle) => turnTo(toInternalAngle(angle));
    const home = () => {
      goto_(0, 0);
      setheading(0);
    };
    const towards = (tx, ty) => {
      const [px, py] = toPoint(tx, ty);
      const dx = px - x;
      const dy = py - y;
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return 0;
      return toUserAngle((Math.atan2(dy, dx) * 180) / Math.PI);
    };
    const distance = (tx, ty) => {
      const [px, py] = toPoint(tx, ty);
      return Math.hypot(px - x, py - y);
    };
    const degreesFn = (fullcircle = 360) => {
      const circle = toPlainNumber(fullcircle, 360) || 360;
      degreesPerUnit = 360 / circle;
    };
    const radians = () => degreesFn(2 * Math.PI);
    const speed = (value = undefined) => {
      if (value === undefined || value === null) return turtleSpeed;
      const name =
        typeof value === "string" ? value.trim().toLowerCase() : null;
      let numeric =
        name !== null && name in SPEED_NAMES
          ? SPEED_NAMES[name]
          : toPlainNumber(value, Number.NaN);
      if (!Number.isFinite(numeric)) numeric = DEFAULT_SPEED;
      // CPython clamps anything outside 0.5..10.5 to "fastest" (0).
      if (numeric < 0.5 || numeric > 10.5) numeric = 0;
      turtleSpeed = Math.round(numeric);
      delayMs =
        turtleSpeed <= 0 ? 0 : Math.max(0, Math.round(300 / turtleSpeed));
      return turtleSpeed;
    };
    const setStroke = (value) => {
      strokeColor = value;
      pen.shapeColor = value;
    };
    const setFill = (value) => {
      fillColor = value;
      pen.shapeFillColor = value;
      if (filling && fillPath) {
        fillPath.fillstyle = value;
      }
    };

    // color() / color(both) / color(pen, fill) / color(r, g, b)
    const color = (...args) => {
      if (args.length === 0) return [strokeColor, fillColor];
      const previous = [strokeColor, fillColor];
      if (args.length === 2) {
        setStroke(toColorString(args[0]));
        setFill(toColorString(args[1]));
      } else {
        const value = colorFromArgs(args);
        setStroke(value);
        setFill(value);
      }
      commitStyleToNewPath();
      pushUndo(() => {
        setStroke(previous[0]);
        setFill(previous[1]);
        commitStyleToNewPath();
      });
      draw();
    };
    const pencolor = (...args) => {
      if (args.length === 0) return strokeColor;
      const previous = strokeColor;
      setStroke(colorFromArgs(args));
      commitStyleToNewPath();
      pushUndo(() => {
        setStroke(previous);
        commitStyleToNewPath();
      });
      draw();
    };
    const fillcolor = (...args) => {
      if (args.length === 0) return fillColor;
      const previous = fillColor;
      setFill(colorFromArgs(args));
      commitStyleToNewPath();
      pushUndo(() => {
        setFill(previous);
        commitStyleToNewPath();
      });
      draw();
    };
    const pensize = (value = undefined) => {
      if (value === undefined || value === null) return penWidth;
      const previous = penWidth;
      penWidth = Math.max(1, toPlainNumber(value, DEFAULT_LINE_WIDTH));
      commitStyleToNewPath();
      pushUndo(() => {
        penWidth = previous;
        commitStyleToNewPath();
      });
      draw();
      return penWidth;
    };
    const width = (value = undefined) => pensize(value);
    const isfilling = () => filling;
    const begin_fill = () => {
      if (filling) return;
      filling = true;
      fillPath = makePath({
        down: false,
        fill: true,
        stroke: "transparent",
        fillstyle: fillColor,
      });
      pen.paths.push(fillPath);
      // Lines drawn while filling must render on top of the fill polygon, so
      // move the stroke into a path that comes after the fill path.
      commitStyleToNewPath();
      const started = fillPath;
      pushUndo(() => {
        filling = false;
        fillPath = null;
        const index = pen.paths.indexOf(started);
        if (index >= 0) pen.paths.splice(index, 1);
      });
      draw();
    };
    const end_fill = () => {
      if (!filling) return;
      const finished = fillPath;
      filling = false;
      fillPath = null;
      commitStyleToNewPath();
      pushUndo(() => {
        filling = true;
        fillPath = finished;
      });
      draw();
    };
    const dot = (size = undefined, ...colorArgs) => {
      // CPython defaults the dot size to max(pensize + 4, pensize * 2).
      const requested = toPlainNumber(size, Number.NaN);
      const diameter = Number.isFinite(requested)
        ? Math.max(1, requested)
        : Math.max(penWidth + 4, penWidth * 2);
      const dotColor =
        colorArgs.length > 0 ? colorFromArgs(colorArgs) : strokeColor;
      const segment = makePath({
        down: false,
        fill: false,
        stroke: dotColor,
        fillstyle: dotColor,
        points: [{ x, y, dotRadius: diameter / 2, color: dotColor }],
      });
      pushUndo(() => {
        const index = pen.paths.indexOf(segment);
        if (index >= 0) pen.paths.splice(index, 1);
      });
      enqueueOperation(() => {
        pen.paths.push(segment);
        draw();
      });
    };
    // circle(radius, extent=None, steps=None) — matches CPython's signature.
    // The arc is traced to the left of the turtle for a positive radius.
    const circle = (radius, extent = undefined, steps = undefined) => {
      const numericRadius = toPlainNumber(radius, 0) || 0;
      const fullCircle = 360 / degreesPerUnit;
      const extentUnits = toPlainNumber(extent, fullCircle);
      const extentDegrees = extentUnits * degreesPerUnit;
      const requestedSteps = toPlainNumber(steps, Number.NaN);
      const stepCount = Number.isFinite(requestedSteps)
        ? Math.max(1, Math.trunc(requestedSteps))
        : // CPython scales the step count with the arc's size.
          1 +
          Math.trunc(
            Math.min(11 + Math.abs(numericRadius) / 6, 59) *
              (Math.abs(extentUnits) / fullCircle),
          );
      let stepTurn = extentDegrees / stepCount;
      let stepLength = 2 * numericRadius * Math.sin(toRadians(stepTurn / 2));
      if (numericRadius < 0) {
        stepLength = -stepLength;
        stepTurn = -stepTurn;
      }
      // Half a turn before and after inscribes the polygon on the true circle,
      // so the turtle ends up on the arc rather than inside it.
      turnTo(heading + stepTurn / 2);
      for (let index = 0; index < stepCount; index += 1) {
        forward(stepLength);
        turnTo(heading + stepTurn);
      }
      turnTo(heading - stepTurn / 2);
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
      if (isWriteKwargsObject(writeMove)) writeMove = false;
      if (isWriteKwargsObject(writeAlign)) writeAlign = "left";

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
        const metrics = measureTurtleText(
          String(writeText),
          family,
          size,
          style,
        );
        const textWidth = metrics.width || 0;
        if (normalizedAlign === "left") {
          x += textWidth;
        } else if (normalizedAlign === "center") {
          x += textWidth / 2;
        }
        // right alignment: turtle stays at its position (text ends there)
        commitStyleToNewPath();
      }
      pushUndo(() => {
        const index = pen.paths.indexOf(segment);
        if (index >= 0) pen.paths.splice(index, 1);
      });
      enqueueOperation(() => {
        pen.paths.push(segment);
        draw();
      });
    };
    const setfontsize = (value) => {
      const nextSize = toPlainNumber(value, DEFAULT_FONT_SIZE);
      fontSize = Math.max(
        1,
        Number.isFinite(nextSize) ? nextSize : DEFAULT_FONT_SIZE,
      );
      commitStyleToNewPath();
      draw();
    };
    const showturtle = () => {
      turtleVisible = true;
      enqueueOperation(() => {
        pen.renderedTurtleVisible = true;
        draw();
      });
    };
    const hideturtle = () => {
      turtleVisible = false;
      enqueueOperation(() => {
        pen.renderedTurtleVisible = false;
        draw();
      });
    };
    const isvisible = () => turtleVisible;
    const shape = (name = undefined) => {
      if (name === undefined || name === null) {
        return pen.shapeName;
      }
      const nameStr = toPlainString(name, "").toLowerCase().trim();
      if (!(nameStr in TURTLE_SHAPES)) {
        throw new Error(
          `There is no shape named ${nameStr} (available: ${Object.keys(
            TURTLE_SHAPES,
          ).join(", ")})`,
        );
      }
      pen.shapeName = nameStr;
      draw();
      return pen.shapeName;
    };
    const shapesize = (
      stretchWid = undefined,
      stretchLen = undefined,
      outline = undefined,
    ) => {
      if (
        stretchWid === undefined &&
        stretchLen === undefined &&
        outline === undefined
      ) {
        return [pen.stretchWid, pen.stretchLen, pen.outlineWidth];
      }
      const wid = toPlainNumber(stretchWid, Number.NaN);
      const len = toPlainNumber(stretchLen, Number.NaN);
      // shapesize(2) stretches both directions, as in CPython.
      if (Number.isFinite(wid)) {
        pen.stretchWid = wid;
        pen.stretchLen = Number.isFinite(len) ? len : wid;
      } else if (Number.isFinite(len)) {
        pen.stretchLen = len;
      }
      const outlineWidth = toPlainNumber(outline, Number.NaN);
      if (Number.isFinite(outlineWidth)) pen.outlineWidth = outlineWidth;
      draw();
      return [pen.stretchWid, pen.stretchLen, pen.outlineWidth];
    };
    const settiltangle = (angle) => {
      pen.tilt = toPlainNumber(angle, 0) * degreesPerUnit;
      draw();
    };
    const tilt = (angle) =>
      settiltangle(pen.tilt / degreesPerUnit + toPlainNumber(angle, 0));
    const tiltangle = (angle = undefined) => {
      if (angle === undefined || angle === null) {
        return normalizeAngle(pen.tilt) / degreesPerUnit;
      }
      settiltangle(angle);
      return normalizeAngle(pen.tilt) / degreesPerUnit;
    };
    const cursorSnapshot = () => ({
      x,
      y,
      heading,
      shapeName: pen.shapeName,
      fillColor,
      penColor: strokeColor,
      stretchLen: pen.stretchLen,
      stretchWid: pen.stretchWid,
      outline: pen.outlineWidth,
      tilt: pen.tilt,
    });
    const stamp = () => {
      stampCounter += 1;
      const segment = { stampId: stampCounter, stamp: cursorSnapshot() };
      pushUndo(() => {
        const index = pen.paths.indexOf(segment);
        if (index >= 0) pen.paths.splice(index, 1);
      });
      enqueueOperation(() => {
        pen.paths.push(segment);
        draw();
      });
      return stampCounter;
    };
    const clearstamp = (stampId) => {
      const wanted = toPlainNumber(stampId, Number.NaN);
      const index = pen.paths.findIndex((path) => path.stampId === wanted);
      if (index >= 0) pen.paths.splice(index, 1);
      draw();
    };
    const clearstamps = (n = undefined) => {
      const count = toPlainNumber(n, Number.NaN);
      let stamps = pen.paths.filter((path) => path.stampId !== undefined);
      if (Number.isFinite(count) && count !== 0) {
        // Positive n clears the first n stamps, negative n the last |n|.
        stamps = count > 0 ? stamps.slice(0, count) : stamps.slice(count);
      }
      for (const entry of stamps) {
        const index = pen.paths.indexOf(entry);
        if (index >= 0) pen.paths.splice(index, 1);
      }
      draw();
    };
    const undo = () => {
      const entry = undoStack.pop();
      if (!entry) return;
      entry();
      draw();
    };
    const undobufferentries = () => undoStack.length;
    const penFn = (options = undefined) => {
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
        setStroke(toColorString(source.pencolor));
      }
      if ("fillcolor" in source) {
        setFill(toColorString(source.fillcolor));
      }
      if ("pensize" in source) {
        penWidth = Math.max(1, toPlainNumber(source.pensize, penWidth));
      }
      if ("speed" in source) {
        speed(source.speed);
      }
      if ("shown" in source) {
        turtleVisible = !!source.shown;
        pen.renderedTurtleVisible = turtleVisible;
      }
      commitStyleToNewPath();
      draw();
      return getPenState();
    };
    // clear() only wipes the drawing — pen state (colour, width, fill) survives,
    // so it must not leave `filling` set with a discarded fill path.
    const clear = () => {
      pen.paths = [];
      currentPath = null;
      fillPath = null;
      filling = false;
      undoStack.length = 0;
      beginCurrentPath();
      draw();
    };
    const resetPen = () => {
      pen.paths = [];
      currentPath = null;
      fillPath = null;
      undoStack.length = 0;
      x = 0;
      y = 0;
      // A reset turtle reports heading 0, which is east in standard mode and
      // north in logo mode.
      heading = screenMode === "logo" ? 90 : 0;
      pen.renderedX = 0;
      pen.renderedY = 0;
      pen.renderedHeading = heading;
      penDown = true;
      turtleVisible = true;
      pen.renderedTurtleVisible = true;
      strokeColor = "#000000";
      fillColor = "#000000";
      penWidth = DEFAULT_LINE_WIDTH;
      pen.shapeColor = "#000000";
      pen.shapeFillColor = "#000000";
      pen.shapeName = DEFAULT_SHAPE;
      pen.stretchLen = 1;
      pen.stretchWid = 1;
      pen.outlineWidth = 1;
      pen.tilt = 0;
      fontSize = DEFAULT_FONT_SIZE;
      currentFontFamily = "Arial";
      currentFontStyle = "normal";
      degreesPerUnit = 1;
      filling = false;
      beginCurrentPath();
    };

    const api = {
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
      distance,
      degrees: degreesFn,
      radians,
      pendown: pendownFn,
      pd: pendownFn,
      down: pendownFn,
      penup,
      pu: penup,
      up: penup,
      pensize,
      width,
      pen: penFn,
      write,
      setfontsize,
      color,
      pencolor,
      fillcolor,
      begin_fill,
      end_fill,
      filling: isfilling,
      speed,
      showturtle,
      st: showturtle,
      hideturtle,
      ht: hideturtle,
      isvisible,
      shape,
      shapesize,
      turtlesize: shapesize,
      tilt,
      tiltangle,
      settiltangle,
      stamp,
      clearstamp,
      clearstamps,
      undo,
      undobufferentries,
      clear,
      reset: resetPen,
    };

    return { pen, api, resetPen };
  };

  // Screen-level functions
  const colormode = (mode = undefined) => {
    if (mode === undefined) return colorMode;
    const numeric = Number(mode);
    if (numeric !== 1 && numeric !== 255) {
      throw new Error("colormode must be 1.0 or 255");
    }
    colorMode = numeric;
    return colorMode;
  };
  const screensize = (
    canvwidth = undefined,
    canvheight = undefined,
    bg = undefined,
  ) => {
    if (
      canvwidth === undefined &&
      canvheight === undefined &&
      bg === undefined
    ) {
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

  const mode = (value = undefined) => {
    if (value === undefined || value === null) return screenMode;
    const next = toPlainString(value, "").toLowerCase().trim();
    if (next !== "standard" && next !== "logo") {
      throw new Error(`No mode named ${next} (available: standard, logo)`);
    }
    screenMode = next;
    // CPython resets all turtles when the mode changes.
    for (const penObj of allPenObjects) penObj.resetPen();
    draw();
    return screenMode;
  };

  const tracer = (n = undefined, delay = undefined) => {
    if (n === undefined || n === null) return tracerN;
    tracerN = Math.max(0, Math.trunc(toPlainNumber(n, 1)));
    tracerCounter = 0;
    const nextDelay = toPlainNumber(delay, Number.NaN);
    if (Number.isFinite(nextDelay)) delayMs = Math.max(0, nextDelay);
    if (tracerN !== 0) render();
    return tracerN;
  };

  const update = () => {
    tracerCounter = 0;
    render();
  };

  const delay = (ms = undefined) => {
    if (ms === undefined || ms === null) return delayMs;
    delayMs = Math.max(0, toPlainNumber(ms, delayMs));
    return delayMs;
  };

  const setundobuffer = (size) => {
    const next = toPlainNumber(size, DEFAULT_UNDO_BUFFER);
    undoBufferSize = Number.isFinite(next) ? Math.max(0, next) : 0;
  };

  const window_width = () => cssWidth || screenWidth;
  const window_height = () => cssHeight || screenHeight;

  const title = (value = undefined) => {
    if (value === undefined) return screenTitle;
    screenTitle = toPlainString(value, "");
    if (canvas) canvas.setAttribute("aria-label", screenTitle);
    return screenTitle;
  };

  // register_shape(name, polygon) — the polygon is given in CPython's screen
  // coordinates (+y = up, turtle facing east), which the renderer expects
  // rotated 90° CCW: (sx, sy) → (sy, -sx).
  const register_shape = (name, shapePoints = undefined) => {
    const shapeName = toPlainString(name, "").toLowerCase().trim();
    if (!shapeName) throw new Error("register_shape needs a name");
    const source = toSequence(shapePoints);
    if (!source) {
      throw new Error(`register_shape: no polygon given for ${shapeName}`);
    }
    TURTLE_SHAPES[shapeName] = source.map((point) => {
      const pair = toSequence(point) || [0, 0];
      const sx = toPlainNumber(pair[0], 0);
      const sy = toPlainNumber(pair[1], 0);
      return [sy, -sx];
    });
    return shapeName;
  };

  // Blocking fallbacks, used where Python cannot be suspended. Where it can,
  // execution.js replaces both with versions that read from the page without
  // freezing it — see TURTLE_INPUT_SHIM.
  const inputLabel = (promptTitle, promptText) =>
    [toPlainString(promptTitle, ""), toPlainString(promptText, "")]
      .filter(Boolean)
      .join(" ")
      .trim();

  const numinput = (promptTitle = "", promptText = "") => {
    const answer = askStdinSync(id, inputLabel(promptTitle, promptText));
    if (!answer) return null;
    const numeric = Number(answer);
    return Number.isFinite(numeric) ? numeric : null;
  };

  const textinput = (promptTitle = "", promptText = "") =>
    askStdinSync(id, inputLabel(promptTitle, promptText));

  // ---- Event handling ----
  const addListener = (target, type, handler) => {
    if (!target) return;
    target.addEventListener(type, handler);
    eventCleanups.push(() => target.removeEventListener(type, handler));
  };

  const clearListeners = () => {
    for (const cleanup of eventCleanups) {
      try {
        cleanup();
      } catch {}
    }
    eventCleanups = [];
    for (const timerId of pendingTimers) window.clearTimeout(timerId);
    pendingTimers = [];
  };

  const canvasPoint = (event) => {
    const rect = canvas?.getBoundingClientRect?.();
    if (!rect) return [0, 0];
    return [
      event.clientX - rect.left - cssWidth / 2,
      cssHeight / 2 - (event.clientY - rect.top),
    ];
  };

  const onscreenclick = (fn, btn = 1) => {
    if (!ensureContext()) return;
    if (!fn) return;
    const wanted = toPlainNumber(btn, 1) - 1;
    addListener(canvas, "mousedown", (event) => {
      if (event.button !== wanted) return;
      const [px, py] = canvasPoint(event);
      fn(px, py);
    });
  };

  const onkey = (fn, key = undefined) => {
    if (!ensureContext()) return;
    const wanted = toPlainString(key, "");
    addListener(canvas, "keyup", (event) => {
      if (wanted && event.key !== wanted && event.code !== wanted) return;
      if (fn) fn();
    });
  };

  const onkeypress = (fn, key = undefined) => {
    if (!ensureContext()) return;
    const wanted = toPlainString(key, "");
    addListener(canvas, "keydown", (event) => {
      if (wanted && event.key !== wanted && event.code !== wanted) return;
      if (fn) fn();
    });
  };

  const listen = () => {
    if (!ensureContext()) return;
    canvas.focus?.();
  };

  const ontimer = (fn, ms = 0) => {
    if (!fn) return;
    const timerId = window.setTimeout(
      () => {
        pendingTimers = pendingTimers.filter((entry) => entry !== timerId);
        fn();
      },
      Math.max(0, toPlainNumber(ms, 0)),
    );
    pendingTimers.push(timerId);
  };

  // Create the default turtle pen and register it
  const allPenObjects = [];
  const defaultPenObj = createTurtlePen();
  allPenObjects.push(defaultPenObj);
  allPens.push(defaultPenObj.pen);

  const bindCanvas = (nextCanvas) => {
    canvas = nextCanvas || getCanvas(id);
    context = canvas?.getContext?.("2d") || null;
    if (canvas) {
      canvas.tabIndex = 0;
    }
    draw();
  };

  const deactivate = () => {
    active = false;
    clearQueue();
    clearListeners();
    for (const pen of allPens) {
      pen.paths = [];
      pen.renderedTurtleVisible = false;
    }
  };

  // Runs before every execution, so every piece of screen state a program can
  // change has to be restored here — otherwise it leaks into the next run.
  const resetState = () => {
    clearQueue();
    clearListeners();
    // Remove all extra turtles, keeping only the default pen
    allPens.length = 0;
    allPens.push(defaultPenObj.pen);
    allPenObjects.length = 0;
    allPenObjects.push(defaultPenObj);
    defaultPenObj.resetPen();
    backgroundColor = "#ffffff";
    backgroundImage = null;
    colorMode = 1.0;
    screenWidth = 640;
    screenHeight = 480;
    screenMode = "standard";
    screenTitle = "";
    turtleSpeed = DEFAULT_SPEED;
    delayMs = DEFAULT_DELAY_MS;
    tracerN = 1;
    tracerCounter = 0;
    stampCounter = 0;
    undoBufferSize = DEFAULT_UNDO_BUFFER;
    active = true;
    render();
  };

  const clearscreen = () => {
    for (const penObj of allPenObjects) penObj.resetPen();
    backgroundColor = "#ffffff";
    backgroundImage = null;
    draw();
  };

  const resetscreen = () => {
    for (const penObj of allPenObjects) penObj.resetPen();
    draw();
  };

  const setup = (
    width = undefined,
    height = undefined,
    startx = undefined,
    starty = undefined,
  ) => {
    // Fractions mean "share of the available area" in CPython; the canvas is
    // already sized to its panel, so only absolute pixel sizes are meaningful.
    const w = toPlainNumber(width, Number.NaN);
    const h = toPlainNumber(height, Number.NaN);
    return screensize(
      Number.isFinite(w) && w > 1 ? w : undefined,
      Number.isFinite(h) && h > 1 ? h : undefined,
    );
  };

  // Turtle constructor — creates an additional independent turtle on the same canvas.
  // The pen is registered into allPens via enqueueOperation so it enters the render
  // loop in queue order, preventing the turtle from appearing at center before prior
  // drawing operations have completed.
  const Turtle = function () {
    const penObj = createTurtlePen();
    allPenObjects.push(penObj);
    enqueueOperation(() => {
      allPens.push(penObj.pen);
      draw();
    });
    return penObj.api;
  };

  const screenApi = {
    colormode,
    screensize,
    setup,
    bgcolor,
    bgpic,
    mode,
    tracer,
    update,
    delay,
    title,
    register_shape,
    addshape: register_shape,
    window_width,
    window_height,
    numinput,
    textinput,
    listen,
    onkey,
    onkeyrelease: onkey,
    onkeypress,
    onscreenclick,
    onclick: onscreenclick,
    ontimer,
    clearscreen,
    clear: clearscreen,
    resetscreen,
    reset: resetscreen,
    // The canvas is always on screen, so there is no event loop to enter or leave.
    mainloop: () => {},
    done: () => {},
    exitonclick: () => {},
    bye: () => {},
  };

  const api = {
    __bindCanvas: bindCanvas,
    __deactivate: deactivate,
    __redraw: render,
    __resetState: resetState,
    __setPyodide: (runtime) => {
      pyodide = runtime;
    },
    ...defaultPenObj.api,
    Turtle,
    Screen: () => screenApi,
    getscreen: () => screenApi,
    setundobuffer,
    // Screen helpers are also exposed at module level, matching `from turtle import *`.
    ...screenApi,
    // The turtle's own clear()/reset() win over the screen's at module level,
    // exactly as CPython's functional interface binds them.
    clear: defaultPenObj.api.clear,
    reset: defaultPenObj.api.reset,
    clearscreen,
    resetscreen,
  };

  return api;
};
