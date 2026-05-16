/// <reference path="../hyperbook.types.js" />

/**
 * OpenSCAD IDE directive.
 * @type {any}
 * @memberof hyperbook
 */
hyperbook.openscad = (function () {
  window.codeInput?.registerTemplate(
    "openscad-highlighted",
    codeInput.templates.prism(window.Prism, [
      new codeInput.plugins.AutoCloseBrackets(),
      new codeInput.plugins.Indent(true, 2),
    ]),
  );

  let openscadPromise = null;
  let threePromise = null;

  const i18nGet = (key, fallback = key) => hyperbook.i18n?.get(key) || fallback;

  const getOpenScad = async () => {
    if (!openscadPromise) {
      openscadPromise = import("https://cdn.jsdelivr.net/npm/openscad-wasm@0.0.4/+esm")
        .then((m) => m.createOpenSCAD())
        .then((instance) => {
          const fs = instance.getInstance().FS;
          try {
            fs.mkdir("/tmp");
          } catch (_) {}
          return instance;
        });
    }
    return openscadPromise;
  };

  const getThree = async () => {
    if (!threePromise) {
      threePromise = Promise.all([
        import("https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js"),
        import("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/STLLoader.js"),
        import("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js"),
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

  function setupSplitter(elem, previewContainer, editorContainer, splitter) {
    if (!previewContainer || !editorContainer || !splitter) return;

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
      };

      splitter.addEventListener("pointermove", onPointerMove);
      splitter.addEventListener("pointerup", onPointerUp);
      splitter.addEventListener("pointercancel", onPointerUp);
    });

    window.addEventListener("resize", applyStoredSplitSize);
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

    const previewContainer = elem.querySelector(".preview-container");
    const editorContainer = elem.querySelector(".editor-container");
    const splitter = elem.querySelector(".splitter");
    const canvas = elem.querySelector(".preview-canvas");
    const output = elem.querySelector(".output");
    const editor = elem.querySelector("code-input.editor");
    const params = elem.querySelector("textarea.parameters");

    const tabCode = elem.querySelector("button.tab-code");
    const tabParameters = elem.querySelector("button.tab-parameters");

    const renderBtn = elem.querySelector("button.render");
    const copyBtn = elem.querySelector("button.copy");
    const downloadStlBtn = elem.querySelector("button.download-stl");
    const download3mfBtn = elem.querySelector("button.download-3mf");
    const resetBtn = elem.querySelector("button.reset");
    const fullscreenBtn = elem.querySelector("button.fullscreen");

    setupSplitter(elem, previewContainer, editorContainer, splitter);

    const viewerState = {
      renderer: null,
      camera: null,
      scene: null,
      controls: null,
      mesh: null,
      raf: 0,
      disposed: false,
    };

    const setOutput = (text) => {
      if (output) output.textContent = text || "";
    };

    const save = async () => {
      if (!id) return;
      await hyperbook.store.db.openscad.put({
        id,
        code: editor?.value || "",
        params: params?.value || "{}",
      });
    };

    const load = async () => {
      if (!id) return;
      const result = await hyperbook.store.db.openscad.get(id);
      if (!result) return;
      if (editor && typeof result.code === "string") {
        editor.value = result.code;
      }
      if (params && typeof result.params === "string") {
        params.value = result.params;
      }
    };

    const getParamDefinitions = () => {
      const parsed = JSON.parse(params?.value || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(i18nGet("openscad-params-object", "Parameters must be a JSON object"));
      }
      return Object.entries(parsed).map(([k, v]) => `-D${k}=${formatValue(v)}`);
    };

    const renderWithFormat = async (format) => {
      renderBtn?.setAttribute("disabled", "true");
      setOutput(i18nGet("openscad-rendering", "Rendering ..."));

      try {
        const paramDefinitions = getParamDefinitions();
        const openscad = await getOpenScad();
        const instance = openscad.getInstance();

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
          "--backend=manifold",
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
      try {
        await save();
        const stl = await renderWithFormat("stl");
        await renderStl(stl);
        setOutput(i18nGet("openscad-render-success", "Render complete"));
      } catch (error) {
        setOutput(error?.message || `${error}`);
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
      }

      const bounds = previewContainer?.getBoundingClientRect();
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

    tabCode?.addEventListener("click", () => {
      tabCode.classList.add("active");
      tabParameters?.classList.remove("active");
      editor?.classList.add("active");
      params?.classList.remove("active");
    });

    tabParameters?.addEventListener("click", () => {
      tabParameters.classList.add("active");
      tabCode?.classList.remove("active");
      params?.classList.add("active");
      editor?.classList.remove("active");
    });

    copyBtn?.addEventListener("click", async () => {
      await navigator.clipboard.writeText(editor?.value || "");
      setOutput(i18nGet("openscad-copy-done", "Code copied"));
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
      try {
        await save();
        const stl = await renderWithFormat("stl");
        downloadBinary(stl, "stl");
        await renderStl(stl);
        setOutput(i18nGet("openscad-download-ready", "Download ready"));
      } catch (error) {
        setOutput(error?.message || `${error}`);
      }
    });

    download3mfBtn?.addEventListener("click", async () => {
      try {
        await save();
        const threeMf = await renderWithFormat("3mf");
        downloadBinary(threeMf, "3mf");
        setOutput(i18nGet("openscad-download-ready", "Download ready"));
      } catch (error) {
        setOutput(error?.message || `${error}`);
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

    editor?.addEventListener("code-input_load", async () => {
      await load();
      editor.addEventListener("input", save);
      params?.addEventListener("input", save);
      if (!editor.value.trim()) {
        editor.value = "// OpenSCAD\ncube([20,20,20], center=true);";
      }
      if (!params?.value.trim()) {
        params.value = "{}";
      }
      await save();
      renderPreview();
    });
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
