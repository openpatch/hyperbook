/// <reference path="../hyperbook.types.js" />

/**
 * OpenSCAD IDE directive.
 * @type {any}
 * @memberof hyperbook
 */
hyperbook.openscad = (function () {
  const _scriptBase = window.HYPERBOOK_ASSETS + "directive-openscad/";

  window.codeInput?.registerTemplate(
    "openscad-highlighted",
    codeInput.templates.prism(window.Prism, [
      new codeInput.plugins.AutoCloseBrackets(),
      new codeInput.plugins.Indent(true, 2),
    ]),
  );

  // Cache the ESM module import (loaded once). Each render creates a fresh
  // WASM instance to avoid C++ singleton state issues
  // (e.g. the Manifold backend throwing a C++ exception on second callMain).
  let openscadModulePromise = null;
  let threePromise = null;

  // Font bytes are fetched once and re-written to each fresh WASM instance.
  let robotoFontData = null;

  // Per-render stderr capture — cleared before each render.
  let openscadStderr = [];

  const i18nGet = (key, fallback = key) => hyperbook.i18n?.get(key) || fallback;

  const FONTS_CONF = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>/fonts</dir>
</fontconfig>`;

  // Create a fresh OpenSCAD WASM instance for each render.
  // The ESM module (and its compiled WASM binary) is imported only once;
  // the browser's WebAssembly module cache makes subsequent instantiations fast.
  const getOpenScad = async () => {
    if (!openscadModulePromise) {
      openscadModulePromise = import(/* @vite-ignore */ _scriptBase + "openscad.js");
    }
    const OpenSCAD = (await openscadModulePromise).default;
    const instance = await OpenSCAD({
      noInitialRun: true,
      locateFile: (file) => _scriptBase + file,
      printErr: (text) => openscadStderr.push(text),
    });
    const fs = instance.FS;
    try { fs.mkdir("/tmp"); } catch (_) {}
    try { fs.mkdir("/fonts"); } catch (_) {}
    // Fonts are resolved from $(cwd)/fonts — keep cwd at /
    try { instance.FS.chdir("/"); } catch (_) {}
    try { fs.writeFile("/fonts/fonts.conf", FONTS_CONF); } catch (_) {}
    // Write cached font data if already fetched
    if (robotoFontData) {
      try { fs.writeFile("/fonts/Roboto-Regular.ttf", robotoFontData); } catch (_) {}
    }
    return instance;
  };

  // Known library URLs hosted at the openscad-playground deployment.
  const KNOWN_LIBRARIES = {
    BOSL2: "https://ochafik.com/openscad2/libraries/BOSL2.zip",
    BOSL: "https://ochafik.com/openscad2/libraries/BOSL.zip",
    MCAD: "https://ochafik.com/openscad2/libraries/MCAD.zip",
    NopSCADlib: "https://ochafik.com/openscad2/libraries/NopSCADlib.zip",
    fonts: "https://ochafik.com/openscad2/libraries/fonts.zip",
  };

  // Per-name cache of extracted file maps: Map<name, { [path]: Uint8Array }>
  const libraryCache = new Map();

  // Minimal ZIP extractor using the browser-native DecompressionStream API.
  // Supports Stored (method 0) and Deflate (method 8) entries.
  const extractZip = async (buffer) => {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const files = {};
    const dec = new TextDecoder();

    // Locate End of Central Directory record.
    let eocdPos = -1;
    for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65558); i--) {
      if (view.getUint32(i, true) === 0x06054b50) { eocdPos = i; break; }
    }
    if (eocdPos < 0) throw new Error("Not a valid ZIP file");

    const entryCount = view.getUint16(eocdPos + 10, true);
    let cdOffset = view.getUint32(eocdPos + 16, true);

    for (let i = 0; i < entryCount; i++) {
      if (view.getUint32(cdOffset, true) !== 0x02014b50) break;
      const compression = view.getUint16(cdOffset + 10, true);
      const compressedSize = view.getUint32(cdOffset + 20, true);
      const fnLen = view.getUint16(cdOffset + 28, true);
      const extraLen = view.getUint16(cdOffset + 30, true);
      const commentLen = view.getUint16(cdOffset + 32, true);
      const localOffset = view.getUint32(cdOffset + 42, true);
      const name = dec.decode(bytes.subarray(cdOffset + 46, cdOffset + 46 + fnLen));
      cdOffset += 46 + fnLen + extraLen + commentLen;

      if (name.endsWith("/")) continue;

      const localFnLen = view.getUint16(localOffset + 26, true);
      const localExtraLen = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localFnLen + localExtraLen;
      const compressed = bytes.subarray(dataStart, dataStart + compressedSize);

      if (compression === 0) {
        files[name] = new Uint8Array(compressed);
      } else if (compression === 8) {
        const ds = new DecompressionStream("deflate-raw");
        const writer = ds.writable.getWriter();
        const reader = ds.readable.getReader();
        writer.write(compressed);
        writer.close();
        const chunks = [];
        let totalLen = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          totalLen += value.byteLength;
        }
        const out = new Uint8Array(totalLen);
        let pos = 0;
        for (const c of chunks) { out.set(c, pos); pos += c.byteLength; }
        files[name] = out;
      }
    }
    return files;
  };

  // Fetch and extract a library zip, caching the result.
  const loadLibrary = async (name) => {
    if (libraryCache.has(name)) return libraryCache.get(name);
    const url = KNOWN_LIBRARIES[name];
    if (!url) throw new Error(`Unknown OpenSCAD library: ${name}`);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to fetch library ${name}: ${resp.status}`);
    const files = await extractZip(await resp.arrayBuffer());
    libraryCache.set(name, files);
    return files;
  };

  // Mount a list of libraries into a WASM FS instance.
  // Each library is written to /<name>/<file> so `use <BOSL2/std.scad>` resolves correctly.
  const mountLibraries = async (instance, libraryNames) => {
    for (const libName of libraryNames) {
      const files = await loadLibrary(libName);
      try { instance.FS.mkdir(`/${libName}`); } catch (_) {}
      for (const [filePath, data] of Object.entries(files)) {
        const parts = filePath.split("/");
        let dir = `/${libName}`;
        for (let j = 0; j < parts.length - 1; j++) {
          dir += "/" + parts[j];
          try { instance.FS.mkdir(dir); } catch (_) {}
        }
        try { instance.FS.writeFile(`/${libName}/${filePath}`, data); } catch (_) {}
      }
    }
  };

  // Fetch the Roboto TTF once and cache it in memory so it can be written
  // to each new WASM instance's FS to enable OpenSCAD text() rendering.
  const loadFonts = async () => {
    if (robotoFontData) return;
    try {
      const resp = await fetch(
        "https://fonts.gstatic.com/s/roboto/v32/KFOmCnqEu92Fr1Me5Q.ttf",
      );
      if (resp.ok) {
        robotoFontData = new Uint8Array(await resp.arrayBuffer());
      }
    } catch (e) {
      console.warn("[openscad] Failed to load fonts:", e);
    }
  };

  // Extract parameters from SCAD code. Tries OpenSCAD WASM with
  // --export-format=param first (uses the built-in Customizer engine with full
  // comment syntax support). Falls back to regex parsing if WASM returns nothing.
  const extractParams = async (code, libraryNames = []) => {
    try {
      const openscad = await getOpenScad();
      const instance = openscad;

      if (libraryNames.length > 0) {
        await mountLibraries(instance, libraryNames);
      }

      const sourcePath = "/tmp/params_model.scad";
      const outPath = "/tmp/params_out.json";

      try { instance.FS.unlink(sourcePath); } catch (_) {}
      try { instance.FS.unlink(outPath); } catch (_) {}

      // Prepend $preview=true as the playground does, to avoid full geometry evaluation.
      instance.FS.writeFile(sourcePath, "$preview=true;\n" + code);

      const exitCode = instance.callMain([
        sourcePath,
        "-o", outPath,
        "--export-format=param",
      ]);

      if (exitCode === 0) {
        try {
          const json = instance.FS.readFile(outPath, { encoding: "utf8" });
          const paramSet = JSON.parse(json);
          if (Array.isArray(paramSet.parameters) && paramSet.parameters.length > 0) {
            // Filter out OpenSCAD special variables (e.g. $preview, $fn, $fa, $fs)
            // that are internal and should not be exposed in the parameter UI.
            return paramSet.parameters.filter(p => !p.name?.startsWith('$'));
          }
        } catch (e) {
          console.warn("[openscad] Failed to parse param output:", e);
        }
      }
    } catch (e) {
      console.warn("[openscad] WASM param extraction failed:", e);
    }
    return [];
  };

  const getThree = async () => {
    if (!threePromise) {
      threePromise = Promise.all([
        import(/* @vite-ignore */ _scriptBase + "three.module.js"),
        import(/* @vite-ignore */ _scriptBase + "STLLoader.js"),
        import(/* @vite-ignore */ _scriptBase + "OrbitControls.js"),
      ]).then(([THREE, STLLoaderModule, OrbitControlsModule]) => ({
        THREE,
        STLLoader: STLLoaderModule.STLLoader,
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

  function initElement(elem) {
    if (elem.getAttribute("data-openscad-initialized") === "true") return;
    elem.setAttribute("data-openscad-initialized", "true");

    const id = elem.getAttribute("data-id");
    const libraryNames = (elem.getAttribute("data-library") || "")
      .split(",").map(s => s.trim()).filter(Boolean);

    const previewContainer = elem.querySelector(".preview-container");
    const leftSide = elem.querySelector(".left-side");
    const canvasWrapper = elem.querySelector(".canvas-wrapper");
    const canvasOverlay = elem.querySelector(".canvas-overlay");
    const editorContainer = elem.querySelector(".editor-container");
    const splitter = elem.querySelector(".splitter");
    const canvasParamsSplitter = elem.querySelector(".canvas-params-splitter");
    const canvas = elem.querySelector(".preview-canvas");
    const editor = elem.querySelector("code-input.editor");
    const params = elem.querySelector("textarea.parameters");

    // The parameters panel is its own card below the canvas.
    const paramsPanel = elem.querySelector(".parameters-panel");
    const paramsForm = paramsPanel?.querySelector(".parameters-body") ?? paramsPanel;

    const renderBtn = elem.querySelector("button.render");
    const copyBtn = elem.querySelector("button.copy");
    const downloadStlBtn = elem.querySelector("button.download-stl");
    const resetBtn = elem.querySelector("button.reset");
    const fullscreenBtn = elem.querySelector("button.fullscreen");

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

    // Resize the Three.js renderer to match the current canvas-wrapper size.
    const resizeCanvas = () => {
      if (!viewerState.renderer || !viewerState.camera || !canvasWrapper) return;
      const w = Math.max(1, Math.floor(canvasWrapper.clientWidth));
      const h = Math.max(1, Math.floor(canvasWrapper.clientHeight));
      viewerState.renderer.setSize(w, h, false);
      viewerState.camera.aspect = w / h;
      viewerState.camera.updateProjectionMatrix();
    };

    const applyMainSplitSize = setupSplitter(elem, leftSide, editorContainer, splitter, () => {
      resizeCanvas();
      save();
    });
    const applyCanvasParamsSplitSize = setupCanvasParamsSplitter(leftSide, previewContainer, paramsPanel, canvasParamsSplitter, () => {
      resizeCanvas();
      save();
    });

    const viewerState = {
      renderer: null,
      camera: null,
      scene: null,
      controls: null,
      mesh: null,
      raf: 0,
      disposed: false,
      resizeObserver: null,
    };

    const save = async () => {
      if (!id) return;
      const splitHorizontal = Number(elem.dataset.splitHorizontal);
      const splitVertical = Number(elem.dataset.splitVertical);
      const splitCanvasParams = Number(leftSide?.dataset.splitCanvasParams);
      await hyperbook.store.db.openscad.put({
        id,
        code: editor?.value || "",
        params: params?.value || "{}",
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
      if (editor && typeof result.code === "string") {
        editor.value = result.code;
      }
      if (params && typeof result.params === "string") {
        params.value = result.params;
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

    // Rebuild the parameters form from the code's top-level variable assignments.
    // Stored overrides from the textarea are preserved so user edits survive
    // code changes that don't touch those variable names.
    const buildParamForm = async (code) => {
      // Show a loading indicator while WASM extracts params.
      paramsForm.innerHTML = "";
      paramsPanel?.classList.remove("hidden");
      canvasParamsSplitter?.classList.remove("hidden");
      const loading = document.createElement("p");
      loading.className = "params-empty";
      loading.textContent = i18nGet("openscad-params-loading", "Loading parameters...");
      paramsForm.appendChild(loading);

      const codeParams = await extractParams(code, libraryNames);
      paramsForm.innerHTML = "";

      if (codeParams.length === 0) {
        paramsPanel?.classList.add("hidden");
        canvasParamsSplitter?.classList.add("hidden");
        if (params) params.value = "{}";
        return;
      }

      let currentOverrides = {};
      try {
        currentOverrides = JSON.parse(params?.value || "{}");
      } catch (_) {}

      const syncTextarea = () => {
        const values = {};
        paramsForm.querySelectorAll("[data-param-name]").forEach((input) => {
          const name = input.dataset.paramName;
          const type = input.dataset.paramType;
          if (type === "boolean") {
            values[name] = input.checked;
          } else if (type === "number") {
            values[name] = Number(input.value);
          } else {
            values[name] = input.value;
          }
        });
        if (params) params.value = JSON.stringify(values);
        save();
      };

      codeParams.forEach(({ name, caption, type, initial, min, max, step, options }) => {
        const current =
          currentOverrides[name] !== undefined ? currentOverrides[name] : initial;

        const row = document.createElement("div");
        row.className = "param-row";

        const label = document.createElement("label");
        label.textContent = caption || name;
        label.setAttribute("for", `openscad-param-${id}-${name}`);

        let input;
        if (type === "boolean") {
          input = document.createElement("input");
          input.type = "checkbox";
          input.checked = Boolean(current);
        } else if (options && options.length > 0) {
          // Dropdown for parameters with a fixed set of options.
          input = document.createElement("select");
          options.forEach(({ name: optName, value: optValue }) => {
            const opt = document.createElement("option");
            opt.value = String(optValue);
            opt.textContent = optName || String(optValue);
            if (String(optValue) === String(current)) opt.selected = true;
            input.appendChild(opt);
          });
          input.addEventListener("change", syncTextarea);
        } else if (type === "number" && Array.isArray(initial)) {
          // Vector: render one number input per component.
          input = document.createElement("span");
          input.className = "param-vector";
          const arr = Array.isArray(current) ? current : initial;
          arr.forEach((val, idx) => {
            const ni = document.createElement("input");
            ni.type = "number";
            ni.value = String(val);
            ni.step = step != null ? String(step) : "any";
            if (min != null) ni.min = String(min);
            if (max != null) ni.max = String(max);
            ni.dataset.paramName = name;
            ni.dataset.paramType = "vector";
            ni.dataset.vectorIndex = String(idx);
            ni.addEventListener("input", () => {
              const all = Array.from(input.querySelectorAll("input")).map(
                (i) => Number(i.value)
              );
              const sibling = paramsForm.querySelector(
                `[data-param-name="${name}"][data-param-type="number"]`
              );
              if (sibling) sibling.value = JSON.stringify(all);
              syncTextarea();
            });
            input.appendChild(ni);
          });
          // Hidden input holds the JSON array for syncTextarea to read.
          const hidden = document.createElement("input");
          hidden.type = "hidden";
          hidden.dataset.paramName = name;
          hidden.dataset.paramType = "number";
          hidden.value = JSON.stringify(arr);
          input.appendChild(hidden);
        } else if (type === "number") {
          input = document.createElement("input");
          input.type = "number";
          input.value = String(current);
          input.step = step != null ? String(step) : "any";
          if (min != null) input.min = String(min);
          if (max != null) input.max = String(max);
        } else {
          input = document.createElement("input");
          input.type = "text";
          input.value = String(current);
        }
        input.id = `openscad-param-${id}-${name}`;
        if (input.tagName !== "SPAN") {
          input.dataset.paramName = name;
          input.dataset.paramType = type;
          input.addEventListener("input", syncTextarea);
        }

        row.appendChild(label);
        row.appendChild(input);
        paramsForm.appendChild(row);
      });

      syncTextarea();
    };

    const getParamDefinitions = () => {
      const parsed = JSON.parse(params?.value || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(i18nGet("openscad-params-object", "Parameters must be a JSON object"));
      }
      return Object.entries(parsed).map(([k, v]) => `-D${k}=${formatValue(v)}`);
    };

    const renderWithFormat = async (format, libraryNames = []) => {
      renderBtn?.setAttribute("disabled", "true");
      showOverlay("loading", i18nGet("openscad-rendering", "Rendering..."));

      try {
        const paramDefinitions = getParamDefinitions();
        const openscad = await getOpenScad();
        const instance = openscad;

        if (libraryNames.length > 0) {
          await mountLibraries(instance, libraryNames);
        }

        const sourcePath = "/tmp/model.scad";
        const outPath = `/tmp/output.${format}`;
        const exportFormat = format === "stl" ? "binstl" : format;

        try {
          instance.FS.unlink(sourcePath);
        } catch (_) {}
        try {
          instance.FS.unlink(outPath);
        } catch (_) {}

        instance.FS.writeFile(sourcePath, editor?.value || "");

        const args = [
          sourcePath,
          "-o",
          outPath,
          `--export-format=${exportFormat}`,
          ...paramDefinitions,
        ];

        const exitCode = instance.callMain(args);
        if (exitCode !== 0) {
          throw new Error(i18nGet("openscad-render-failed", "OpenSCAD render failed"));
        }

        const content = toUint8Array(instance.FS.readFile(outPath, { encoding: "binary" }));
        return content;
      } finally {
        renderBtn?.removeAttribute("disabled");
      }
    };

    const downloadBinary = (content, ext) => {
      const blob = new Blob([content], { type: "application/octet-stream" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `openscad-${id || "model"}.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };

    const renderPreview = async () => {
      openscadStderr = [];
      try {
        // Ensure font bytes are fetched before creating the WASM instance
        await loadFonts();
        await save();
        const stl = await renderWithFormat("stl", libraryNames);
        await renderStl(stl);
        hideOverlay();
      } catch (error) {
        // Prefer actual OpenSCAD error lines over raw JS/C++ exception values.
        // emscripten throws C++ exceptions as raw numbers (WASM memory pointers).
        const stderrErrors = openscadStderr.filter((l) => /error/i.test(l)).join("\n");
        if (stderrErrors) {
          showOverlay("error", stderrErrors);
        } else if (typeof error === "number") {
          showOverlay("error", i18nGet("openscad-render-failed", "OpenSCAD render failed"));
        } else {
          showOverlay("error", error?.message || `${error}`);
        }
      }
    };

    const renderStl = async (stlData) => {
      const { THREE, STLLoader, OrbitControls } = await getThree();
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
        viewerState.controls.enableDamping = true;

        const tick = () => {
          if (viewerState.disposed) return;
          if (viewerState.controls) viewerState.controls.update();
          if (viewerState.renderer && viewerState.scene && viewerState.camera) {
            viewerState.renderer.render(viewerState.scene, viewerState.camera);
          }
          viewerState.raf = requestAnimationFrame(tick);
        };
        tick();

        viewerState.resizeObserver = new ResizeObserver(() => resizeCanvas());
        viewerState.resizeObserver.observe(canvasWrapper || previewContainer);
      }

      const bounds = canvasWrapper?.getBoundingClientRect() ?? previewContainer?.getBoundingClientRect();
      const width = Math.max(1, Math.floor(bounds?.width || canvas.clientWidth || 320));
      const height = Math.max(1, Math.floor(bounds?.height || canvas.clientHeight || 320));
      viewerState.renderer.setSize(width, height, false);
      viewerState.camera.aspect = width / height;
      viewerState.camera.updateProjectionMatrix();

      if (viewerState.mesh) {
        viewerState.scene.remove(viewerState.mesh);
        viewerState.mesh.geometry?.dispose();
      }

      const loader = new STLLoader();
      const arrayBuffer = stlData.buffer.slice(
        stlData.byteOffset,
        stlData.byteOffset + stlData.byteLength,
      );
      const geometry = loader.parse(arrayBuffer);
      geometry.computeBoundingBox();
      geometry.computeVertexNormals();

      const material = new THREE.MeshStandardMaterial({
        color: 0x3b82f6,
        metalness: 0.1,
        roughness: 0.6,
      });
      const mesh = new THREE.Mesh(geometry, material);
      viewerState.mesh = mesh;
      viewerState.scene.add(mesh);

      const box = geometry.boundingBox;
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      mesh.position.x = -center.x;
      mesh.position.y = -center.y;
      mesh.position.z = -center.z;

      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const distance = maxDim * 1.8;
      viewerState.camera.position.set(distance, distance, distance);
      viewerState.camera.near = Math.max(0.01, distance / 1000);
      viewerState.camera.far = Math.max(1000, distance * 10);
      viewerState.camera.lookAt(0, 0, 0);
      viewerState.camera.updateProjectionMatrix();

      viewerState.controls.target.set(0, 0, 0);
      viewerState.controls.update();
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

    downloadStlBtn?.addEventListener("click", async () => {
      openscadStderr = [];
      try {
        await loadFonts();
        await save();
        const stl = await renderWithFormat("stl", libraryNames);
        downloadBinary(stl, "stl");
        await renderStl(stl);
        hideOverlay();
      } catch (error) {
        const stderrErrors = openscadStderr.filter((l) => /error/i.test(l)).join("\n");
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
    const restoreEditorState = async () => {
      if (editorStateRestored) return;
      editorStateRestored = true;

      const stored = await load();
      // Re-apply split sizes after stored dataset values are applied by load().
      applyMainSplitSize?.();
      applyCanvasParamsSplitSize?.();
      let paramRebuildTimer = null;
      editor.addEventListener("input", () => {
        save();
        clearTimeout(paramRebuildTimer);
        paramRebuildTimer = setTimeout(() => buildParamForm(editor.value), 500);
      });

      // Use stored code if available; otherwise fall back to the editor's
      // current value (the markdown default) or the built-in placeholder.
      const initialCode = stored?.code || editor.value.trim() || "// OpenSCAD\ncube([20,20,20], center=true);";
      editor.value = initialCode;
      if (!params?.value.trim()) {
        params.value = "{}";
      }
      await buildParamForm(initialCode);
      // Only persist when there was no stored entry; if one already existed we
      // must not overwrite it — reading editor.value right now may return stale
      // data because code-input's async re-render may not have completed yet.
      if (!stored) {
        await save();
      }
      renderPreview();
    };

    editor?.addEventListener("code-input_load", restoreEditorState);
    // SPA timing: if code-input already rendered its inner textarea before we
    // attached the listener, fire the handler immediately (mirrors pyide).
    if (editor?.querySelector("textarea")) {
      void restoreEditorState();
    }
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
