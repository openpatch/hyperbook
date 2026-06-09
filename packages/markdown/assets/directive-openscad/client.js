/// <reference path="../hyperbook.types.js" />

/**
 * OpenSCAD IDE directive.
 * @type {any}
 * @memberof hyperbook
 */
hyperbook.openscad = (function () {
  const _scriptBase = window.HYPERBOOK_ASSETS + "directive-openscad/";

  let threePromise = null;
  let workerRequestId = 0;

  // Two separate worker instances: one for rendering, one for parameter extraction.
  // This allows both to run concurrently in truly separate threads.
  const workerSlots = {
    render: { promise: null, pending: new Map() },
    param: { promise: null, pending: new Map() },
  };

  const i18nGet = (key, fallback = key) => hyperbook.i18n?.get(key) || fallback;
  const ABSOLUTE_URL_PATTERN = /^(?:[a-z]+:)?\/\//i;

  const normalizePath = (path) => {
    if (!path) return "/";
    return path.startsWith("/") ? path : `/${path}`;
  };

  const constructUrl = (path, basePath, pagePath) => {
    if (path.startsWith("/")) {
      return basePath ? `${basePath}${path}`.replace(/\/+/g, "/") : path;
    }
    return pagePath ? `${pagePath}/${path}`.replace(/\/+/g, "/") : path;
  };

  const resolveImportFsPath = (assetPath) => {
    try {
      return new URL(assetPath, "file:///tmp/model.scad").pathname || null;
    } catch (_) {
      return null;
    }
  };

  const extractImportAssetPaths = (code) => {
    const paths = new Set();
    const pattern = /import\s*\(\s*(['"])([^'"]+)\1/g;
    let match;
    while ((match = pattern.exec(code || "")) !== null) {
      const path = match[2];
      if (!path) continue;
      if (
        ABSOLUTE_URL_PATTERN.test(path) ||
        path.startsWith("data:") ||
        path.startsWith("blob:")
      ) {
        continue;
      }
      paths.add(path);
    }
    return [...paths];
  };

  const buildAutoBinaryFiles = (code, basePath, pagePath) => {
    return extractImportAssetPaths(code)
      .map((assetPath) => {
        const dest = resolveImportFsPath(assetPath);
        if (!dest) return null;
        return {
          dest,
          url: constructUrl(assetPath, basePath, pagePath),
        };
      })
      .filter(Boolean);
  };

  const mergeBinaryFiles = (baseFiles = [], autoFiles = []) => {
    const merged = new Map();
    for (const file of autoFiles) {
      if (!file?.dest || !file?.url) continue;
      merged.set(file.dest, file);
    }
    for (const file of baseFiles) {
      if (!file?.dest || !file?.url) continue;
      merged.set(file.dest, file);
    }
    return [...merged.values()];
  };

  const getWorker = async (slot) => {
    if (!window.Worker) {
      throw new Error(i18nGet("openscad-render-failed", "OpenSCAD render failed"));
    }
    const s = workerSlots[slot];
    if (!s.promise) {
      s.promise = new Promise((resolve, reject) => {
        try {
          const worker = new Worker(new URL(_scriptBase + "worker.js", window.location.href), {
            type: "module",
          });

          worker.addEventListener("message", (event) => {
            const { requestId, ok, result, error } = event.data || {};
            if (!requestId || !s.pending.has(requestId)) return;
            const pending = s.pending.get(requestId);
            s.pending.delete(requestId);
            if (ok) {
              pending.resolve(result);
              return;
            }
            const workerError = new Error(error?.message || "OpenSCAD worker request failed");
            if (Array.isArray(error?.stderr)) {
              workerError.stderr = error.stderr;
            }
            pending.reject(workerError);
          });

          worker.addEventListener("error", (event) => {
            const workerError = new Error(event?.message || "OpenSCAD worker crashed");
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

  const callWorker = async (slot, type, payload, transfer = []) => {
    const worker = await getWorker(slot);
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

  const getInvocationStderr = (invocationResult) =>
    (invocationResult?.mergedOutputs || [])
      .filter((entry) => typeof entry?.stderr === "string")
      .map((entry) => entry.stderr);

  // Build parameter UI metadata/markup in the worker to minimize main-thread work.
  const buildParamUiInWorker = async (
    code,
    libraryNames = [],
    binaryFiles = [],
    currentOverrides = {},
    id = "",
  ) => {
    try {
      const result = await callWorker("param", "buildParamForm", {
        code,
        libraryNames,
        binaryFiles,
        currentOverrides,
        id,
      });
      return {
        hasParams: Boolean(result?.hasParams),
        html: typeof result?.html === "string" ? result.html : "",
        values: result?.values && typeof result.values === "object" ? result.values : {},
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

  const getThree = async () => {
    if (!threePromise) {
      threePromise = Promise.all([
        import(/* @vite-ignore */ _scriptBase + "three.module.js"),
        import(/* @vite-ignore */ _scriptBase + "OrbitControls.js"),
      ]).then(([THREE, OrbitControlsModule]) => ({
        THREE,
        OrbitControls: OrbitControlsModule.OrbitControls,
      }));
    }
    return threePromise;
  };

  const formatValue = (value) => {
    if (typeof value === "string") return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    if (Array.isArray(value)) return `[${value.map(formatValue).join(",")}]`;
    if (typeof value === "boolean" || typeof value === "number") return `${value}`;
    throw new Error("Only numbers, booleans, strings and arrays are supported in parameters");
  };

  function setupCanvasParamsSplitter(leftSide, previewContainer, paramsPanel, splitter, onSplitChanged) {
    if (!leftSide || !previewContainer || !paramsPanel || !splitter) return;

    const minSize = 80;

    const applySplitSize = (rawSize) => {
      const total = leftSide.clientHeight;
      const splitterSize = splitter.offsetHeight;
      const maxSize = Math.max(minSize, total - splitterSize - minSize);
      const clamped = Math.max(minSize, Math.min(rawSize, maxSize));
      previewContainer.style.flex = `0 0 ${clamped}px`;
      return clamped;
    };

    const applyStoredSplitSize = () => {
      const rawStored = Number(leftSide.dataset.splitCanvasParams);
      if (!Number.isFinite(rawStored) || rawStored <= 0) {
        previewContainer.style.flex = "";
        return;
      }
      applySplitSize(rawStored);
    };

    applyStoredSplitSize();

    splitter.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      splitter.setPointerCapture(event.pointerId);

      const startPointer = event.clientY;
      const startSize = previewContainer.getBoundingClientRect().height;

      const onPointerMove = (moveEvent) => {
        const delta = moveEvent.clientY - startPointer;
        const size = applySplitSize(startSize + delta);
        leftSide.dataset.splitCanvasParams = String(Math.round(size));
        onSplitChanged?.({ splitCanvasParams: Math.round(size) });
      };

      const onPointerUp = () => {
        splitter.removeEventListener("pointermove", onPointerMove);
        splitter.removeEventListener("pointerup", onPointerUp);
        splitter.removeEventListener("pointercancel", onPointerUp);
        const splitCanvasParams = Number(leftSide.dataset.splitCanvasParams);
        if (Number.isFinite(splitCanvasParams) && splitCanvasParams > 0) {
          onSplitChanged?.({ splitCanvasParams: Math.round(splitCanvasParams) });
        }
      };

      splitter.addEventListener("pointermove", onPointerMove);
      splitter.addEventListener("pointerup", onPointerUp);
      splitter.addEventListener("pointercancel", onPointerUp);
    });

    window.addEventListener("resize", applyStoredSplitSize);
    return applyStoredSplitSize;
  }

  function setupSplitter(elem, leftSide, editorContainer, splitter, onSplitChanged) {
    if (!leftSide || !editorContainer || !splitter) return;

    const previewContainer = leftSide;

    const minPanelSize = 120;

    const getIsHorizontal = () =>
      getComputedStyle(elem).flexDirection.startsWith("row");

    const applySplitSize = (rawSize, isHorizontal) => {
      const total = isHorizontal ? elem.clientWidth : elem.clientHeight;
      const splitterSize = isHorizontal ? splitter.offsetWidth : splitter.offsetHeight;
      const maxSize = Math.max(minPanelSize, total - splitterSize - minPanelSize);
      const clamped = Math.max(minPanelSize, Math.min(rawSize, maxSize));
      previewContainer.style.flex = `0 0 ${clamped}px`;
      return clamped;
    };

    const applyStoredSplitSize = () => {
      const isHorizontal = getIsHorizontal();
      elem.classList.toggle("split-horizontal", isHorizontal);
      elem.classList.toggle("split-vertical", !isHorizontal);
      const key = isHorizontal ? "splitHorizontal" : "splitVertical";
      const rawStored = Number(elem.dataset[key]);
      if (!Number.isFinite(rawStored) || rawStored <= 0) {
        previewContainer.style.flex = "";
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
        ? previewContainer.getBoundingClientRect().width
        : previewContainer.getBoundingClientRect().height;

      elem.classList.add("resizing");

      const onPointerMove = (moveEvent) => {
        const pointer = isHorizontal ? moveEvent.clientX : moveEvent.clientY;
        const delta = pointer - startPointer;
        const size = applySplitSize(startSize + delta, isHorizontal);
        elem.dataset[key] = String(Math.round(size));
        onSplitChanged?.({
          [key]: Math.round(size),
        });
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
  }

  const updateFullscreenButtonState = (elem, button) => {
    if (!elem || !button) return;
    const isFullscreen = document.fullscreenElement === elem;
    const label = i18nGet("ide-fullscreen-enter", "Fullscreen");
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
    const elems = document.querySelectorAll(".directive-openscad");
    elems.forEach((elem) => {
      const fullscreen = elem.querySelector("button.fullscreen");
      updateFullscreenButtonState(elem, fullscreen);
    });
  };

  const toUint8Array = (data) => {
    if (data instanceof Uint8Array) return data;
    if (typeof data === "string") return new TextEncoder().encode(data);
    return new Uint8Array(data || []);
  };

  const textEncoder = new TextEncoder();
  const DEFAULT_FACE_COLOR = [0xf9 / 255, 0xd7 / 255, 0x2c / 255, 1];
  const PAINT_COLOR_MAP = ["", "8", "0C", "1C", "2C", "3C", "4C", "5C", "6C", "7C", "8C", "9C", "AC", "BC", "CC", "DC"];
  const CRC32_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c >>> 0;
    }
    return table;
  })();

  const crc32 = (bytes) => {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };

  const concatUint8Arrays = (chunks) => {
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  };

  const createZip = (files) => {
    const localChunks = [];
    const centralChunks = [];
    let offset = 0;

    for (const [name, dataLike] of Object.entries(files)) {
      const nameBytes = textEncoder.encode(name);
      const data = toUint8Array(dataLike);
      const crc = crc32(data);
      const localHeader = new Uint8Array(30 + nameBytes.length);
      const localView = new DataView(localHeader.buffer);
      localView.setUint32(0, 0x04034b50, true);
      localView.setUint16(4, 20, true);
      localView.setUint16(6, 0, true);
      localView.setUint16(8, 0, true);
      localView.setUint16(10, 0, true);
      localView.setUint16(12, 0, true);
      localView.setUint32(14, crc, true);
      localView.setUint32(18, data.length, true);
      localView.setUint32(22, data.length, true);
      localView.setUint16(26, nameBytes.length, true);
      localView.setUint16(28, 0, true);
      localHeader.set(nameBytes, 30);
      localChunks.push(localHeader, data);

      const centralHeader = new Uint8Array(46 + nameBytes.length);
      const centralView = new DataView(centralHeader.buffer);
      centralView.setUint32(0, 0x02014b50, true);
      centralView.setUint16(4, 20, true);
      centralView.setUint16(6, 20, true);
      centralView.setUint16(8, 0, true);
      centralView.setUint16(10, 0, true);
      centralView.setUint16(12, 0, true);
      centralView.setUint16(14, 0, true);
      centralView.setUint32(16, crc, true);
      centralView.setUint32(20, data.length, true);
      centralView.setUint32(24, data.length, true);
      centralView.setUint16(28, nameBytes.length, true);
      centralView.setUint16(30, 0, true);
      centralView.setUint16(32, 0, true);
      centralView.setUint16(34, 0, true);
      centralView.setUint16(36, 0, true);
      centralView.setUint32(38, 0, true);
      centralView.setUint32(42, offset, true);
      centralHeader.set(nameBytes, 46);
      centralChunks.push(centralHeader);

      offset += localHeader.length + data.length;
    }

    const centralDirectory = concatUint8Arrays(centralChunks);
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true);
    eocdView.setUint16(4, 0, true);
    eocdView.setUint16(6, 0, true);
    eocdView.setUint16(8, centralChunks.length, true);
    eocdView.setUint16(10, centralChunks.length, true);
    eocdView.setUint32(12, centralDirectory.length, true);
    eocdView.setUint32(16, offset, true);
    eocdView.setUint16(20, 0, true);

    return concatUint8Arrays([...localChunks, centralDirectory, eocd]);
  };

  const toHexByte = (value) => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, "0").toUpperCase();

  const colorToDisplayColor = ([r, g, b, a = 1]) => {
    const base = `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
    return a < 1 ? `${base}${toHexByte(a)}` : base;
  };

  const createUuid = () =>
    (globalThis.crypto?.randomUUID?.() ||
      `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 10)}`);

  const parseOffToIndexedPolyhedron = (offData) => {
    const arrayBuffer = offData.buffer.slice(
      offData.byteOffset,
      offData.byteOffset + offData.byteLength,
    );
    const text = new TextDecoder().decode(arrayBuffer);
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));

    if (lines.length === 0) {
      throw new Error(i18nGet("openscad-render-failed", "OpenSCAD render failed"));
    }

    let countsLine = "";
    let currentLine = 0;
    if (/^OFF(\s|$)/.test(lines[0])) {
      countsLine = lines[0].substring(3).trim();
      currentLine = 1;
    } else if (lines[0] === "OFF" && lines.length > 1) {
      countsLine = lines[1];
      currentLine = 2;
    } else {
      throw new Error(i18nGet("openscad-render-failed", "OpenSCAD render failed"));
    }

    const [vertexCountRaw, faceCountRaw] = countsLine.split(/\s+/).map(Number);
    const vertexCount = Number.isFinite(vertexCountRaw) ? Math.floor(vertexCountRaw) : NaN;
    const faceCount = Number.isFinite(faceCountRaw) ? Math.floor(faceCountRaw) : NaN;
    if (!Number.isFinite(vertexCount) || !Number.isFinite(faceCount) || vertexCount <= 0 || faceCount <= 0) {
      throw new Error(i18nGet("openscad-render-failed", "OpenSCAD render failed"));
    }
    if (currentLine + vertexCount + faceCount > lines.length) {
      throw new Error(i18nGet("openscad-render-failed", "OpenSCAD render failed"));
    }

    const vertices = [];
    for (let i = 0; i < vertexCount; i++) {
      const parts = lines[currentLine + i].split(/\s+/).map(Number);
      if (parts.length < 3 || parts.some(Number.isNaN)) {
        throw new Error(i18nGet("openscad-render-failed", "OpenSCAD render failed"));
      }
      vertices.push({ x: parts[0], y: parts[1], z: parts[2] });
    }
    currentLine += vertexCount;

    const colors = [];
    const colorMap = new Map();
    const faces = [];

    for (let i = 0; i < faceCount; i++) {
      const parts = lines[currentLine + i].split(/\s+/).map(Number);
      const numVerts = Number.isFinite(parts[0]) ? Math.floor(parts[0]) : 0;
      const faceVertices = parts.slice(1, numVerts + 1).map((index) => Math.floor(index));
      if (faceVertices.length < 3) {
        throw new Error(i18nGet("openscad-render-failed", "OpenSCAD render failed"));
      }

      let color = DEFAULT_FACE_COLOR;
      if (parts.length >= numVerts + 4) {
        const raw = parts.slice(numVerts + 1, numVerts + 5).filter(Number.isFinite);
        if (raw.length >= 3) {
          const r = raw[0];
          const g = raw[1];
          const b = raw[2];
          const a = raw.length >= 4 ? raw[3] : (Math.max(r, g, b) > 1 ? 255 : 1);
          const divisor = Math.max(r, g, b, a) > 1 ? 255 : 1;
          color = [r / divisor, g / divisor, b / divisor, a / divisor];
        }
      }

      const colorKey = color.join(",");
      let colorIndex = colorMap.get(colorKey);
      if (colorIndex == null) {
        colorIndex = colors.length;
        colors.push(color);
        colorMap.set(colorKey, colorIndex);
      }

      if (faceVertices.length === 3) {
        faces.push({ vertices: faceVertices, colorIndex });
      } else {
        for (let j = 1; j < faceVertices.length - 1; j++) {
          faces.push({
            vertices: [faceVertices[0], faceVertices[j], faceVertices[j + 1]],
            colorIndex,
          });
        }
      }
    }

    return { vertices, faces, colors };
  };

  const buildThreeModelFromIndexedPolyhedron = (polyhedron, THREE) => {
    const model = new THREE.Group();
    const facesByColor = new Map();

    for (const face of polyhedron.faces) {
      const [i1, i2, i3] = face.vertices;
      const v1 = polyhedron.vertices[i1];
      const v2 = polyhedron.vertices[i2];
      const v3 = polyhedron.vertices[i3];
      if (!v1 || !v2 || !v3) continue;
      const color = polyhedron.colors[face.colorIndex] || DEFAULT_FACE_COLOR;
      const colorKey = color.join(",");
      let bucket = facesByColor.get(colorKey);
      if (!bucket) {
        bucket = { color, positions: [] };
        facesByColor.set(colorKey, bucket);
      }
      bucket.positions.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z);
    }

    if (facesByColor.size === 0) {
      throw new Error(i18nGet("openscad-render-failed", "OpenSCAD render failed"));
    }

    for (const bucket of facesByColor.values()) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(bucket.positions, 3));
      geometry.computeBoundingBox();
      geometry.computeVertexNormals();
      const [r, g, b, a = 1] = bucket.color;
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(r, g, b),
        transparent: a < 1,
        opacity: a,
        metalness: 0.1,
        roughness: 0.6,
      });
      model.add(new THREE.Mesh(geometry, material));
    }

    return model;
  };

  // Build a Three.js Group from pre-parsed colour buckets returned by the render worker.
  // The Float32Array buffers are already computed off the main thread — no text parsing needed.
  const buildThreeModelFromColorBuckets = (colorBuckets, THREE) => {
    const model = new THREE.Group();
    for (const bucket of colorBuckets) {
      const posArray = bucket.positions instanceof Float32Array
        ? bucket.positions : new Float32Array(bucket.positions || []);
      const normArray = bucket.normals instanceof Float32Array
        ? bucket.normals : new Float32Array(bucket.normals || []);
      if (posArray.length === 0) continue;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(posArray, 3));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normArray, 3));
      const [r, g, b, a = 1] = bucket.color || DEFAULT_FACE_COLOR;
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(r, g, b),
        transparent: a < 1,
        opacity: a,
        metalness: 0.1,
        roughness: 0.6,
      });
      model.add(new THREE.Mesh(geometry, material));
    }
    if (model.children.length === 0) {
      throw new Error(i18nGet("openscad-render-failed", "OpenSCAD render failed"));
    }
    return model;
  };

  const exportIndexedPolyhedronTo3mf = (polyhedron) => {
    const objectUuid = createUuid();
    const buildUuid = createUuid();
    const extruderIndexByColorIndex = polyhedron.colors.map((_, idx) => idx % PAINT_COLOR_MAP.length);

    const modelXml = [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06">',
      '<meta name="BambuStudio:3mfVersion" value="1"/>',
      '<meta name="slic3rpe:Version3mf" value="1"/>',
      '<meta name="slic3rpe:MmPaintingVersion" value="1"/>',
      "<resources>",
      '<basematerials id="2">',
      ...polyhedron.colors.map((color, i) => `<base name="color_${i}" displaycolor="${colorToDisplayColor(color)}"/>`),
      "</basematerials>",
      `<object id="1" name="OpenSCAD Model" type="model" p:UUID="${objectUuid}" pid="2" pindex="0">`,
      "<mesh>",
      "<vertices>",
      ...polyhedron.vertices.map((vertex) => `<vertex x="${vertex.x}" y="${vertex.y}" z="${vertex.z}" />`),
      "</vertices>",
      "<triangles>",
      ...polyhedron.faces.map((face) => {
        const [v1, v2, v3] = face.vertices;
        const attrs = [`v1="${v1}"`, `v2="${v2}"`, `v3="${v3}"`];
        if (face.colorIndex > 0) {
          attrs.push(`pid="2"`, `p1="${face.colorIndex}"`);
        }
        const paintColor = PAINT_COLOR_MAP[extruderIndexByColorIndex[face.colorIndex]];
        if (paintColor) {
          attrs.push(`paint_color="${paintColor}"`);
        }
        return `<triangle ${attrs.join(" ")} />`;
      }),
      "</triangles>",
      "</mesh>",
      "</object>",
      "</resources>",
      `<build p:UUID="${buildUuid}">`,
      `<item objectid="1" p:UUID="${objectUuid}"/>`,
      "</build>",
      "</model>",
    ].join("\n");

    const contentTypesXml = [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
      '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>',
      "</Types>",
    ].join("\n");

    const relationshipsXml = [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      '<Relationship Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" Target="/3D/3dmodel.model" Id="rel0"/>',
      "</Relationships>",
    ].join("\n");

    return createZip({
      "3D/3dmodel.model": textEncoder.encode(modelXml),
      "[Content_Types].xml": textEncoder.encode(contentTypesXml),
      "_rels/.rels": textEncoder.encode(relationshipsXml),
    });
  };

  function initElement(elem) {
    if (elem.getAttribute("data-openscad-initialized") === "true") return;
    elem.setAttribute("data-openscad-initialized", "true");

    const id = elem.getAttribute("data-id");
    const libraryNames = (elem.getAttribute("data-library") || "")
      .split(",").map(s => s.trim()).filter(Boolean);
    const binaryFilesData = elem.getAttribute("data-binary-files");
    const basePath = normalizePath(elem.getAttribute("data-base-path") || "/");
    const pagePath = normalizePath(elem.getAttribute("data-page-path") || "");
    const decodeBase64 = (str) => {
      const binaryStr = atob(str);
      const bytes = Uint8Array.from(binaryStr, (c) => c.charCodeAt(0));
      return new TextDecoder("utf-8").decode(bytes);
    };
    const initialBinaryFiles = binaryFilesData ? JSON.parse(decodeBase64(binaryFilesData)) : [];
    let userBinaryFiles = Array.isArray(initialBinaryFiles) ? [...initialBinaryFiles] : [];

    const previewContainer = elem.querySelector(".preview-container");
    const leftSide = elem.querySelector(".left-side");
    const canvasWrapper = elem.querySelector(".canvas-wrapper");
    const canvasOverlay = elem.querySelector(".canvas-overlay");
    const editorContainer = elem.querySelector(".editor-container");
    const splitter = elem.querySelector(".splitter");
    const canvasParamsSplitter = elem.querySelector(".canvas-params-splitter");
    const canvas = elem.querySelector(".preview-canvas");
    const editorDiv = elem.querySelector(".editor");
    const params = elem.querySelector("textarea.parameters");

    // `cm` will be initialized after scheduleSave/scheduleParamBuild are defined.
    let cm = null;

    // The parameters panel is its own card below the canvas.
    const paramsPanel = elem.querySelector(".parameters-panel");
    const paramsForm = paramsPanel?.querySelector(".parameters-body") ?? paramsPanel;

    const renderBtn = elem.querySelector("button.render");
    const copyBtn = elem.querySelector("button.copy");
    const downloadBtn = elem.querySelector("button.download-stl");
    const resetBtn = elem.querySelector("button.reset");
    const fullscreenBtn = elem.querySelector("button.fullscreen");
    const addBinaryFileBtn = elem.querySelector("button.add-binary-file");
    const binaryFilesList = elem.querySelector(".binary-files-list");
    const bottomButtons = elem.querySelector(".buttons.bottom");
    let downloadFormatSelect = bottomButtons?.querySelector("select.download-format");
    if (!downloadFormatSelect && bottomButtons && downloadBtn) {
      downloadFormatSelect = document.createElement("select");
      downloadFormatSelect.className = "download-format";
      downloadFormatSelect.setAttribute("aria-label", i18nGet("openscad-download-format", "Download format"));
      const stlOption = document.createElement("option");
      stlOption.value = "stl";
      stlOption.textContent = "STL";
      const threeMfOption = document.createElement("option");
      threeMfOption.value = "3mf";
      threeMfOption.textContent = "3MF";
      downloadFormatSelect.append(stlOption, threeMfOption);
      bottomButtons.insertBefore(downloadFormatSelect, downloadBtn);
    }
    if (downloadBtn) {
      downloadBtn.textContent = i18nGet("openscad-download", "Download");
    }

    const normalizeBinaryDest = (dest) => {
      if (typeof dest !== "string") return null;
      const trimmed = dest.trim();
      if (!trimmed) return null;
      return normalizePath(trimmed).replace(/\/+/g, "/");
    };

    const updateBinaryFilesList = () => {
      if (!binaryFilesList) return;
      binaryFilesList.innerHTML = "";

      if (userBinaryFiles.length === 0) {
        const emptyMsg = document.createElement("div");
        emptyMsg.className = "binary-files-empty";
        emptyMsg.textContent = i18nGet("openscad-no-binary-files", "No binary files");
        binaryFilesList.appendChild(emptyMsg);
        return;
      }

      userBinaryFiles.forEach((file) => {
        const item = document.createElement("div");
        item.className = "binary-file-item";

        const icon = document.createElement("span");
        icon.className = "binary-file-icon";
        icon.textContent = "📎";
        item.appendChild(icon);

        const name = document.createElement("span");
        name.className = "binary-file-name";
        name.textContent = file.dest;
        item.appendChild(name);

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "binary-file-delete";
        deleteBtn.textContent = "×";
        deleteBtn.title = i18nGet("typst-delete-file", "Delete file");
        deleteBtn.addEventListener("click", () => {
          const confirmMsg = `${i18nGet("typst-delete-confirm", "Delete")} ${file.dest}?`;
          if (!window.confirm(confirmMsg)) return;
          userBinaryFiles = userBinaryFiles.filter((f) => f.dest !== file.dest);
          updateBinaryFilesList();
          scheduleSave();
          void renderPreview();
        });
        item.appendChild(deleteBtn);

        binaryFilesList.appendChild(item);
      });
    };

    const handleAddBinaryFile = (event) => {
      event.preventDefault();
      event.stopPropagation();

      const input = document.createElement("input");
      input.type = "file";
      input.accept = "*/*";

      input.addEventListener("change", (changeEvent) => {
        const file = changeEvent.target.files?.[0];
        if (!file) return;

        const dest = normalizeBinaryDest(`/${file.name}`);
        if (!dest) return;

        if (userBinaryFiles.some((f) => f.dest === dest)) {
          if (!window.confirm(i18nGet("openscad-file-replace", `Replace existing ${dest}?`))) {
            return;
          }
          userBinaryFiles = userBinaryFiles.filter((f) => f.dest !== dest);
        }

        const reader = new FileReader();
        reader.onload = (loadEvent) => {
          const url = loadEvent.target?.result;
          if (typeof url !== "string") return;
          userBinaryFiles.push({ dest, url });
          updateBinaryFilesList();
          scheduleSave();
          void renderPreview();
        };
        reader.readAsDataURL(file);
      });

      input.click();
    };

    addBinaryFileBtn?.addEventListener("click", handleAddBinaryFile);
    updateBinaryFilesList();

    // --- Canvas overlay ---
    let overlayDismissTimer = null;

    const hideOverlay = () => {
      clearTimeout(overlayDismissTimer);
      if (canvasOverlay) {
        canvasOverlay.className = "canvas-overlay hidden";
        canvasOverlay.innerHTML = "";
      }
    };

    const showOverlay = (type, message) => {
      clearTimeout(overlayDismissTimer);
      if (!canvasOverlay) return;
      canvasOverlay.innerHTML = "";
      canvasOverlay.className = `canvas-overlay ${type}`;

      if (type === "loading") {
        const spinner = document.createElement("div");
        spinner.className = "canvas-spinner";
        const label = document.createElement("span");
        label.className = "overlay-message";
        label.textContent = message;
        canvasOverlay.appendChild(spinner);
        canvasOverlay.appendChild(label);
      } else {
        const msg = document.createElement("div");
        msg.className = "overlay-message";
        msg.textContent = message;
        const btn = document.createElement("button");
        btn.className = "overlay-dismiss";
        btn.textContent = "✕";
        btn.addEventListener("click", hideOverlay);
        canvasOverlay.appendChild(msg);
        canvasOverlay.appendChild(btn);
      }
    };

    const viewerState = {
      renderer: null,
      camera: null,
      scene: null,
      controls: null,
      model: null,
      renderRaf: 0,
      resizeRaf: 0,
      disposed: false,
      resizeObserver: null,
    };

    const requestRender = () => {
      if (viewerState.renderRaf || viewerState.disposed) return;
      viewerState.renderRaf = requestAnimationFrame(() => {
        viewerState.renderRaf = 0;
        if (viewerState.disposed) return;
        if (viewerState.controls) viewerState.controls.update();
        if (viewerState.renderer && viewerState.scene && viewerState.camera) {
          viewerState.renderer.render(viewerState.scene, viewerState.camera);
        }
      });
    };

    // Resize the Three.js renderer to match the current canvas-wrapper size.
    const resizeCanvas = () => {
      if (!viewerState.renderer || !viewerState.camera || !canvasWrapper) return;
      const w = Math.max(1, Math.floor(canvasWrapper.clientWidth));
      const h = Math.max(1, Math.floor(canvasWrapper.clientHeight));
      viewerState.renderer.setSize(w, h, false);
      viewerState.camera.aspect = w / h;
      viewerState.camera.updateProjectionMatrix();
      requestRender();
    };

    const scheduleResizeCanvas = () => {
      if (viewerState.resizeRaf || viewerState.disposed) return;
      viewerState.resizeRaf = requestAnimationFrame(() => {
        viewerState.resizeRaf = 0;
        resizeCanvas();
      });
    };

    const applyMainSplitSize = setupSplitter(elem, leftSide, editorContainer, splitter, () => {
      scheduleResizeCanvas();
      scheduleSave();
    });
    const applyCanvasParamsSplitSize = setupCanvasParamsSplitter(leftSide, previewContainer, paramsPanel, canvasParamsSplitter, () => {
      scheduleResizeCanvas();
      scheduleSave();
    });

    const save = async () => {
      if (!id) return;
      const splitHorizontal = Number(elem.dataset.splitHorizontal);
      const splitVertical = Number(elem.dataset.splitVertical);
      const splitCanvasParams = Number(leftSide?.dataset.splitCanvasParams);
      await hyperbook.store.db.openscad.put({
        id,
        code: cm?.getValue() || "",
        params: params?.value || "{}",
        binaryFiles: userBinaryFiles,
        ...(Number.isFinite(splitHorizontal) && splitHorizontal > 0
          ? { splitHorizontal: Math.round(splitHorizontal) }
          : {}),
        ...(Number.isFinite(splitVertical) && splitVertical > 0
          ? { splitVertical: Math.round(splitVertical) }
          : {}),
        ...(Number.isFinite(splitCanvasParams) && splitCanvasParams > 0
          ? { splitCanvasParams: Math.round(splitCanvasParams) }
          : {}),
      });
    };

    const load = async () => {
      if (!id) return null;
      const result = await hyperbook.store.db.openscad.get(id);
      if (!result) return null;
      if (cm && typeof result.code === "string") {
        cm.setValue(result.code);
      }
      if (params && typeof result.params === "string") {
        params.value = result.params;
      }
      if (Array.isArray(result.binaryFiles)) {
        userBinaryFiles = result.binaryFiles
          .map((file) => ({
            dest: normalizeBinaryDest(file?.dest),
            url: typeof file?.url === "string" ? file.url : "",
          }))
          .filter((file) => file.dest && file.url);
        updateBinaryFilesList();
      }
      if (Number.isFinite(result.splitHorizontal) && result.splitHorizontal > 0) {
        elem.dataset.splitHorizontal = String(Math.round(result.splitHorizontal));
      }
      if (Number.isFinite(result.splitVertical) && result.splitVertical > 0) {
        elem.dataset.splitVertical = String(Math.round(result.splitVertical));
      }
      if (leftSide && Number.isFinite(result.splitCanvasParams) && result.splitCanvasParams > 0) {
        leftSide.dataset.splitCanvasParams = String(Math.round(result.splitCanvasParams));
      }
      return result;
    };

    const SAVE_DEBOUNCE_MS = 250;
    const PARAM_REBUILD_DEBOUNCE_MS = 900;
    const PARAM_RENDER_DEBOUNCE_MS = 600;
    let saveTimer = 0;
    let paramRebuildTimer = 0;
    let paramRenderTimer = 0;
    let pendingParamCode = null;
    let lastBuiltParamCode = null;
    let paramBuildInFlight = false;
    let latestParamBuildToken = 0;
    // Suppresses scheduleParamBuild when code is updated programmatically from a param change.
    let suppressParamBuild = false;

    const scheduleSave = () => {
      clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        const runSave = () => { void save(); };
        if (typeof window.requestIdleCallback === "function") {
          window.requestIdleCallback(runSave, { timeout: 500 });
        } else {
          runSave();
        }
      }, SAVE_DEBOUNCE_MS);
    };

    let paramValues = {};

    // Surgically replaces the value of a top-level variable assignment in SCAD source,
    // preserving any trailing inline comment (e.g. // [min:max] annotations).
    const updateVariableInCode = (code, name, value) => {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(
        `^([ \\t]*${escaped}[ \\t]*=[ \\t]*)([^;\\n]*)(;[^\\n]*)$`,
        "m",
      );
      try {
        return code.replace(pattern, `$1${formatValue(value)}$3`);
      } catch (_) {
        return code;
      }
    };

    const syncParamsTextareaFromState = () => {
      if (params) {
        params.value = JSON.stringify(paramValues);
      }
    };

    const handleParamFieldEvent = (event) => {
      const target = event?.target;
      const name = target?.dataset?.paramName;
      const kind = target?.dataset?.paramKind;
      if (!name || !kind) return;

      if (kind === "boolean") {
        paramValues[name] = Boolean(target.checked);
      } else if (kind === "number") {
        paramValues[name] = Number(target.value);
      } else if (kind === "vector") {
        const vectorContainer = target.closest(".param-vector");
        if (!vectorContainer) return;
        const vectorInputs = Array.from(
          vectorContainer.querySelectorAll('input[data-param-kind="vector"]'),
        ).filter((input) => input.dataset.paramName === name);
        paramValues[name] = vectorInputs.map((input) => Number(input.value));
      } else if (kind === "option") {
        const selected = target.options?.[target.selectedIndex];
        const raw = selected?.dataset?.paramOptionValue;
        if (typeof raw === "string") {
          try {
            paramValues[name] = JSON.parse(raw);
          } catch (_) {
            paramValues[name] = target.value;
          }
        } else {
          paramValues[name] = target.value;
        }
      } else {
        paramValues[name] = target.value;
      }

      syncParamsTextareaFromState();

      // Reflect the new value back into the editor source code.
      const currentCode = cm?.getValue() || "";
      const updatedCode = updateVariableInCode(currentCode, name, paramValues[name]);
      if (updatedCode !== currentCode) {
        suppressParamBuild = true;
        cm?.setValue(updatedCode);
        suppressParamBuild = false;
      }

      scheduleParamRender();
      scheduleSave();
    };

    paramsForm?.addEventListener("input", handleParamFieldEvent);
    paramsForm?.addEventListener("change", handleParamFieldEvent);

    // Rebuild the parameters form from the code's top-level variable assignments.
    // Stored overrides from the textarea are preserved so user edits survive
    // code changes that don't touch those variable names.
    const buildParamForm = async (code, buildToken) => {
      // Show a loading indicator while WASM extracts params and builds UI model.
      paramsForm.innerHTML = "";
      const loading = document.createElement("p");
      loading.className = "params-empty";
      loading.textContent = i18nGet("openscad-params-loading", "Loading parameters...");
      paramsForm.appendChild(loading);

      // Code is the source of truth — param changes are always synced back to the
      // code, so we never need stored overrides to win over the code's own values.
      const resolvedBinaryFiles = mergeBinaryFiles(
        userBinaryFiles,
        buildAutoBinaryFiles(code, basePath, pagePath),
      );
      const result = await buildParamUiInWorker(
        code,
        libraryNames,
        resolvedBinaryFiles,
        {},
        id || "model",
      );
      if (buildToken !== latestParamBuildToken) {
        return false;
      }
      if (!result.hasParams) {
        paramsForm.innerHTML = "";
        const empty = document.createElement("p");
        empty.className = "params-empty";
        empty.textContent = i18nGet("openscad-params-none", "No parameters");
        paramsForm.appendChild(empty);
        paramValues = {};
        if (params) params.value = "{}";
        return true;
      }

      // Preserve accordion open/closed state by group name before replacing HTML.
      const accordionStates = new Map();
      paramsForm.querySelectorAll("details.param-group").forEach((details) => {
        const summary = details.querySelector("summary.param-group-summary");
        if (summary) {
          accordionStates.set(summary.textContent.trim(), details.open);
        }
      });

      paramsForm.innerHTML = result.html;

      // Restore accordion states after the rebuild.
      if (accordionStates.size > 0) {
        paramsForm.querySelectorAll("details.param-group").forEach((details) => {
          const summary = details.querySelector("summary.param-group-summary");
          if (summary) {
            const name = summary.textContent.trim();
            if (accordionStates.has(name)) {
              details.open = accordionStates.get(name);
            }
          }
        });
      }

      paramValues = result.values || {};
      syncParamsTextareaFromState();
      scheduleSave();
      return true;
    };

    const runPendingParamBuild = async () => {
      if (paramBuildInFlight) return;
      while (pendingParamCode !== null && pendingParamCode !== lastBuiltParamCode) {
        const nextCode = pendingParamCode;
        const nextToken = latestParamBuildToken;
        pendingParamCode = null;
        paramBuildInFlight = true;
        try {
          const wasApplied = await buildParamForm(nextCode, nextToken);
          if (wasApplied && nextToken === latestParamBuildToken) {
            lastBuiltParamCode = nextCode;
          }
        } finally {
          paramBuildInFlight = false;
        }
      }
    };

    const scheduleParamBuild = (code) => {
      latestParamBuildToken += 1;
      pendingParamCode = code;
      clearTimeout(paramRebuildTimer);
      paramRebuildTimer = window.setTimeout(() => {
        void runPendingParamBuild();
      }, PARAM_REBUILD_DEBOUNCE_MS);
    };

    const getParamDefinitions = () => {
      const parsed = paramValues;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(i18nGet("openscad-params-object", "Parameters must be a JSON object"));
      }
      return Object.entries(parsed).map(([k, v]) => `-D${k}=${formatValue(v)}`);
    };

    const renderWithFormat = async (format, libraryNames = [], isPreview = false) => {
      renderBtn?.setAttribute("disabled", "true");
      showOverlay("loading", i18nGet("openscad-rendering", "Rendering..."));

      try {
        // Param values are always synced back into the editor code, so the code
        // itself is the single source of truth. Passing -D overrides is both
        // redundant and causes stale-value renders when the render fires before
        // the next param-build cycle completes.
        const resolvedBinaryFiles = mergeBinaryFiles(
          userBinaryFiles,
          buildAutoBinaryFiles(cm?.getValue() || "", basePath, pagePath),
        );
        const result = await callWorker("render", "render", {
          code: cm?.getValue() || "",
          format,
          libraryNames,
          binaryFiles: resolvedBinaryFiles,
          paramDefinitions: [],
          isPreview,
        });
        const stderr = getInvocationStderr(result);
        if (result?.error || result?.exitCode !== 0) {
          const error = new Error(result?.error || i18nGet("openscad-render-failed", "OpenSCAD render failed"));
          error.stderr = stderr;
          throw error;
        }
        // Worker returns pre-parsed geometry for preview OFF renders (avoids main-thread text parsing).
        if (result?.parsedGeometry) {
          return { parsedGeometry: result.parsedGeometry, stderr };
        }
        const output = result?.outputs?.[0]?.[1];
        if (!output) {
          const error = new Error(i18nGet("openscad-render-failed", "OpenSCAD render failed"));
          error.stderr = stderr;
          throw error;
        }
        return {
          content: toUint8Array(output),
          stderr,
        };
      } finally {
        renderBtn?.removeAttribute("disabled");
      }
    };

    const downloadBinary = (content, ext, mimeType = "application/octet-stream") => {
      const blob = new Blob([content], { type: mimeType });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `openscad-${id || "model"}.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };

    const renderPreview = async () => {
      try {
        await save();
        const renderResult = await renderWithFormat("off", libraryNames, true);
        if (renderResult.parsedGeometry) {
          await renderOff({ colorBuckets: renderResult.parsedGeometry });
        } else {
          await renderOff(renderResult.content);
        }
        hideOverlay();
      } catch (error) {
        const stderrErrors = (error?.stderr || []).filter((l) => /error/i.test(l)).join("\n");
        if (stderrErrors) {
          showOverlay("error", stderrErrors);
        } else if (typeof error === "number") {
          showOverlay("error", i18nGet("openscad-render-failed", "OpenSCAD render failed"));
        } else {
          showOverlay("error", error?.message || `${error}`);
        }
      }
    };

    const scheduleParamRender = () => {
      clearTimeout(paramRenderTimer);
      paramRenderTimer = window.setTimeout(() => {
        void renderPreview();
      }, PARAM_RENDER_DEBOUNCE_MS);
    };

    const disposeModel = () => {
      if (!viewerState.model || !viewerState.scene) return;
      viewerState.scene.remove(viewerState.model);
      viewerState.model.traverse((child) => {
        child.geometry?.dispose?.();
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material?.dispose?.());
        } else {
          child.material?.dispose?.();
        }
      });
      viewerState.model = null;
    };

    const renderOff = async (offData) => {
      const { THREE, OrbitControls } = await getThree();
      if (!canvas) return;

      if (!viewerState.renderer) {
        viewerState.renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: true,
          alpha: true,
        });
        viewerState.renderer.setPixelRatio(window.devicePixelRatio || 1);

        viewerState.scene = new THREE.Scene();
        viewerState.scene.background = new THREE.Color(0xf8fafc);

        const ambient = new THREE.AmbientLight(0xffffff, 0.75);
        const key = new THREE.DirectionalLight(0xffffff, 1);
        key.position.set(1, 1, 2);
        const fill = new THREE.DirectionalLight(0xffffff, 0.5);
        fill.position.set(-1, -1, 1);

        viewerState.scene.add(ambient);
        viewerState.scene.add(key);
        viewerState.scene.add(fill);

        viewerState.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
        viewerState.controls = new OrbitControls(viewerState.camera, canvas);
        viewerState.controls.enableDamping = false;
        viewerState.controls.addEventListener("change", requestRender);

        viewerState.resizeObserver = new ResizeObserver(() => scheduleResizeCanvas());
        viewerState.resizeObserver.observe(canvasWrapper || previewContainer);
      }

      const bounds = canvasWrapper?.getBoundingClientRect() ?? previewContainer?.getBoundingClientRect();
      const width = Math.max(1, Math.floor(bounds?.width || canvas.clientWidth || 320));
      const height = Math.max(1, Math.floor(bounds?.height || canvas.clientHeight || 320));
      viewerState.renderer.setSize(width, height, false);
      viewerState.camera.aspect = width / height;
      viewerState.camera.updateProjectionMatrix();

      disposeModel();

      const polyhedron = offData?.colorBuckets ? null : parseOffToIndexedPolyhedron(offData);
      const model = offData?.colorBuckets
        ? buildThreeModelFromColorBuckets(offData.colorBuckets, THREE)
        : buildThreeModelFromIndexedPolyhedron(polyhedron, THREE);
      viewerState.model = model;
      viewerState.scene.add(model);

      const box = new THREE.Box3().setFromObject(model);
      if (box.isEmpty()) {
        throw new Error(i18nGet("openscad-render-failed", "OpenSCAD render failed"));
      }
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      model.position.x = -center.x;
      model.position.y = -center.y;
      model.position.z = -center.z;

      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const distance = maxDim * 1.8;
      viewerState.camera.position.set(distance, distance, distance);
      viewerState.camera.near = Math.max(0.01, distance / 1000);
      viewerState.camera.far = Math.max(1000, distance * 10);
      viewerState.camera.lookAt(0, 0, 0);
      viewerState.camera.updateProjectionMatrix();

      viewerState.controls.target.set(0, 0, 0);
      viewerState.controls.update();
      requestRender();
    };

    copyBtn?.addEventListener("click", async () => {
      await navigator.clipboard.writeText(editor?.value || "");
      hideOverlay();
    });

    resetBtn?.addEventListener("click", async () => {
      if (!window.confirm(i18nGet("openscad-reset-prompt", "Are you sure you want to reset the code?"))) {
        return;
      }
      await hyperbook.store.db.openscad.delete(id);
      window.location.reload();
    });

    renderBtn?.addEventListener("click", renderPreview);

    downloadBtn?.addEventListener("click", async () => {
      try {
        await save();
        const selectedFormat = downloadFormatSelect?.value === "3mf" ? "3mf" : "stl";
        if (selectedFormat === "3mf") {
          const { content: off } = await renderWithFormat("off", libraryNames);
          const polyhedron = parseOffToIndexedPolyhedron(off);
          const threeMf = exportIndexedPolyhedronTo3mf(polyhedron);
          downloadBinary(threeMf, "3mf", "model/3mf");
        } else {
          const { content: stl } = await renderWithFormat("stl", libraryNames);
          downloadBinary(stl, "stl");
        }
        hideOverlay();
      } catch (error) {
        const stderrErrors = (error?.stderr || []).filter((l) => /error/i.test(l)).join("\n");
        showOverlay("error", stderrErrors || error?.message || `${error}`);
      }
    });

    fullscreenBtn?.addEventListener("click", async () => {
      try {
        await toggleFullscreen(elem);
      } catch (error) {
        console.error(error?.message || error);
      }
    });

    updateFullscreenButtonState(elem, fullscreenBtn);

    let editorStateRestored = false;

    // Initialize CodeMirror now that scheduleSave/scheduleParamBuild are defined.
    if (editorDiv) {
      const initialSource = editorDiv.textContent;
      editorDiv.textContent = "";
      cm = HyperbookCM.create(editorDiv, {
        lang: editorDiv.dataset.lang || "clike",
        value: initialSource,
        onChange: (code) => {
          scheduleSave();
          if (!suppressParamBuild) {
            scheduleParamBuild(code);
            scheduleParamRender();
          }
        },
      });
    }

    const restoreEditorState = async () => {
      if (editorStateRestored) return;
      editorStateRestored = true;

      const stored = await load();
      // Re-apply split sizes after stored dataset values are applied by load().
      applyMainSplitSize?.();
      applyCanvasParamsSplitSize?.();

      // Use stored code if available; otherwise fall back to the editor's
      // current value (the markdown default) or the built-in placeholder.
      const initialCode = stored?.code || cm?.getValue().trim() || "// OpenSCAD\ncube([20,20,20], center=true);";
      cm?.setValue(initialCode);
      if (!params?.value.trim()) {
        params.value = "{}";
      }
      latestParamBuildToken += 1;
      const initParamToken = latestParamBuildToken;
      // Fire param extraction and rendering concurrently — each uses its own dedicated worker.
      buildParamForm(initialCode, initParamToken).then(() => {
        if (initParamToken === latestParamBuildToken) {
          lastBuiltParamCode = initialCode;
        }
      }).catch(() => {});
      if (!stored) {
        await save();
      }
      renderPreview();
    };

    void restoreEditorState();
  }

  function init(root) {
    const elems = root.querySelectorAll(".directive-openscad");
    elems.forEach(initElement);
  }

  document.addEventListener("DOMContentLoaded", () => {
    init(document);
  });
  document.addEventListener("fullscreenchange", syncFullscreenButtons);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (
          node.nodeType === 1 &&
          node.classList.contains("directive-openscad")
        ) {
          initElement(node);
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  return { init };
})();
