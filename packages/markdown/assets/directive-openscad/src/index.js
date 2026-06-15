/// <reference path="../../hyperbook.types.js" />

import { THREE, OrbitControls, ViewportGizmo, buildThreeModelFromIndexedPolyhedron, buildThreeModelFromColorBuckets } from "./viewer.js";
import { parseOffToIndexedPolyhedron, exportIndexedPolyhedronTo3mf } from "./geometry.js";
import { callWorker, getInvocationStderr, buildParamUiInWorker } from "./worker.js";
import { setupSplitter, setupCanvasParamsSplitter, updateFullscreenButtonState, toggleFullscreen, syncFullscreenButtons } from "./ui.js";
import { i18nGet, normalizePath, buildAutoBinaryFiles, mergeBinaryFiles, formatValue, toUint8Array } from "./utils.js";

/**
 * OpenSCAD IDE directive.
 * @type {any}
 * @memberof hyperbook
 */
hyperbook.openscad = (function () {
  const _scriptBase = window.HYPERBOOK_ASSETS + "directive-openscad/";

  function initElement(elem) {
    if (elem.getAttribute("data-openscad-initialized") === "true") return;
    elem.setAttribute("data-openscad-initialized", "true");

    const id = elem.getAttribute("data-id");
    const libraryNames = (elem.getAttribute("data-library") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const binaryFilesData = elem.getAttribute("data-binary-files");
    const basePath = normalizePath(elem.getAttribute("data-base-path") || "/");
    const pagePath = normalizePath(elem.getAttribute("data-page-path") || "");
    const decodeBase64 = (str) => {
      const binaryStr = atob(str);
      const bytes = Uint8Array.from(binaryStr, (c) => c.charCodeAt(0));
      return new TextDecoder("utf-8").decode(bytes);
    };
    const initialBinaryFiles = binaryFilesData
      ? JSON.parse(decodeBase64(binaryFilesData))
      : [];
    let userBinaryFiles = Array.isArray(initialBinaryFiles)
      ? [...initialBinaryFiles]
      : [];

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
    const paramsForm =
      paramsPanel?.querySelector(".parameters-body") ?? paramsPanel;

    const renderBtn = elem.querySelector("button.render");
    const copyBtn = elem.querySelector("button.copy");
    const downloadBtn = elem.querySelector("button.download-stl");
    const resetBtn = elem.querySelector("button.reset");
    const fullscreenBtn = elem.querySelector("button.fullscreen");
    const addBinaryFileBtn = elem.querySelector("button.add-binary-file");
    const binaryFilesList = elem.querySelector(".binary-files-list");
    const bottomButtons = elem.querySelector(".buttons.bottom");
    let downloadFormatSelect = bottomButtons?.querySelector(
      "select.download-format",
    );
    if (!downloadFormatSelect && bottomButtons && downloadBtn) {
      downloadFormatSelect = document.createElement("select");
      downloadFormatSelect.className = "download-format";
      downloadFormatSelect.setAttribute(
        "aria-label",
        i18nGet("openscad-download-format", "Download format"),
      );
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
        emptyMsg.textContent = i18nGet(
          "openscad-no-binary-files",
          "No binary files",
        );
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
          if (
            !window.confirm(
              i18nGet("openscad-file-replace", `Replace existing ${dest}?`),
            )
          ) {
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
      gizmo: null,
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

        if (viewerState.controls) {
          viewerState.controls.update();
        }

        if (viewerState.renderer && viewerState.scene && viewerState.camera) {
          viewerState.renderer.render(viewerState.scene, viewerState.camera);

          if (viewerState.gizmo) {
            viewerState.gizmo.render();
          }
        }
      });
    };

    // Resize the Three.js renderer to match the current canvas-wrapper size.
    const resizeCanvas = () => {
      if (!viewerState.renderer || !viewerState.camera || !canvasWrapper)
        return;
      const w = Math.max(1, Math.floor(canvasWrapper.clientWidth));
      const h = Math.max(1, Math.floor(canvasWrapper.clientHeight));
      viewerState.renderer.setSize(w, h, false);
      viewerState.camera.aspect = w / h;
      viewerState.camera.updateProjectionMatrix();
      viewerState.gizmo?.update();
      requestRender();
    };

    const scheduleResizeCanvas = () => {
      if (viewerState.resizeRaf || viewerState.disposed) return;
      viewerState.resizeRaf = requestAnimationFrame(() => {
        viewerState.resizeRaf = 0;
        resizeCanvas();
      });
    };

    const applyMainSplitSize = setupSplitter(
      elem,
      leftSide,
      editorContainer,
      splitter,
      () => {
        scheduleResizeCanvas();
        scheduleSave();
      },
    );
    const applyCanvasParamsSplitSize = setupCanvasParamsSplitter(
      leftSide,
      previewContainer,
      paramsPanel,
      canvasParamsSplitter,
      () => {
        scheduleResizeCanvas();
        scheduleSave();
      },
    );

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
      if (
        Number.isFinite(result.splitHorizontal) &&
        result.splitHorizontal > 0
      ) {
        elem.dataset.splitHorizontal = String(
          Math.round(result.splitHorizontal),
        );
      }
      if (Number.isFinite(result.splitVertical) && result.splitVertical > 0) {
        elem.dataset.splitVertical = String(Math.round(result.splitVertical));
      }
      if (
        leftSide &&
        Number.isFinite(result.splitCanvasParams) &&
        result.splitCanvasParams > 0
      ) {
        leftSide.dataset.splitCanvasParams = String(
          Math.round(result.splitCanvasParams),
        );
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
        const runSave = () => {
          void save();
        };
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
      const updatedCode = updateVariableInCode(
        currentCode,
        name,
        paramValues[name],
      );
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
      loading.textContent = i18nGet(
        "openscad-params-loading",
        "Loading parameters...",
      );
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
        _scriptBase,
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
        paramsForm
          .querySelectorAll("details.param-group")
          .forEach((details) => {
            const summary = details.querySelector(
              "summary.param-group-summary",
            );
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
      while (
        pendingParamCode !== null &&
        pendingParamCode !== lastBuiltParamCode
      ) {
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
        throw new Error(
          i18nGet("openscad-params-object", "Parameters must be a JSON object"),
        );
      }
      return Object.entries(parsed).map(([k, v]) => `-D${k}=${formatValue(v)}`);
    };

    const renderWithFormat = async (
      format,
      libraryNames = [],
      isPreview = false,
    ) => {
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
        }, _scriptBase);
        const stderr = getInvocationStderr(result);
        if (result?.error || result?.exitCode !== 0) {
          const error = new Error(
            result?.error ||
              i18nGet("openscad-render-failed", "OpenSCAD render failed"),
          );
          error.stderr = stderr;
          throw error;
        }
        // Worker returns pre-parsed geometry for preview OFF renders (avoids main-thread text parsing).
        if (result?.parsedGeometry) {
          return { parsedGeometry: result.parsedGeometry, stderr };
        }
        const output = result?.outputs?.[0]?.[1];
        if (!output) {
          const error = new Error(
            i18nGet("openscad-render-failed", "OpenSCAD render failed"),
          );
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

    const downloadBinary = (
      content,
      ext,
      mimeType = "application/octet-stream",
    ) => {
      const blob = new Blob([content], { type: mimeType });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `openscad-${id || "model"}.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
        const gridHelper = new THREE.GridHelper(
          100000,
          10000,
          0x999999,
          0xdddddd,
        );

        viewerState.scene.add(ambient);
        viewerState.scene.add(key);
        viewerState.scene.add(fill);
        viewerState.scene.add(gridHelper);

        viewerState.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);

        viewerState.controls = new OrbitControls(viewerState.camera, canvas);
        viewerState.controls.enableDamping = false;
        viewerState.controls.addEventListener("change", requestRender);

        viewerState.gizmo = new ViewportGizmo(
          viewerState.camera,
          viewerState.renderer,
          {
            type: "cube",
            container: canvasWrapper || previewContainer,
            size: 96,
          },
        );

        viewerState.gizmo.attachControls(viewerState.controls);
        viewerState.gizmo.addEventListener("change", requestRender);

        viewerState.resizeObserver = new ResizeObserver(() =>
          scheduleResizeCanvas(),
        );
        viewerState.resizeObserver.observe(canvasWrapper || previewContainer);
      }

      const bounds =
        canvasWrapper?.getBoundingClientRect() ??
        previewContainer?.getBoundingClientRect();
      const width = Math.max(
        1,
        Math.floor(bounds?.width || canvas.clientWidth || 320),
      );
      const height = Math.max(
        1,
        Math.floor(bounds?.height || canvas.clientHeight || 320),
      );
      viewerState.renderer.setSize(width, height, false);
      viewerState.camera.aspect = width / height;
      viewerState.camera.updateProjectionMatrix();

      disposeModel();

      const polyhedron = offData?.colorBuckets
        ? null
        : parseOffToIndexedPolyhedron(offData);
      const model = offData?.colorBuckets
        ? buildThreeModelFromColorBuckets(offData.colorBuckets)
        : buildThreeModelFromIndexedPolyhedron(polyhedron);
      viewerState.model = model;
      viewerState.scene.add(model);

      const box = new THREE.Box3().setFromObject(model);
      if (box.isEmpty()) {
        throw new Error(
          i18nGet("openscad-render-failed", "OpenSCAD render failed"),
        );
      }

      const center = new THREE.Vector3();
      const size = new THREE.Vector3();

      box.getCenter(center);
      box.getSize(size);

      // IMPORTANT:
      // Keep geometry exactly where OpenSCAD placed it.
      model.position.set(0, 0, 0);

      // Bounding sphere radius
      const radius = size.length() * 0.5;

      // Fixed CAD-style isometric direction
      const direction = new THREE.Vector3(1, 1, 1).normalize();

      // Distance needed to fit object in camera frustum
      const fov = THREE.MathUtils.degToRad(viewerState.camera.fov);
      let distance = radius / Math.sin(fov / 2);

      // Add some margin around the model
      distance *= 1.25;

      // Position camera
      viewerState.camera.position.copy(
        center.clone().add(direction.multiplyScalar(distance)),
      );

      // Orbit around model center
      viewerState.controls.target.copy(center);
      viewerState.gizmo?.target.copy(center);

      // Clipping planes
      viewerState.camera.near = Math.max(0.01, distance / 1000);
      viewerState.camera.far = Math.max(1000, distance * 100);

      viewerState.camera.updateProjectionMatrix();
      viewerState.controls.update();

      requestRender();
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
        const stderrErrors = (error?.stderr || [])
          .filter((l) => /error/i.test(l))
          .join("\n");
        if (stderrErrors) {
          showOverlay("error", stderrErrors);
        } else if (typeof error === "number") {
          showOverlay(
            "error",
            i18nGet("openscad-render-failed", "OpenSCAD render failed"),
          );
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

    copyBtn?.addEventListener("click", async () => {
      await navigator.clipboard.writeText(cm?.getValue() || "");
      hideOverlay();
    });

    resetBtn?.addEventListener("click", async () => {
      if (
        !window.confirm(
          i18nGet(
            "openscad-reset-prompt",
            "Are you sure you want to reset the code?",
          ),
        )
      ) {
        return;
      }
      await hyperbook.store.db.openscad.delete(id);
      window.location.reload();
    });

    renderBtn?.addEventListener("click", renderPreview);

    downloadBtn?.addEventListener("click", async () => {
      try {
        await save();
        const selectedFormat =
          downloadFormatSelect?.value === "3mf" ? "3mf" : "stl";
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
        const stderrErrors = (error?.stderr || [])
          .filter((l) => /error/i.test(l))
          .join("\n");
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
      const initialCode =
        stored?.code ||
        cm?.getValue().trim() ||
        "// OpenSCAD\ncube([20,20,20], center=true);";
      cm?.setValue(initialCode);
      if (!params?.value.trim()) {
        params.value = "{}";
      }
      latestParamBuildToken += 1;
      const initParamToken = latestParamBuildToken;
      // Fire param extraction and rendering concurrently — each uses its own dedicated worker.
      buildParamForm(initialCode, initParamToken)
        .then(() => {
          if (initParamToken === latestParamBuildToken) {
            lastBuiltParamCode = initialCode;
          }
        })
        .catch(() => {});
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
