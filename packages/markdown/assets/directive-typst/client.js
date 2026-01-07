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

  // Rendering queue to ensure only one render at a time
  let renderQueue = Promise.resolve();

  const queueRender = (renderFn) => {
    renderQueue = renderQueue.then(renderFn).catch((error) => {
      console.error("Queued render error:", error);
    });
    return renderQueue;
  };

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

  // Parse error message from SourceDiagnostic format
  const parseTypstError = (errorMessage) => {
    try {
      // Try to extract message from SourceDiagnostic format
      const match = errorMessage.match(/message:\s*"([^"]+)"/);
      if (match) {
        return match[1];
      }
    } catch (e) {
      // Fallback to original message
    }
    return errorMessage;
  };

  // Render typst code to SVG
  const renderTypst = async (code, container, loadingIndicator, sourceFiles, binaryFiles, id, previewContainer) => {
    // Queue this render to ensure only one compilation runs at a time
    return queueRender(async () => {
      // Show loading indicator
      if (loadingIndicator) {
        loadingIndicator.style.display = "flex";
      }

      await loadTypst();
      
      try {
        // Reset shadow files for this render
        $typst.resetShadow();

        // Add source files
        for (const { filename, content } of sourceFiles) {
          const path = filename.startsWith('/') ? filename.substring(1) : filename;
          await $typst.addSource(`/${path}`, content);
        }

        // Add binary files
        for (const { dest, url } of binaryFiles) {
          try {
            let arrayBuffer;
            
            // Check if URL is a data URL (user-uploaded file)
            if (url.startsWith('data:')) {
              const response = await fetch(url);
              arrayBuffer = await response.arrayBuffer();
            } else {
              // External URL
              const response = await fetch(url);
              if (!response.ok) {
                console.warn(`Failed to load binary file: ${url}`);
                continue;
              }
              arrayBuffer = await response.arrayBuffer();
            }
            
            const path = dest.startsWith('/') ? dest.substring(1) : dest;
            $typst.mapShadow(`/${path}`, new Uint8Array(arrayBuffer));
          } catch (error) {
            console.warn(`Error loading binary file ${url}:`, error);
          }
        }

        const svg = await $typst.svg({ mainContent: code });
        
        // Remove any existing error overlay from preview-container
        if (previewContainer) {
          const existingError = previewContainer.querySelector('.typst-error-overlay');
          if (existingError) {
            existingError.remove();
          }
        }
        
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
        const errorText = parseTypstError(error || "Error rendering Typst");
        
        // Check if we have existing content (previous successful render)
        const hasExistingContent = container.querySelector('svg') !== null;
        
        // Always use error overlay in preview-container if available
        if (previewContainer) {
          // Remove any existing error overlay
          const existingError = previewContainer.querySelector('.typst-error-overlay');
          if (existingError) {
            existingError.remove();
          }
          
          // Clear preview if no existing content
          if (!hasExistingContent) {
            container.innerHTML = '';
          }
          
          // Create floating error overlay in preview-container
          const errorOverlay = document.createElement('div');
          errorOverlay.className = 'typst-error-overlay';
          errorOverlay.innerHTML = `
            <div class="typst-error-content">
              <div class="typst-error-header">
                <span class="typst-error-title">⚠️ Typst Error</span>
                <button class="typst-error-close" title="Dismiss error">×</button>
              </div>
              <div class="typst-error-message">${errorText}</div>
            </div>
          `;
          
          // Add close button functionality
          const closeBtn = errorOverlay.querySelector('.typst-error-close');
          closeBtn.addEventListener('click', () => {
            errorOverlay.remove();
          });
          
          previewContainer.appendChild(errorOverlay);
        } else {
          // Fallback: show error in preview container directly
          container.innerHTML = `<div class="typst-error">${errorText}</div>`;
        }
      } finally {
        // Hide loading indicator
        if (loadingIndicator) {
          loadingIndicator.style.display = "none";
        }
      }
    });
  };

  // Export to PDF
  const exportPdf = async (code, id, sourceFiles, binaryFiles) => {
    // Queue this export to ensure only one compilation runs at a time
    return queueRender(async () => {
      await loadTypst();
      
      try {
        // Reset shadow files for this export
        $typst.resetShadow();

        // Add source files
        for (const { filename, content } of sourceFiles) {
          const path = filename.startsWith('/') ? filename.substring(1) : filename;
          await $typst.addSource(`/${path}`, content);
        }

        // Add binary files
        for (const { dest, url } of binaryFiles) {
          try {
            let arrayBuffer;
            
            // Check if URL is a data URL (user-uploaded file)
            if (url.startsWith('data:')) {
              const response = await fetch(url);
              arrayBuffer = await response.arrayBuffer();
            } else {
              // External URL
              const response = await fetch(url);
              if (!response.ok) {
                continue;
              }
              arrayBuffer = await response.arrayBuffer();
            }
            
            const path = dest.startsWith('/') ? dest.substring(1) : dest;
            $typst.mapShadow(`/${path}`, new Uint8Array(arrayBuffer));
          } catch (error) {
            console.warn(`Error loading binary file ${url}:`, error);
          }
        }

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
    });
  };

  for (let elem of elems) {
    const id = elem.getAttribute("data-id");
    const previewContainer = elem.querySelector(".preview-container");
    const preview = elem.querySelector(".typst-preview");
    const loadingIndicator = elem.querySelector(".typst-loading");
    const editor = elem.querySelector(".editor.typst");
    const downloadBtn = elem.querySelector(".download-pdf");
    const downloadProjectBtn = elem.querySelector(".download-project");
    const resetBtn = elem.querySelector(".reset");
    const sourceTextarea = elem.querySelector(".typst-source");
    const tabsList = elem.querySelector(".tabs-list");
    const binaryFilesList = elem.querySelector(".binary-files-list");
    const addSourceFileBtn = elem.querySelector(".add-source-file");
    const addBinaryFileBtn = elem.querySelector(".add-binary-file");

    // Parse source files and binary files from data attributes
    const sourceFilesData = elem.getAttribute("data-source-files");
    const binaryFilesData = elem.getAttribute("data-binary-files");
    
    let sourceFiles = sourceFilesData 
      ? JSON.parse(atob(sourceFilesData))
      : [];
    let binaryFiles = binaryFilesData 
      ? JSON.parse(atob(binaryFilesData))
      : [];

    // Track current active file
    let currentFile = sourceFiles.find(f => f.filename === "main.typ" || f.filename === "main.typst") || sourceFiles[0];
    
    // Store file contents in memory
    const fileContents = new Map();
    sourceFiles.forEach(f => fileContents.set(f.filename, f.content));

    // Function to update tabs UI
    const updateTabs = () => {
      if (!tabsList) return;
      
      tabsList.innerHTML = "";
      
      // Add source file tabs
      sourceFiles.forEach(file => {
        const tab = document.createElement("div");
        tab.className = "file-tab";
        if (file.filename === currentFile.filename) {
          tab.classList.add("active");
        }
        
        const tabName = document.createElement("span");
        tabName.className = "tab-name";
        tabName.textContent = file.filename;
        tab.appendChild(tabName);
        
        // Add delete button (except for main file)
        if (file.filename !== "main.typ" && file.filename !== "main.typst") {
          const deleteBtn = document.createElement("button");
          deleteBtn.className = "tab-delete";
          deleteBtn.textContent = "×";
          deleteBtn.title = i18n.get("typst-delete-file") || "Delete file";
          deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (confirm(`${i18n.get("typst-delete-confirm") || "Delete"} ${file.filename}?`)) {
              sourceFiles = sourceFiles.filter(f => f.filename !== file.filename);
              fileContents.delete(file.filename);
              
              // Switch to main file if we deleted the current file
              if (currentFile.filename === file.filename) {
                currentFile = sourceFiles[0];
                if (editor) {
                  editor.value = fileContents.get(currentFile.filename) || "";
                }
              }
              
              updateTabs();
              saveState();
              rerenderTypst();
            }
          });
          tab.appendChild(deleteBtn);
        }
        
        tab.addEventListener("click", () => {
          if (currentFile.filename !== file.filename) {
            // Save current file content
            if (editor) {
              fileContents.set(currentFile.filename, editor.value);
            }
            
            // Switch to new file
            currentFile = file;
            if (editor) {
              editor.value = fileContents.get(currentFile.filename) || "";
            }
            
            updateTabs();
            saveState();
          }
        });
        
        tabsList.appendChild(tab);
      });
    };

    // Function to update binary files list
    const updateBinaryFilesList = () => {
      if (!binaryFilesList) return;
      
      binaryFilesList.innerHTML = "";
      
      if (binaryFiles.length === 0) {
        const emptyMsg = document.createElement("div");
        emptyMsg.className = "binary-files-empty";
        emptyMsg.textContent = i18n.get("typst-no-binary-files") || "No binary files";
        binaryFilesList.appendChild(emptyMsg);
        return;
      }
      
      binaryFiles.forEach(file => {
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
        deleteBtn.title = i18n.get("typst-delete-file") || "Delete file";
        deleteBtn.addEventListener("click", () => {
          if (confirm(`${i18n.get("typst-delete-confirm") || "Delete"} ${file.dest}?`)) {
            binaryFiles = binaryFiles.filter(f => f.dest !== file.dest);
            updateBinaryFilesList();
            saveState();
            rerenderTypst();
          }
        });
        item.appendChild(deleteBtn);
        
        binaryFilesList.appendChild(item);
      });
    };

    // Function to save state to store
    const saveState = async () => {
      if (!editor) return;
      
      // Update current file content
      fileContents.set(currentFile.filename, editor.value);
      
      // Update sourceFiles array with latest content
      sourceFiles = sourceFiles.map(f => ({
        filename: f.filename,
        content: fileContents.get(f.filename) || f.content
      }));
      
      await store.typst?.put({
        id,
        code: editor.value,
        sourceFiles,
        binaryFiles,
        currentFile: currentFile.filename
      });
    };

    // Function to rerender typst
    const rerenderTypst = () => {
      if (editor) {
        // Update sourceFiles with current editor content
        fileContents.set(currentFile.filename, editor.value);
        sourceFiles = sourceFiles.map(f => ({
          filename: f.filename,
          content: fileContents.get(f.filename) || f.content
        }));
        
        const mainFile = sourceFiles.find(f => f.filename === "main.typ" || f.filename === "main.typst");
        const mainCode = mainFile ? mainFile.content : "";
        renderTypst(mainCode, preview, loadingIndicator, sourceFiles, binaryFiles, id, previewContainer);
      }
    };

    // Add source file button
    addSourceFileBtn?.addEventListener("click", () => {
      const filename = prompt(i18n.get("typst-filename-prompt") || "Enter filename (e.g., helper.typ):");
      if (filename) {
        // Validate filename
        if (!filename.endsWith(".typ") && !filename.endsWith(".typst")) {
          alert(i18n.get("typst-filename-error") || "Filename must end with .typ or .typst");
          return;
        }
        
        if (sourceFiles.some(f => f.filename === filename)) {
          alert(i18n.get("typst-filename-exists") || "File already exists");
          return;
        }
        
        // Add new file
        const newFile = { filename, content: `// ${filename}\n` };
        sourceFiles.push(newFile);
        fileContents.set(filename, newFile.content);
        
        // Switch to new file
        if (editor) {
          fileContents.set(currentFile.filename, editor.value);
        }
        currentFile = newFile;
        if (editor) {
          editor.value = newFile.content;
        }
        
        updateTabs();
        saveState();
        rerenderTypst();
      }
    });

    // Add binary file button
    addBinaryFileBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*,.pdf";
      input.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (file) {
          const dest = `/${file.name}`;
          
          // Check if file already exists
          if (binaryFiles.some(f => f.dest === dest)) {
            if (!confirm(i18n.get("typst-file-replace") || `Replace existing ${dest}?`)) {
              return;
            }
            binaryFiles = binaryFiles.filter(f => f.dest !== dest);
          }
          
          // Read file as data URL
          const reader = new FileReader();
          reader.onload = async (e) => {
            const url = e.target.result;
            binaryFiles.push({ dest, url });
            updateBinaryFilesList();
            saveState();
            rerenderTypst();
          };
          reader.readAsDataURL(file);
        }
      });
      input.click();
    });

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
          
          // Restore sourceFiles and binaryFiles if available
          if (result.sourceFiles) {
            sourceFiles = result.sourceFiles;
            sourceFiles.forEach(f => fileContents.set(f.filename, f.content));
          }
          if (result.binaryFiles) {
            binaryFiles = result.binaryFiles;
          }
          if (result.currentFile) {
            currentFile = sourceFiles.find(f => f.filename === result.currentFile) || sourceFiles[0];
            editor.value = fileContents.get(currentFile.filename) || "";
          }
        }
        initialCode = editor.value;
        
        updateTabs();
        updateBinaryFilesList();
        rerenderTypst();

        // Listen for input changes
        editor.addEventListener("input", () => {
          saveState();
          rerenderTypst();
        });
      });
    } else if (sourceTextarea) {
      // Preview mode - code is in hidden textarea
      initialCode = sourceTextarea.value;
      loadTypst().then(() => {
        renderTypst(initialCode, preview, loadingIndicator, sourceFiles, binaryFiles, id, previewContainer);
      });
    }

    // Download PDF button
    downloadBtn?.addEventListener("click", async () => {
      // Get the main file content
      const mainFile = sourceFiles.find(f => f.filename === "main.typ" || f.filename === "main.typst");
      const code = mainFile ? mainFile.content : (editor ? editor.value : initialCode);
      await exportPdf(code, id, sourceFiles, binaryFiles);
    });

    // Download Project button (ZIP with all files)
    downloadProjectBtn?.addEventListener("click", async () => {
      // Get the main file content
      const mainFile = sourceFiles.find(f => f.filename === "main.typ" || f.filename === "main.typst");
      const code = mainFile ? mainFile.content : (editor ? editor.value : initialCode);
      const encoder = new TextEncoder();
      const zipFiles = {};

      // Add all source files
      for (const { filename, content } of sourceFiles) {
        const path = filename.startsWith('/') ? filename.substring(1) : filename;
        zipFiles[path] = encoder.encode(content);
      }

      // Add binary files
      for (const { dest, url } of binaryFiles) {
        try {
          let arrayBuffer;
          
          // Check if URL is a data URL (user-uploaded file)
          if (url.startsWith('data:')) {
            const response = await fetch(url);
            arrayBuffer = await response.arrayBuffer();
          } else {
            // External URL
            const response = await fetch(url);
            if (response.ok) {
              arrayBuffer = await response.arrayBuffer();
            } else {
              console.warn(`Failed to load binary file: ${url}`);
              continue;
            }
          }
          
          const path = dest.startsWith('/') ? dest.substring(1) : dest;
          zipFiles[path] = new Uint8Array(arrayBuffer);
        } catch (error) {
          console.warn(`Error loading binary file ${url}:`, error);
        }
      }

      // Create ZIP using UZIP
      const zipData = UZIP.encode(zipFiles);
      const zipBlob = new Blob([zipData], { type: "application/zip" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.download = `typst-project-${id}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
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
