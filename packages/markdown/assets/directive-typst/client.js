hyperbook.typst = (function () {
  // Register code-input template for typst syntax highlighting
  window.codeInput?.registerTemplate(
    "typst-highlighted",
    codeInput.templates.prism(window.Prism, [
      new codeInput.plugins.AutoCloseBrackets(),
      new codeInput.plugins.Indent(true, 2),
    ]),
  );

  const elems = document.getElementsByClassName("directive-typst");

  // Typst WASM module URLs
  const TYPST_COMPILER_URL = "https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm";
  const TYPST_RENDERER_URL = "https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm";

  // Load typst all-in-one bundle
  let typstLoaded = false;
  let typstLoadPromise = null;

  const loadTypst = () => {
    if (typstLoaded) {
      return Promise.resolve();
    }
    if (typstLoadPromise) {
      return typstLoadPromise;
    }

    typstLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@myriaddreamin/typst.ts/dist/esm/contrib/all-in-one-lite.bundle.js";
      script.type = "module";
      script.id = "typst-loader";
      script.onload = () => {
        // Wait a bit for the module to initialize
        const checkTypst = () => {
          if (typeof $typst !== "undefined") {
            // Initialize the Typst compiler and renderer
            $typst.setCompilerInitOptions({
              getModule: () => TYPST_COMPILER_URL,
            });
            $typst.setRendererInitOptions({
              getModule: () => TYPST_RENDERER_URL,
            });
            typstLoaded = true;
            resolve();
          } else {
            setTimeout(checkTypst, 50);
          }
        };
        checkTypst();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });

    return typstLoadPromise;
  };

  // Store original SVG dimensions
  const svgOriginalDimensions = new Map();

  // Render typst code to SVG
  const renderTypst = async (code, container, loadingIndicator, scaleState) => {
    // Show loading indicator
    if (loadingIndicator) {
      loadingIndicator.style.display = "flex";
    }

    await loadTypst();
    
    try {
      const svg = await $typst.svg({ mainContent: code });
      container.innerHTML = svg;

      // Store original dimensions and apply scale
      const svgElem = container.firstElementChild;
      if (svgElem) {
        const originalWidth = Number.parseFloat(svgElem.getAttribute("width"));
        const originalHeight = Number.parseFloat(svgElem.getAttribute("height"));
        
        // Store original dimensions
        svgOriginalDimensions.set(container, { width: originalWidth, height: originalHeight });
        
        // Apply current scale
        applyScale(container, scaleState);
      }
    } catch (error) {
      container.innerHTML = `<div class="typst-error">${error.message || "Error rendering Typst"}</div>`;
      console.error("Typst rendering error:", error);
    } finally {
      // Hide loading indicator
      if (loadingIndicator) {
        loadingIndicator.style.display = "none";
      }
    }
  };

  // Apply scale to SVG
  const applyScale = (container, scaleState) => {
    const svgElem = container.firstElementChild;
    const original = svgOriginalDimensions.get(container);
    
    if (!svgElem || !original) return;

    const containerWidth = container.clientWidth - 32; // Account for padding
    const containerHeight = container.clientHeight - 32; // Account for padding
    
    let newWidth, newHeight;
    
    if (scaleState.mode === "fit-width") {
      // Fit to container width
      newWidth = containerWidth;
      newHeight = (original.height * containerWidth) / original.width;
    } else if (scaleState.mode === "full-page") {
      // Fit entire page in container without cut-offs
      const scaleX = containerWidth / original.width;
      const scaleY = containerHeight / original.height;
      const scale = Math.min(scaleX, scaleY);
      newWidth = original.width * scale;
      newHeight = original.height * scale;
    } else {
      // Manual scale
      newWidth = original.width * scaleState.scale;
      newHeight = original.height * scaleState.scale;
    }
    
    svgElem.setAttribute("width", newWidth);
    svgElem.setAttribute("height", newHeight);
  };

  // Export to PDF
  const exportPdf = async (code, id) => {
    await loadTypst();
    
    try {
      const pdfData = await $typst.pdf({ mainContent: code });
      const pdfFile = new Blob([pdfData], { type: "application/pdf" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(pdfFile);
      link.download = `typst-${id}.pdf`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error("PDF export error:", error);
      alert(i18n.get("typst-pdf-error") || "Error exporting PDF");
    }
  };

  for (let elem of elems) {
    const id = elem.getAttribute("data-id");
    const preview = elem.querySelector(".typst-preview");
    const loadingIndicator = elem.querySelector(".typst-loading");
    const editor = elem.querySelector(".editor.typst");
    const downloadBtn = elem.querySelector(".download-pdf");
    const copyBtn = elem.querySelector(".copy");
    const resetBtn = elem.querySelector(".reset");
    const zoomInBtn = elem.querySelector(".zoom-in");
    const zoomOutBtn = elem.querySelector(".zoom-out");
    const fitWidthBtn = elem.querySelector(".fit-width");
    const fullPageBtn = elem.querySelector(".full-page");
    const sourceTextarea = elem.querySelector(".typst-source");

    // Scale state for this element
    const scaleState = {
      scale: 1.0,
      mode: "fit-width" // "fit-width", "full-page", or "manual"
    };

    // Get initial code
    let initialCode = "";
    if (editor) {
      // Edit mode - code is in the editor
      // Wait for code-input to load
      editor.addEventListener("code-input_load", async () => {
        // Check for stored code
        const result = await store.typst?.get(id);
        if (result) {
          editor.value = result.code;
        }
        initialCode = editor.value;
        renderTypst(initialCode, preview, loadingIndicator, scaleState);

        // Listen for input changes
        editor.addEventListener("input", () => {
          store.typst?.put({ id, code: editor.value });
          renderTypst(editor.value, preview, loadingIndicator, scaleState);
        });
      });
    } else if (sourceTextarea) {
      // Preview mode - code is in hidden textarea
      initialCode = sourceTextarea.value;
      loadTypst().then(() => {
        renderTypst(initialCode, preview, loadingIndicator, scaleState);
      });
    }

    // Zoom in button
    zoomInBtn?.addEventListener("click", () => {
      scaleState.mode = "manual";
      scaleState.scale = Math.min(scaleState.scale + 0.25, 5.0);
      applyScale(preview, scaleState);
    });

    // Zoom out button
    zoomOutBtn?.addEventListener("click", () => {
      scaleState.mode = "manual";
      scaleState.scale = Math.max(scaleState.scale - 0.25, 0.25);
      applyScale(preview, scaleState);
    });

    // Fit width button
    fitWidthBtn?.addEventListener("click", () => {
      scaleState.mode = "fit-width";
      applyScale(preview, scaleState);
    });

    // Full page button
    fullPageBtn?.addEventListener("click", () => {
      scaleState.mode = "full-page";
      applyScale(preview, scaleState);
    });

    // Download PDF button
    downloadBtn?.addEventListener("click", async () => {
      const code = editor ? editor.value : initialCode;
      await exportPdf(code, id);
    });

    // Copy button
    copyBtn?.addEventListener("click", async () => {
      const code = editor ? editor.value : initialCode;
      try {
        await navigator.clipboard.writeText(code);
      } catch (error) {
        console.error("Copy error:", error);
      }
    });

    // Reset button (edit mode only)
    resetBtn?.addEventListener("click", async () => {
      if (window.confirm(i18n.get("typst-reset-prompt") || "Are you sure you want to reset the code?")) {
        store.typst?.delete(id);
        window.location.reload();
      }
    });
  }

  return {};
})();
