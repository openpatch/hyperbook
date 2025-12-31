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

  // Render typst code to SVG
  const renderTypst = async (code, container, loadingIndicator) => {
    // Show loading indicator
    if (loadingIndicator) {
      loadingIndicator.style.display = "flex";
    }

    await loadTypst();
    
    try {
      const svg = await $typst.svg({ mainContent: code });
      container.innerHTML = svg;

      // Scale SVG to fit container
      const svgElem = container.firstElementChild;
      if (svgElem) {
        const width = Number.parseFloat(svgElem.getAttribute("width"));
        const height = Number.parseFloat(svgElem.getAttribute("height"));
        const containerWidth = container.clientWidth - 20;
        if (width > 0 && containerWidth > 0) {
          svgElem.setAttribute("width", containerWidth);
          svgElem.setAttribute("height", (height * containerWidth) / width);
        }
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
    const sourceTextarea = elem.querySelector(".typst-source");

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
        renderTypst(initialCode, preview, loadingIndicator);

        // Listen for input changes
        editor.addEventListener("input", () => {
          store.typst?.put({ id, code: editor.value });
          renderTypst(editor.value, preview, loadingIndicator);
        });
      });
    } else if (sourceTextarea) {
      // Preview mode - code is in hidden textarea
      initialCode = sourceTextarea.value;
      loadTypst().then(() => {
        renderTypst(initialCode, preview, loadingIndicator);
      });
    }

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
