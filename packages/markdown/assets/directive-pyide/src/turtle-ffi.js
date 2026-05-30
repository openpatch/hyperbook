export 
  const createTurtleJsFFI = (id) => {
    const DEFAULT_LINE_WIDTH = 1;
    const DEFAULT_FONT_SIZE = 8;
    const DEFAULT_SHAPE = "classic";

    // Shape polygons in canvas-local coords (+x = forward, +y = down).
    // Derived from CPython/RPi turtle shapes by applying a 90° CCW screen rotation:
    // (sx, sy) → (sy, -sx).
    const TURTLE_SHAPES = {
      classic:  [[0, 0], [-9, 5], [-7, 0], [-9, -5]],
      arrow:    [[0, 10], [0, -10], [10, 0]],
      triangle: [[-5.77, -10], [11.55, 0], [-5.77, 10]],
      square:   [[-10, -10], [10, -10], [10, 10], [-10, 10]],
      circle:   null, // rendered as arc, not polygon
      turtle: [
        [16, 0], [14, 2], [10, 1], [7, 4], [9, 7], [8, 9],
        [5, 6], [1, 7], [-3, 5], [-6, 8], [-8, 6], [-5, 4],
        [-7, 0], [-5, -4], [-8, -6], [-6, -8], [-3, -5],
        [1, -7], [5, -6], [8, -9], [9, -7], [7, -4], [10, -1], [14, -2],
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
    let delayMs = 80;
    let turtleSpeed = 3;
    let screenWidth = 640;
    let screenHeight = 480;
    let operationQueue = [];
    let queueGeneration = 0;
    let queueRunning = false;
    const textMeasureCanvas = document.createElement("canvas");
    const textMeasureContext = textMeasureCanvas.getContext("2d");

    // Registry of all active turtle pens (rendering state objects)
    const allPens = [];

    // ---- Shared helper functions ----
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
      context.save();
      context.translate(toCanvasX(pen.renderedX), toCanvasY(pen.renderedY));
      context.rotate(-toRadians(pen.renderedHeading));
      context.fillStyle = pen.shapeColor;
      context.strokeStyle = pen.shapeColor;
      context.lineWidth = 1;
      const shapeName = pen.shapeName || DEFAULT_SHAPE;
      if (shapeName === "circle") {
        context.beginPath();
        context.arc(0, 0, 10, 0, 2 * Math.PI);
        context.fill();
        context.stroke();
      } else {
        const points = TURTLE_SHAPES[shapeName] || TURTLE_SHAPES[DEFAULT_SHAPE];
        context.beginPath();
        context.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length; i++) {
          context.lineTo(points[i][0], points[i][1]);
        }
        context.closePath();
        context.fill();
        context.stroke();
      }
      context.restore();
    };

    const draw = () => {
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

    // ---- Per-turtle pen factory ----
    const createTurtlePen = () => {
      let x = 0;
      let y = 0;
      let heading = 0;
      let penDown = true;
      let turtleVisible = true;
      let strokeColor = "#000000";
      let fillColor = "#000000";
      let fontSize = DEFAULT_FONT_SIZE;
      let currentFontFamily = "Arial";
      let currentFontStyle = "normal";
      let filling = false;
      let fillPath = null;
      let currentPath = null;

      // Mutable rendering state exposed to the shared draw() function
      const pen = {
        paths: [],
        renderedX: 0,
        renderedY: 0,
        renderedHeading: 0,
        renderedTurtleVisible: true,
        shapeColor: "#000000",
        shapeName: DEFAULT_SHAPE,
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
        pen.paths.push(currentPath);
        return currentPath;
      };

      const commitStyleToNewPath = () => {
        currentPath = makePath({
          down: penDown,
          lineWidth: currentPath?.lineWidth ?? DEFAULT_LINE_WIDTH,
        });
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
        pensize: currentPath?.lineWidth ?? DEFAULT_LINE_WIDTH,
        speed: turtleSpeed,
        shown: turtleVisible,
      });

      beginCurrentPath();

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
          pen.renderedX = point.x;
          pen.renderedY = point.y;
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
          pen.renderedHeading = nextHeading;
          draw();
        });
      };
      const left = (angle) => {
        heading = normalizeAngle(heading + Number(angle || 0));
        const nextHeading = heading;
        enqueueOperation(() => {
          pen.renderedHeading = nextHeading;
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
          pen.renderedX = point.x;
          pen.renderedY = point.y;
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
          pen.renderedHeading = nextHeading;
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
      const color = (...args) => {
        const stroke = toColorString(args[0]);
        const fill = args.length > 1 ? toColorString(args[1]) : stroke;
        strokeColor = stroke;
        fillColor = fill;
        pen.shapeColor = stroke;
        commitStyleToNewPath();
        if (filling && fillPath) {
          fillPath.fillstyle = fillColor;
        }
        draw();
      };
      const pencolor = (value) => {
        strokeColor = toColorString(value);
        pen.shapeColor = strokeColor;
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
        pen.paths.push(fillPath);
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
          pen.paths.push(segment);
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
          const metrics = measureTurtleText(String(writeText), family, size, style);
          const textWidth = metrics.width || 0;
          if (normalizedAlign === "left") {
            x += textWidth;
          } else if (normalizedAlign === "center") {
            x += textWidth / 2;
          }
          // right alignment: turtle stays at its position (text ends there)
          commitStyleToNewPath();
        }
        enqueueOperation(() => {
          pen.paths.push(segment);
          draw();
        });
      };
      const setfontsize = (value) => {
        const nextSize = toPlainNumber(value, DEFAULT_FONT_SIZE);
        fontSize = Math.max(1, Number.isFinite(nextSize) ? nextSize : DEFAULT_FONT_SIZE);
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
        const nameStr = toPlainString(name, DEFAULT_SHAPE).toLowerCase().trim();
        if (nameStr in TURTLE_SHAPES) {
          pen.shapeName = nameStr;
        }
        draw();
        return pen.shapeName;
      };
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
          pen.renderedTurtleVisible = turtleVisible;
        }
        commitStyleToNewPath();
        draw();
        return getPenState();
      };
      const clear = () => {
        pen.paths = [];
        currentPath = null;
        fillPath = null;
        beginCurrentPath();
        draw();
      };
      const resetPen = () => {
        pen.paths = [];
        currentPath = null;
        fillPath = null;
        x = 0;
        y = 0;
        heading = 0;
        pen.renderedX = 0;
        pen.renderedY = 0;
        pen.renderedHeading = 0;
        penDown = true;
        turtleVisible = true;
        pen.renderedTurtleVisible = true;
        strokeColor = "#000000";
        fillColor = "#000000";
        pen.shapeColor = "#000000";
        pen.shapeName = DEFAULT_SHAPE;
        fontSize = DEFAULT_FONT_SIZE;
        currentFontFamily = "Arial";
        currentFontStyle = "normal";
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
        speed,
        showturtle,
        st: showturtle,
        hideturtle,
        ht: hideturtle,
        isvisible,
        shape,
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

    // Create the default turtle pen and register it
    const defaultPenObj = createTurtlePen();
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
      for (const pen of allPens) {
        pen.paths = [];
        pen.renderedTurtleVisible = false;
      }
    };

    const resetState = () => {
      clearQueue();
      // Remove all extra turtles, keeping only the default pen
      allPens.length = 0;
      allPens.push(defaultPenObj.pen);
      defaultPenObj.resetPen();
      backgroundColor = "#ffffff";
      backgroundImage = null;
      colorMode = 1.0;
      screenWidth = 640;
      screenHeight = 480;
      active = true;
      draw();
    };

    // Turtle constructor — creates an additional independent turtle on the same canvas.
    // The pen is registered into allPens via enqueueOperation so it enters the render
    // loop in queue order, preventing the turtle from appearing at center before prior
    // drawing operations have completed.
    const Turtle = function () {
      const penObj = createTurtlePen();
      enqueueOperation(() => {
        allPens.push(penObj.pen);
        draw();
      });
      return penObj.api;
    };

    const api = {
      __bindCanvas: bindCanvas,
      __deactivate: deactivate,
      __redraw: draw,
      __resetState: resetState,
      __setPyodide: (runtime) => {
        pyodide = runtime;
      },
      ...defaultPenObj.api,
      Turtle,
      colormode,
      screensize,
      bgcolor,
      bgpic,
    };

    return api;
  };
