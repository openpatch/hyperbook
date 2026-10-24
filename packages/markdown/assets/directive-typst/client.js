hyperbook.typst = (function () {
  'use strict';

  // ============================================================================
  // CONSTANTS AND CONFIGURATION
  // ============================================================================
  
  const assetBase = new URL(
    "directive-typst/",
    new URL(HYPERBOOK_ASSETS, document.baseURI),
  );
  const runtime = JSON.parse(document.getElementsByClassName("directive-typst")[0]?.getAttribute("data-runtime") || "{}");
  const CONFIG = {
    TYPST_COMPILER_URL: runtime.compiler || new URL("typst-compiler.wasm", assetBase).href,
    TYPST_RENDERER_URL: runtime.renderer || new URL("typst-renderer.wasm", assetBase).href,
    TYPST_BUNDLE_URL: runtime.bundle || new URL("typst-bundle.js", assetBase).href,
    DEBOUNCE_DELAY: 500,
    TYPST_CHECK_INTERVAL: 50,
    CONTAINER_PADDING: 20,
  };

  const REGEX_PATTERNS = {
    READ: /read\s*\(\s*(['"])([^'"]+)\1[^)]*\)/gi,
    CSV: /csv\s*\(\s*(['"])([^'"]+)\1[^)]*\)/gi,
    JSON: /json\s*\(\s*(['"])([^'"]+)\1[^)]*\)/gi,
    YAML: /yaml\s*\(\s*(['"])([^'"]+)\1[^)]*\)/gi,
    XML: /xml\s*\(\s*(['"])([^'"]+)\1[^)]*\)/gi,
    IMAGE: /image\s*\(\s*(['"])([^'"]+)\1[^)]*\)/gi,
    ABSOLUTE_URL: /^(https?:|data:|blob:)/i,
    ERROR_MESSAGE: /message:\s*"([^"]+)"/,
  };

  // Text file patterns that need UTF-8 encoding
  const TEXT_PATTERNS = ['READ', 'CSV', 'JSON', 'YAML', 'XML'];

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Debounce utility function
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @returns {Function} Debounced function
   */
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  /**
   * Normalize path to ensure it starts with /
   * @param {string} path - Path to normalize
   * @returns {string} Normalized path
   */
  const normalizePath = (path) => {
    if (!path) return '/';
    return path.startsWith('/') ? path : `/${path}`;
  };

  /**
   * Construct full URL from base path and relative path
   * @param {string} path - Relative or absolute path
   * @param {string} basePath - Base path for absolute paths
   * @param {string} pagePath - Page path for relative paths
   * @returns {string} Full URL
   */
  const constructUrl = (path, basePath, pagePath) => {
    if (path.startsWith('/')) {
      return basePath ? `${basePath}${path}`.replace(/\/+/g, '/') : path;
    }
    return pagePath ? `${pagePath}/${path}`.replace(/\/+/g, '/') : path;
  };

  /**
   * Get localized string with fallback
   * @param {string} key - Translation key
   * @param {string} fallback - Fallback text
   * @returns {string} Localized or fallback text
   */
  const i18nGet = (key, fallback = '') => {
    return hyperbook.i18n.get(key, undefined, fallback);
  };

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  // ============================================================================
  // TYPST LOADER
  // ============================================================================

  class TypstLoader {
    constructor() {
      this.loaded = false;
      this.loadPromise = null;
      this.loadedFonts = new Set();
    }

    /**
     * Load Typst compiler and renderer
     * @param {Array} fontFiles - Array of font file objects
     * @returns {Promise<void>}
     */
    async load({ fontFiles = [] } = {}) {
      if (this.loaded) {
        return Promise.resolve();
      }

      if (this.loadPromise) {
        return this.loadPromise;
      }

      this.loadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = CONFIG.TYPST_BUNDLE_URL;
        script.type = 'module';
        script.id = 'typst-loader';

        script.onload = () => {
          this.waitForTypst(fontFiles)
            .then(resolve)
            .catch(reject);
        };

        script.onerror = () => {
          reject(new Error('Failed to load Typst bundle'));
        };

        document.head.appendChild(script);
      });

      return this.loadPromise;
    }

    /**
     * Wait for Typst module to initialize
     * @param {Array} fontFiles - Array of font file objects
     * @returns {Promise<void>}
     */
    async waitForTypst(fontFiles) {
      return new Promise((resolve, reject) => {
        const checkTypst = async () => {
          if (typeof window.$typst !== 'undefined') {
            try {
              await this.initializeTypst(fontFiles);
              this.loaded = true;
              resolve();
            } catch (error) {
              reject(error);
            }
          } else {
            setTimeout(checkTypst, CONFIG.TYPST_CHECK_INTERVAL);
          }
        };
        checkTypst();
      });
    }

    /**
     * Initialize Typst compiler and renderer with fonts
     * @param {Array} fontFiles - Array of font file objects
     * @returns {Promise<void>}
     */
    async initializeTypst(fontFiles) {
      const fonts = window.TypstCompileModule.loadFonts(
        fontFiles.map((f) => f.url),
        {
          assets: ["text"],
          assetUrlPrefix: { text: runtime.fonts || new URL("fonts/", assetBase).href },
        },
      );

      window.$typst.setCompilerInitOptions({
        beforeBuild: [fonts],
        getModule: () => CONFIG.TYPST_COMPILER_URL,
      });

      window.$typst.setRendererInitOptions({
        beforeBuild: [fonts],
        getModule: () => CONFIG.TYPST_RENDERER_URL,
      });
    }
  }

  // ============================================================================
  // RENDER QUEUE
  // ============================================================================

  class RenderQueue {
    constructor() {
      this.queue = Promise.resolve();
    }

    /**
     * Add render function to queue
     * @param {Function} renderFn - Async render function
     * @returns {Promise}
     */
    add(renderFn) {
      this.queue = this.queue
        .then(renderFn)
        .catch((error) => {
          console.error('Queued render error:', error);
        });
      return this.queue;
    }
  }

  // ============================================================================
  // ASSET MANAGEMENT
  // ============================================================================

  class AssetManager {
    constructor() {
      this.cache = new Map(); // filepath -> Uint8Array | null
    }

    /**
     * Extract relative file paths from Typst source code
     * @param {string} src - Typst source code
     * @returns {Array<{path: string, isText: boolean}>} Array of file paths with type info
     */
    extractFilePaths(src) {
      const paths = new Map(); // path -> isText

      for (const [name, pattern] of Object.entries(REGEX_PATTERNS)) {
        if (name === 'ABSOLUTE_URL' || name === 'ERROR_MESSAGE') continue;
        
        const isText = TEXT_PATTERNS.includes(name);
        let match;
        // Reset regex lastIndex
        pattern.lastIndex = 0;
        
        while ((match = pattern.exec(src)) !== null) {
          const path = match[2];
          // Skip absolute URLs, data URLs, blob URLs
          if (REGEX_PATTERNS.ABSOLUTE_URL.test(path)) continue;
          paths.set(path, isText);
        }
      }

      return Array.from(paths.entries()).map(([path, isText]) => ({ path, isText }));
    }

    /**
     * Fetch single asset from server
     * @param {string} path - Asset path
     * @param {string} basePath - Base path
     * @param {string} pagePath - Page path
     * @param {boolean} isText - Whether this is a text file
     * @returns {Promise<Uint8Array|null>}
     */
    async fetchAsset(path, basePath, pagePath, isText = false) {
      try {
        const url = constructUrl(path, basePath, pagePath);
        const response = await fetch(url);

        if (!response.ok) {
          console.warn(`Asset not found: ${path} at ${url} (HTTP ${response.status})`);
          return null;
        }

        if (isText) {
          // For text files, decode as text and re-encode as UTF-8
          const text = await response.text();
          return new TextEncoder().encode(text);
        } else {
          // For binary files, use arrayBuffer directly
          const arrayBuffer = await response.arrayBuffer();
          return new Uint8Array(arrayBuffer);
        }
      } catch (error) {
        console.warn(`Error loading asset ${path}:`, error);
        return null;
      }
    }

    /**
     * Fetch multiple assets and cache them
     * @param {Array<{path: string, isText: boolean}>} pathInfos - Array of path info objects
     * @param {string} basePath - Base path
     * @param {string} pagePath - Page path
     * @returns {Promise<void>}
     */
    async fetchAssets(pathInfos, basePath, pagePath) {
      const missingPaths = pathInfos.filter(({ path }) => !this.cache.has(path));
      
      await Promise.all(
        missingPaths.map(async ({ path, isText }) => {
          const data = await this.fetchAsset(path, basePath, pagePath, isText);
          this.cache.set(path, data);
        })
      );
    }

    /**
     * Build Typst preamble with inlined assets as bytes
     * @returns {string} Typst preamble code
     */
    buildAssetsPreamble() {
      if (this.cache.size === 0) return "";
      const entries = [...this.cache.entries()]
        .filter(([name, u8]) => u8 !== null)
        .map(([name, u8]) => {
          const nums = Array.from(u8).join(",");
          return `  "${name}": bytes((${nums}))`;
        })
        .join(",\n");
      if (!entries) return "";
      return `#let __assets = (\n${entries}\n)\n\n`;
    }

    /**
     * Rewrite file calls (image, read, csv, json, yaml, xml) to use inlined assets
     * @param {string} src - Typst source code
     * @returns {string} Rewritten source code
     */
    rewriteAssetCalls(src) {
      if (this.cache.size === 0) return src;

      // Rewrite image() calls
      src = src.replace(/image\s*\(\s*(['"])([^'"]+)\1/g, (m, q, fname) => {
        if (this.cache.has(fname)) {
          const asset = this.cache.get(fname);
          if (asset === null) {
            return `[File not found: _${fname}_]`;
          }
          return `image(__assets.at("${fname}")`;
        }
        return m;
      });

      // Rewrite read() calls
      src = src.replace(/read\s*\(\s*(['"])([^'"]+)\1/g, (m, q, fname) => {
        if (this.cache.has(fname)) {
          const asset = this.cache.get(fname);
          if (asset === null) {
            return `[File not found: _${fname}_]`;
          }
          return `read(__assets.at("${fname}")`;
        }
        return m;
      });

      // Rewrite csv() calls
      src = src.replace(/csv\s*\(\s*(['"])([^'"]+)\1/g, (m, q, fname) => {
        if (this.cache.has(fname)) {
          const asset = this.cache.get(fname);
          if (asset === null) {
            return `[File not found: _${fname}_]`;
          }
          return `csv(__assets.at("${fname}")`;
        }
        return m;
      });

      // Rewrite json() calls
      src = src.replace(/json\s*\(\s*(['"])([^'"]+)\1/g, (m, q, fname) => {
        if (this.cache.has(fname)) {
          const asset = this.cache.get(fname);
          if (asset === null) {
            return `[File not found: _${fname}_]`;
          }
          return `json(__assets.at("${fname}")`;
        }
        return m;
      });

      // Rewrite yaml() calls
      src = src.replace(/yaml\s*\(\s*(['"])([^'"]+)\1/g, (m, q, fname) => {
        if (this.cache.has(fname)) {
          const asset = this.cache.get(fname);
          if (asset === null) {
            return `[File not found: _${fname}_]`;
          }
          return `yaml(__assets.at("${fname}")`;
        }
        return m;
      });

      // Rewrite xml() calls
      src = src.replace(/xml\s*\(\s*(['"])([^'"]+)\1/g, (m, q, fname) => {
        if (this.cache.has(fname)) {
          const asset = this.cache.get(fname);
          if (asset === null) {
            return `[File not found: _${fname}_]`;
          }
          return `xml(__assets.at("${fname}")`;
        }
        return m;
      });

      return src;
    }

    /**
     * Prepare assets for rendering (extract and fetch)
     * @param {string} mainSrc - Main Typst source
     * @param {Array} sourceFiles - Source file objects
     * @param {string} basePath - Base path
     * @param {string} pagePath - Page path
     * @returns {Promise<void>}
     */
    async prepare(mainSrc, sourceFiles, basePath, pagePath) {
      const allPaths = new Map(); // path -> isText

      // Extract from main source
      for (const { path, isText } of this.extractFilePaths(mainSrc)) {
        allPaths.set(path, isText);
      }

      // Extract from all source files
      for (const { content } of sourceFiles) {
        for (const { path, isText } of this.extractFilePaths(content)) {
          allPaths.set(path, isText);
        }
      }

      const pathInfos = Array.from(allPaths.entries()).map(([path, isText]) => ({ path, isText }));
      
      if (pathInfos.length > 0) {
        await this.fetchAssets(pathInfos, basePath, pagePath);
      }
    }
  }

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  class ErrorHandler {
    /**
     * Parse error message from SourceDiagnostic format
     * @param {string|Error} error - Error object or message
     * @returns {string} Parsed error message
     */
    static parse(error) {
      const errorMessage = error?.toString() || 'Unknown error';
      
      try {
        const match = errorMessage.match(REGEX_PATTERNS.ERROR_MESSAGE);
        if (match) {
          return match[1];
        }
      } catch (e) {
        // Fallback to original message
      }
      
      return errorMessage;
    }

    /**
     * Display error overlay in preview container
     * @param {HTMLElement} previewContainer - Preview container element
     * @param {string} errorText - Error message
     */
    static showOverlay(previewContainer, errorText) {
      // Remove any existing error overlay
      const existingError = previewContainer.querySelector('.typst-error-overlay');
      if (existingError) {
        existingError.remove();
      }

      // Create floating error overlay
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
      closeBtn.addEventListener('click', () => errorOverlay.remove());

      previewContainer.appendChild(errorOverlay);
    }

    /**
     * Display error inline
     * @param {HTMLElement} container - Container element
     * @param {string} errorText - Error message
     */
    static showInline(container, errorText) {
      container.innerHTML = `<div class="typst-error">${errorText}</div>`;
    }
  }

  // ============================================================================
  // BINARY FILE HANDLER
  // ============================================================================

  class BinaryFileHandler {
    /**
     * Load binary file from URL
     * @param {string} url - File URL (data URL or HTTP URL)
     * @returns {Promise<ArrayBuffer>}
     */
    static async load(url) {
      const response = await fetch(url);
      
      if (!response.ok && !url.startsWith('data:')) {
        throw new Error(`Failed to load binary file: ${url}`);
      }
      
      return response.arrayBuffer();
    }

    /**
     * Add binary files to Typst shadow filesystem
     * @param {Array} binaryFiles - Array of binary file objects
     * @returns {Promise<void>}
     */
    static async addToShadow(binaryFiles) {
      await Promise.all(
        binaryFiles.map(async ({ dest, url }) => {
          try {
            const arrayBuffer = await BinaryFileHandler.load(url);
            const path = dest.startsWith('/') ? dest.substring(1) : dest;
            window.$typst.mapShadow(`/${path}`, new Uint8Array(arrayBuffer));
          } catch (error) {
            console.warn(`Error loading binary file ${url}:`, error);
          }
        })
      );
    }
  }

  // ============================================================================
  // TYPST RENDERER
  // ============================================================================

  class TypstRenderer {
    constructor(loader, assetManager, renderQueue) {
      this.loader = loader;
      this.assetManager = assetManager;
      this.renderQueue = renderQueue;
    }

    /**
     * Add source files to Typst
     * @param {Array} sourceFiles - Source file objects
     * @returns {Promise<void>}
     */
    async addSourceFiles(sourceFiles) {
      for (const { filename, content } of sourceFiles) {
        const path = filename.startsWith('/') ? filename.substring(1) : filename;
        await window.$typst.addSource(`/${path}`, content);
      }
    }

    /**
     * Scale SVG to fit container
     * @param {HTMLElement} container - Container element
     */
    scaleSvg(container) {
      const svgElem = container.firstElementChild;
      if (!svgElem) return;

      const width = Number.parseFloat(svgElem.getAttribute('width'));
      const height = Number.parseFloat(svgElem.getAttribute('height'));
      const containerWidth = container.clientWidth - CONFIG.CONTAINER_PADDING;

      if (width > 0 && containerWidth > 0) {
        svgElem.setAttribute('width', containerWidth);
        svgElem.setAttribute('height', (height * containerWidth) / width);
      }
    }

    /**
     * Render Typst code to SVG
     * @param {Object} params - Render parameters
     * @returns {Promise<void>}
     */
    async render({
      code,
      container,
      loadingIndicator,
      sourceFiles,
      binaryFiles,
      fontFiles,
      id,
      previewContainer,
      basePath,
      pagePath,
      mainPath,
    }) {
      return this.renderQueue.add(async () => {
        try {
          // Show loading indicator
          if (loadingIndicator) {
            loadingIndicator.style.display = 'flex';
          }

          await this.loader.load({ fontFiles });

          // Reset shadow files
          window.$typst.resetShadow();

          // Prepare assets
          await this.assetManager.prepare(code, sourceFiles, basePath, pagePath);

          // Build assets preamble and rewrite source files
          const assetsPreamble = this.assetManager.buildAssetsPreamble();
          const rewrittenCode = this.assetManager.rewriteAssetCalls(code);
          const rewrittenSourceFiles = sourceFiles.map(({ filename, content }) => ({
            filename,
            content: assetsPreamble + this.assetManager.rewriteAssetCalls(content),
          }));

          // Add source files with rewritten content (includes preamble)
          await this.addSourceFiles(rewrittenSourceFiles);

          // Add binary files
          await BinaryFileHandler.addToShadow(binaryFiles);

          // Compile the main file by its path: relative #include and
          // #image only resolve inside the project, which inline
          // mainContent is not part of.
          const svg = await window.$typst.svg(
            mainPath
              ? { mainFilePath: mainPath }
              : { mainContent: assetsPreamble + rewrittenCode },
          );

          // Clear any existing errors
          if (previewContainer) {
            const existingError = previewContainer.querySelector('.typst-error-overlay');
            if (existingError) {
              existingError.remove();
            }
          }

          // Update container with SVG
          container.innerHTML = svg;
          this.scaleSvg(container);

        } catch (error) {
          const errorText = ErrorHandler.parse(error);
          const hasExistingContent = container.querySelector('svg') !== null;

          if (previewContainer) {
            // Don't clear existing content on error
            if (!hasExistingContent) {
              container.innerHTML = '';
            }
            ErrorHandler.showOverlay(previewContainer, errorText);
          } else {
            ErrorHandler.showInline(container, errorText);
          }

        } finally {
          // Hide loading indicator
          if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
          }
        }
      });
    }

    /**
     * Export Typst code to PDF
     * @param {Object} params - Export parameters
     * @returns {Promise<void>}
     */
    async exportPdf({
      code,
      id,
      sourceFiles,
      binaryFiles,
      fontFiles,
      basePath,
      pagePath,
      mainPath,
    }) {
      return this.renderQueue.add(async () => {
        try {
          await this.loader.load({ fontFiles });

          // Reset shadow files
          window.$typst.resetShadow();

          // Prepare assets
          await this.assetManager.prepare(code, sourceFiles, basePath, pagePath);

          // Build assets preamble and rewrite source files
          const assetsPreamble = this.assetManager.buildAssetsPreamble();
          const rewrittenCode = this.assetManager.rewriteAssetCalls(code);
          const rewrittenSourceFiles = sourceFiles.map(({ filename, content }) => ({
            filename,
            content: assetsPreamble + this.assetManager.rewriteAssetCalls(content),
          }));

          // Add source files with rewritten content (includes preamble)
          await this.addSourceFiles(rewrittenSourceFiles);

          // Add binary files
          await BinaryFileHandler.addToShadow(binaryFiles);

          const pdfData = await window.$typst.pdf(
            mainPath
              ? { mainFilePath: mainPath }
              : { mainContent: assetsPreamble + rewrittenCode },
          );
          const pdfBlob = new Blob([pdfData], { type: 'application/pdf' });
          
          // Download PDF
          const link = document.createElement('a');
          link.href = URL.createObjectURL(pdfBlob);
          link.download = `typst-${id}.pdf`;
          link.click();
          URL.revokeObjectURL(link.href);

        } catch (error) {
          console.error('PDF export error:', error);
          alert(i18nGet('typst-pdf-error', 'Error exporting PDF'));
        }
      });
    }
  }

  // ============================================================================
  // WORKSPACE
  // ============================================================================

  /**
   * Decodes the `data-workspace` attribute for a document shown without the
   * IDE shell.
   * @param {string | null} attribute
   */
  const decodeWorkspace = (attribute) => {
    if (!attribute) return { main: 'main.typ', files: [] };
    const bytes = Uint8Array.from(atob(attribute), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder('utf-8').decode(bytes));
  };

  /**
   * What the renderer needs from a workspace: the main source, the other
   * sources, the binary files and the fonts.
   * @param {{path: string, content?: string, url?: string, font?: boolean}[]} files
   * @param {string} main
   */
  const renderInput = (all, main) => {
    const files = all.filter((f) => !f.role);
    return {
    code: files.find((f) => f.path === main)?.content ?? '',
    mainPath: `/${main}`,
    sourceFiles: files
      .filter((f) => typeof f.content === 'string')
      .map((f) => ({ filename: f.path, content: f.content })),
    binaryFiles: files
      .filter((f) => typeof f.content !== 'string' && f.url && !f.font)
      .map((f) => ({ dest: f.path, url: f.url })),
    fontFiles: files
      .filter((f) => f.font && f.url)
      .map((f) => ({ url: f.url })),
    };
  };

  /** Downloads the workspace as a ZIP, for a document shown without the shell. */
  const downloadProject = async (files, id) => {
    const encoder = new TextEncoder();
    const zipFiles = {};
    for (const file of files) {
      if (file.font) continue;
      if (typeof file.content === 'string') {
        zipFiles[file.path] = encoder.encode(file.content);
        continue;
      }
      try {
        const response = await fetch(file.url);
        if (response.ok) {
          zipFiles[file.path] = new Uint8Array(await response.arrayBuffer());
        }
      } catch (error) {
        console.warn(`Could not add ${file.path} to the download:`, error);
      }
    }
    const blob = new Blob([window.UZIP.encode(zipFiles)], {
      type: 'application/zip',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `typst-project-${id}.zip`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // ============================================================================
  // MAIN INITIALIZATION
  // ============================================================================

  const typstLoader = new TypstLoader();
  const renderQueue = new RenderQueue();
  const assetManager = new AssetManager();
  const renderer = new TypstRenderer(typstLoader, assetManager, renderQueue);

  const initElement = (elem) => {
    if (elem.getAttribute('data-typst-initialized') === 'true') return;
    elem.setAttribute('data-typst-initialized', 'true');

    const id = elem.getAttribute('data-id');
    const basePath = normalizePath(elem.getAttribute('data-base-path') || '');
    const pagePath = normalizePath(elem.getAttribute('data-page-path') || '');
    const previewContainer = elem.querySelector('.preview-container');
    const preview = elem.querySelector('.typst-preview');
    const loadingIndicator = elem.querySelector('.typst-loading');
    const editor = elem.querySelector('.editor');

    const page = decodeWorkspace(elem.getAttribute('data-workspace'));
    let currentFiles = () => page.files;
    let currentMain = () => page.main;

    const render = () =>
      renderer.render({
        ...renderInput(currentFiles(), currentMain()),
        container: preview,
        loadingIndicator,
        id,
        previewContainer,
        basePath,
        pagePath,
      });

    elem.querySelector('.download-pdf')?.addEventListener('click', () =>
      renderer.exportPdf({
        ...renderInput(currentFiles(), currentMain()),
        id,
        basePath,
        pagePath,
      }),
    );

    if (!editor) {
      elem
        .querySelector('.download-project')
        ?.addEventListener('click', () => downloadProject(page.files, id));
      render();
      return;
    }

    const ide = HyperbookIDE.mount(elem, {
      id,
      runtime: 'typst',
      editor,
      workspace: elem.getAttribute('data-workspace'),
      buttons: {
        reset: elem.querySelector('button.reset'),
        copy: elem.querySelector('button.copy'),
        download: elem.querySelector('button.download'),
        fullscreen: elem.querySelector('button.fullscreen'),
      },
      layout: {
        container: previewContainer,
        editorContainer: elem.querySelector('.editor-container'),
        splitter: elem.querySelector('.splitter'),
      },
      onChange: debounce(render, CONFIG.DEBOUNCE_DELAY),
    });
    currentFiles = () => ide.files();
    currentMain = () => ide.main;
    ide.ready.then(render);
  };

  for (const elem of document.getElementsByClassName('directive-typst')) {
    initElement(elem);
  }

  return {};
})();
