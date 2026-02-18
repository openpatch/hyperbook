hyperbook.typst = (function () {
  'use strict';

  // ============================================================================
  // CONSTANTS AND CONFIGURATION
  // ============================================================================
  
  const CONFIG = {
    TYPST_COMPILER_URL: "https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm",
    TYPST_RENDERER_URL: "https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm",
    TYPST_BUNDLE_URL: "https://cdn.jsdelivr.net/npm/@myriaddreamin/typst.ts/dist/esm/contrib/all-in-one-lite.bundle.js",
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
    return window.i18n?.get(key) || fallback;
  };

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize code-input template for Typst syntax highlighting
   */
  const initializeCodeInput = () => {
    if (!window.codeInput) return;

    window.codeInput.registerTemplate(
      "typst-highlighted",
      window.codeInput.templates.prism(window.Prism, [
        new window.codeInput.plugins.AutoCloseBrackets(),
        new window.codeInput.plugins.Indent(true, 2),
      ])
    );
  };

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
        fontFiles.map((f) => f.url)
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

          // Render to SVG with preamble prepended
          const mainContent = assetsPreamble + rewrittenCode;
          const svg = await window.$typst.svg({ mainContent });

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

          // Generate PDF with preamble prepended
          const mainContent = assetsPreamble + rewrittenCode;
          const pdfData = await window.$typst.pdf({ mainContent });
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
  // FILE MANAGER
  // ============================================================================

  class FileManager {
    constructor(sourceFiles) {
      this.sourceFiles = sourceFiles;
      this.contents = new Map();
      this.currentFile = this.findMainFile() || sourceFiles[0];
      
      // Initialize contents map
      sourceFiles.forEach((f) => this.contents.set(f.filename, f.content));
    }

    /**
     * Find main Typst file
     * @returns {Object|null} Main file object
     */
    findMainFile() {
      return this.sourceFiles.find(
        (f) => f.filename === 'main.typ' || f.filename === 'main.typst'
      );
    }

    /**
     * Get current file content
     * @returns {string} File content
     */
    getCurrentContent() {
      return this.contents.get(this.currentFile.filename) || '';
    }

    /**
     * Update current file content
     * @param {string} content - New content
     */
    updateCurrentContent(content) {
      this.contents.set(this.currentFile.filename, content);
    }

    /**
     * Switch to different file
     * @param {string} filename - Target filename
     * @returns {string} New file content
     */
    switchTo(filename) {
      const file = this.sourceFiles.find((f) => f.filename === filename);
      if (file) {
        this.currentFile = file;
        return this.getCurrentContent();
      }
      return '';
    }

    /**
     * Add new source file
     * @param {string} filename - New filename
     * @param {string} content - File content
     * @returns {boolean} Success status
     */
    addFile(filename, content = `// ${filename}\n`) {
      if (this.sourceFiles.some((f) => f.filename === filename)) {
        return false;
      }

      const newFile = { filename, content };
      this.sourceFiles.push(newFile);
      this.contents.set(filename, content);
      this.currentFile = newFile;
      
      return true;
    }

    /**
     * Delete source file
     * @param {string} filename - Filename to delete
     * @returns {boolean} Success status
     */
    deleteFile(filename) {
      // Don't delete main file
      if (filename === 'main.typ' || filename === 'main.typst') {
        return false;
      }

      this.sourceFiles = this.sourceFiles.filter((f) => f.filename !== filename);
      this.contents.delete(filename);

      // Switch to main file if we deleted current file
      if (this.currentFile.filename === filename) {
        this.currentFile = this.sourceFiles[0];
      }

      return true;
    }

    /**
     * Get all source files with current content
     * @returns {Array} Updated source files
     */
    getSourceFiles() {
      return this.sourceFiles.map((f) => ({
        filename: f.filename,
        content: this.contents.get(f.filename) || f.content,
      }));
    }
  }

  // ============================================================================
  // PROJECT EXPORTER
  // ============================================================================

  class ProjectExporter {
    constructor(assetManager) {
      this.assetManager = assetManager;
    }

    /**
     * Export project as ZIP file
     * @param {Object} params - Export parameters
     * @returns {Promise<void>}
     */
    async export({ code, id, sourceFiles, binaryFiles, basePath, pagePath }) {
      try {
        const encoder = new TextEncoder();
        const zipFiles = {};

        // Add all source files
        for (const { filename, content } of sourceFiles) {
          const path = filename.startsWith('/') ? filename.substring(1) : filename;
          zipFiles[path] = encoder.encode(content);
        }

        // Add binary files
        await this.addBinaryFiles(zipFiles, binaryFiles, basePath, pagePath);

        // Add referenced assets
        await this.addAssets(zipFiles, code, basePath, pagePath);

        // Create and download ZIP
        this.downloadZip(zipFiles, id);

      } catch (error) {
        console.error('Project export error:', error);
        alert(i18nGet('typst-export-error', 'Error exporting project'));
      }
    }

    /**
     * Add binary files to ZIP
     * @param {Object} zipFiles - ZIP files object
     * @param {Array} binaryFiles - Binary files array
     * @param {string} basePath - Base path
     * @param {string} pagePath - Page path
     * @returns {Promise<void>}
     */
    async addBinaryFiles(zipFiles, binaryFiles, basePath, pagePath) {
      for (const { dest, url } of binaryFiles) {
        try {
          let arrayBuffer;

          if (url.startsWith('data:')) {
            const response = await fetch(url);
            arrayBuffer = await response.arrayBuffer();
          } else if (url.startsWith('http://') || url.startsWith('https://')) {
            const response = await fetch(url);
            if (!response.ok) continue;
            arrayBuffer = await response.arrayBuffer();
          } else {
            const fullUrl = constructUrl(url, basePath, pagePath);
            const response = await fetch(fullUrl);
            if (!response.ok) {
              console.warn(`Failed to load binary file: ${url} at ${fullUrl}`);
              continue;
            }
            arrayBuffer = await response.arrayBuffer();
          }

          const path = dest.startsWith('/') ? dest.substring(1) : dest;
          zipFiles[path] = new Uint8Array(arrayBuffer);
        } catch (error) {
          console.warn(`Error loading binary file ${url}:`, error);
        }
      }
    }

    /**
     * Add referenced assets to ZIP
     * @param {Object} zipFiles - ZIP files object
     * @param {string} code - Typst source code
     * @param {string} basePath - Base path
     * @param {string} pagePath - Page path
     * @returns {Promise<void>}
     */
    async addAssets(zipFiles, code, basePath, pagePath) {
      const pathInfos = this.assetManager.extractFilePaths(code);

      for (const { path: relPath, isText } of pathInfos) {
        const normalizedPath = relPath.startsWith('/') 
          ? relPath.substring(1) 
          : relPath;

        // Skip if already in zipFiles
        if (zipFiles[normalizedPath]) continue;

        // Skip absolute URLs
        if (REGEX_PATTERNS.ABSOLUTE_URL.test(relPath)) continue;

        try {
          const url = constructUrl(relPath, basePath, pagePath);
          const response = await fetch(url);
          
          if (response.ok) {
            if (isText) {
              const text = await response.text();
              zipFiles[normalizedPath] = new TextEncoder().encode(text);
            } else {
              const arrayBuffer = await response.arrayBuffer();
              zipFiles[normalizedPath] = new Uint8Array(arrayBuffer);
            }
          } else {
            console.warn(`Failed to load asset: ${relPath} at ${url}`);
          }
        } catch (error) {
          console.warn(`Error loading asset ${relPath}:`, error);
        }
      }
    }

    /**
     * Create and download ZIP file
     * @param {Object} zipFiles - ZIP files object
     * @param {string} id - Project ID
     */
    downloadZip(zipFiles, id) {
      if (typeof window.UZIP === 'undefined') {
        throw new Error('UZIP library not loaded');
      }

      const zipData = window.UZIP.encode(zipFiles);
      const zipBlob = new Blob([zipData], { type: 'application/zip' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `typst-project-${id}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
    }
  }

  // ============================================================================
  // UI MANAGER
  // ============================================================================

  class UIManager {
    constructor(elem, fileManager, binaryFiles) {
      this.elem = elem;
      this.fileManager = fileManager;
      this.binaryFiles = binaryFiles;
      this.tabsList = elem.querySelector('.tabs-list');
      this.binaryFilesList = elem.querySelector('.binary-files-list');
    }

    /**
     * Update tabs UI
     */
    updateTabs() {
      if (!this.tabsList) return;

      this.tabsList.innerHTML = '';

      this.fileManager.sourceFiles.forEach((file) => {
        const tab = this.createTab(file);
        this.tabsList.appendChild(tab);
      });
    }

    /**
     * Create tab element for file
     * @param {Object} file - File object
     * @returns {HTMLElement} Tab element
     */
    createTab(file) {
      const tab = document.createElement('div');
      tab.className = 'file-tab';
      
      if (file.filename === this.fileManager.currentFile.filename) {
        tab.classList.add('active');
      }

      // Tab name
      const tabName = document.createElement('span');
      tabName.className = 'tab-name';
      tabName.textContent = file.filename;
      tab.appendChild(tabName);

      // Delete button (except for main file)
      if (file.filename !== 'main.typ' && file.filename !== 'main.typst') {
        const deleteBtn = this.createDeleteButton(file);
        tab.appendChild(deleteBtn);
      }

      // Click handler
      tab.addEventListener('click', () => this.handleTabClick(file));

      return tab;
    }

    /**
     * Create delete button for tab
     * @param {Object} file - File object
     * @returns {HTMLElement} Delete button
     */
    createDeleteButton(file) {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'tab-delete';
      deleteBtn.textContent = '×';
      deleteBtn.title = i18nGet('typst-delete-file', 'Delete file');
      
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleDeleteFile(file.filename);
      });

      return deleteBtn;
    }

    /**
     * Handle tab click
     * @param {Object} file - File object
     */
    handleTabClick(file) {
      if (this.fileManager.currentFile.filename !== file.filename) {
        this.onFileSwitch?.(file.filename);
      }
    }

    /**
     * Handle file deletion
     * @param {string} filename - Filename to delete
     */
    handleDeleteFile(filename) {
      const confirmMsg = `${i18nGet('typst-delete-confirm', 'Delete')} ${filename}?`;
      
      if (confirm(confirmMsg)) {
        this.fileManager.deleteFile(filename);
        this.updateTabs();
        this.onFilesChange?.();
      }
    }

    /**
     * Update binary files list UI
     */
    updateBinaryFilesList() {
      if (!this.binaryFilesList) return;

      this.binaryFilesList.innerHTML = '';

      if (this.binaryFiles.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'binary-files-empty';
        emptyMsg.textContent = i18nGet('typst-no-binary-files', 'No binary files');
        this.binaryFilesList.appendChild(emptyMsg);
        return;
      }

      this.binaryFiles.forEach((file) => {
        const item = this.createBinaryFileItem(file);
        this.binaryFilesList.appendChild(item);
      });
    }

    /**
     * Create binary file list item
     * @param {Object} file - Binary file object
     * @returns {HTMLElement} List item
     */
    createBinaryFileItem(file) {
      const item = document.createElement('div');
      item.className = 'binary-file-item';

      const icon = document.createElement('span');
      icon.className = 'binary-file-icon';
      icon.textContent = '📎';
      item.appendChild(icon);

      const name = document.createElement('span');
      name.className = 'binary-file-name';
      name.textContent = file.dest;
      item.appendChild(name);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'binary-file-delete';
      deleteBtn.textContent = '×';
      deleteBtn.title = i18nGet('typst-delete-file', 'Delete file');
      deleteBtn.addEventListener('click', () => this.handleDeleteBinaryFile(file.dest));
      item.appendChild(deleteBtn);

      return item;
    }

    /**
     * Handle binary file deletion
     * @param {string} dest - File destination path
     */
    handleDeleteBinaryFile(dest) {
      const confirmMsg = `${i18nGet('typst-delete-confirm', 'Delete')} ${dest}?`;
      
      if (confirm(confirmMsg)) {
        this.binaryFiles = this.binaryFiles.filter((f) => f.dest !== dest);
        this.updateBinaryFilesList();
        this.onBinaryFilesChange?.(this.binaryFiles);
      }
    }
  }

  // ============================================================================
  // TYPST EDITOR
  // ============================================================================

  class TypstEditor {
    constructor({
      elem,
      id,
      sourceFiles,
      binaryFiles,
      fontFiles,
      basePath,
      pagePath,
      renderer,
      exporter,
    }) {
      this.elem = elem;
      this.id = id;
      this.fontFiles = fontFiles;
      this.basePath = normalizePath(basePath);
      this.pagePath = normalizePath(pagePath);
      this.renderer = renderer;
      this.exporter = exporter;

      // Initialize managers
      this.fileManager = new FileManager(sourceFiles);
      this.binaryFiles = binaryFiles;
      this.uiManager = new UIManager(elem, this.fileManager, this.binaryFiles);

      // Get DOM elements
      this.previewContainer = elem.querySelector('.preview-container');
      this.preview = elem.querySelector('.typst-preview');
      this.loadingIndicator = elem.querySelector('.typst-loading');
      this.editor = elem.querySelector('.editor.typst');
      this.sourceTextarea = elem.querySelector('.typst-source');

      // Setup UI callbacks
      this.setupUICallbacks();

      // Setup event handlers
      this.setupEventHandlers();

      // Initialize
      this.initialize();
    }

    /**
     * Setup UI manager callbacks
     */
    setupUICallbacks() {
      this.uiManager.onFileSwitch = (filename) => this.handleFileSwitch(filename);
      this.uiManager.onFilesChange = () => this.handleFilesChange();
      this.uiManager.onBinaryFilesChange = (binaryFiles) => this.handleBinaryFilesChange(binaryFiles);
    }

    /**
     * Setup event handlers
     */
    setupEventHandlers() {
      const downloadBtn = this.elem.querySelector('.download-pdf');
      const downloadProjectBtn = this.elem.querySelector('.download-project');
      const resetBtn = this.elem.querySelector('.reset');
      const addSourceFileBtn = this.elem.querySelector('.add-source-file');
      const addBinaryFileBtn = this.elem.querySelector('.add-binary-file');

      downloadBtn?.addEventListener('click', () => this.handleExportPdf());
      downloadProjectBtn?.addEventListener('click', () => this.handleExportProject());
      resetBtn?.addEventListener('click', () => this.handleReset());
      addSourceFileBtn?.addEventListener('click', () => this.handleAddSourceFile());
      addBinaryFileBtn?.addEventListener('click', (e) => this.handleAddBinaryFile(e));
    }

    /**
     * Initialize editor
     */
    async initialize() {
      if (this.editor) {
        // Edit mode - wait for code-input to load
        this.editor.addEventListener('code-input_load', async () => {
          await this.restoreState();
          this.uiManager.updateTabs();
          this.uiManager.updateBinaryFilesList();
          this.rerender();

          // Create debounced rerender for input events
          const debouncedRerender = debounce(() => this.rerender(), CONFIG.DEBOUNCE_DELAY);

          this.editor.addEventListener('input', () => {
            this.saveState();
            debouncedRerender();
          });
        });
      } else if (this.sourceTextarea) {
        // Preview mode
        const initialCode = this.sourceTextarea.value;
        await this.renderer.render({
          code: initialCode,
          container: this.preview,
          loadingIndicator: this.loadingIndicator,
          sourceFiles: this.fileManager.sourceFiles,
          binaryFiles: this.binaryFiles,
          fontFiles: this.fontFiles,
          id: this.id,
          previewContainer: this.previewContainer,
          basePath: this.basePath,
          pagePath: this.pagePath,
        });
      }
    }

    /**
     * Restore state from storage
     */
    async restoreState() {
      const result = await window.store?.typst?.get(this.id);
      
      if (result) {
        this.editor.value = result.code;

        if (result.sourceFiles) {
          this.fileManager.sourceFiles = result.sourceFiles;
          result.sourceFiles.forEach((f) => 
            this.fileManager.contents.set(f.filename, f.content)
          );
        }

        if (result.binaryFiles) {
          this.binaryFiles = result.binaryFiles;
        }

        if (result.currentFile) {
          const file = this.fileManager.sourceFiles.find(
            (f) => f.filename === result.currentFile
          );
          if (file) {
            this.fileManager.currentFile = file;
            this.editor.value = this.fileManager.getCurrentContent();
          }
        }
      } else {
        this.editor.value = this.fileManager.getCurrentContent();
      }
    }

    /**
     * Save state to storage
     */
    async saveState() {
      if (!this.editor) return;

      this.fileManager.updateCurrentContent(this.editor.value);

      await window.store?.typst?.put({
        id: this.id,
        code: this.editor.value,
        sourceFiles: this.fileManager.getSourceFiles(),
        binaryFiles: this.binaryFiles,
        currentFile: this.fileManager.currentFile.filename,
      });
    }

    /**
     * Rerender Typst preview
     */
    rerender() {
      if (!this.editor) return;

      this.fileManager.updateCurrentContent(this.editor.value);

      const mainFile = this.fileManager.findMainFile();
      const mainCode = mainFile 
        ? this.fileManager.contents.get(mainFile.filename) || mainFile.content 
        : '';

      this.renderer.render({
        code: mainCode,
        container: this.preview,
        loadingIndicator: this.loadingIndicator,
        sourceFiles: this.fileManager.getSourceFiles(),
        binaryFiles: this.binaryFiles,
        fontFiles: this.fontFiles,
        id: this.id,
        previewContainer: this.previewContainer,
        basePath: this.basePath,
        pagePath: this.pagePath,
      });
    }

    /**
     * Handle file switch
     * @param {string} filename - Target filename
     */
    handleFileSwitch(filename) {
      if (this.editor) {
        this.fileManager.updateCurrentContent(this.editor.value);
        const content = this.fileManager.switchTo(filename);
        this.editor.value = content;
        this.uiManager.updateTabs();
        this.saveState();
      }
    }

    /**
     * Handle files change
     */
    handleFilesChange() {
      if (this.editor) {
        this.editor.value = this.fileManager.getCurrentContent();
      }
      this.saveState();
      this.rerender();
    }

    /**
     * Handle binary files change
     * @param {Array} binaryFiles - Updated binary files array
     */
    handleBinaryFilesChange(binaryFiles) {
      this.binaryFiles = binaryFiles;
      this.saveState();
      this.rerender();
    }

    /**
     * Handle add source file
     */
    handleAddSourceFile() {
      const filename = prompt(
        i18nGet('typst-filename-prompt', 'Enter filename (e.g., helper.typ):')
      );

      if (!filename) return;

      // Validate filename
      if (!filename.endsWith('.typ') && !filename.endsWith('.typst')) {
        alert(i18nGet('typst-filename-error', 'Filename must end with .typ or .typst'));
        return;
      }

      if (!this.fileManager.addFile(filename)) {
        alert(i18nGet('typst-filename-exists', 'File already exists'));
        return;
      }

      if (this.editor) {
        this.editor.value = this.fileManager.getCurrentContent();
      }

      this.uiManager.updateTabs();
      this.saveState();
      this.rerender();
    }

    /**
     * Handle add binary file
     * @param {Event} e - Click event
     */
    handleAddBinaryFile(e) {
      e.preventDefault();
      e.stopPropagation();

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,.pdf';

      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const dest = `/${file.name}`;

        // Check if file already exists
        if (this.binaryFiles.some((f) => f.dest === dest)) {
          if (!confirm(i18nGet('typst-file-replace', `Replace existing ${dest}?`))) {
            return;
          }
          this.binaryFiles = this.binaryFiles.filter((f) => f.dest !== dest);
        }

        // Read file as data URL
        const reader = new FileReader();
        reader.onload = async (e) => {
          const url = e.target.result;
          this.binaryFiles.push({ dest, url });
          this.uiManager.updateBinaryFilesList();
          this.saveState();
          this.rerender();
        };
        reader.readAsDataURL(file);
      });

      input.click();
    }

    /**
     * Handle PDF export
     */
    async handleExportPdf() {
      const mainFile = this.fileManager.findMainFile();
      const mainCode = mainFile 
        ? this.fileManager.contents.get(mainFile.filename) || mainFile.content 
        : '';

      await this.renderer.exportPdf({
        code: mainCode,
        id: this.id,
        sourceFiles: this.fileManager.getSourceFiles(),
        binaryFiles: this.binaryFiles,
        fontFiles: this.fontFiles,
        basePath: this.basePath,
        pagePath: this.pagePath,
      });
    }

    /**
     * Handle project export
     */
    async handleExportProject() {
      const mainFile = this.fileManager.findMainFile();
      const code = mainFile ? mainFile.content : (this.editor ? this.editor.value : '');

      await this.exporter.export({
        code,
        id: this.id,
        sourceFiles: this.fileManager.getSourceFiles(),
        binaryFiles: this.binaryFiles,
        basePath: this.basePath,
        pagePath: this.pagePath,
      });
    }

    /**
     * Handle reset
     */
    async handleReset() {
      const confirmMsg = i18nGet(
        'typst-reset-prompt',
        'Are you sure you want to reset the code?'
      );

      if (confirm(confirmMsg)) {
        await window.store?.typst?.delete(this.id);
        window.location.reload();
      }
    }
  }

  // ============================================================================
  // MAIN INITIALIZATION
  // ============================================================================

  // Initialize code-input
  initializeCodeInput();

  // Get all Typst directive elements
  const elements = document.getElementsByClassName('directive-typst');

  // Create shared instances
  const typstLoader = new TypstLoader();
  const renderQueue = new RenderQueue();
  const assetManager = new AssetManager();
  const renderer = new TypstRenderer(typstLoader, assetManager, renderQueue);
  const exporter = new ProjectExporter(assetManager);

  // Initialize each Typst element
  for (const elem of elements) {
    const id = elem.getAttribute('data-id');
    const sourceFilesData = elem.getAttribute('data-source-files');
    const binaryFilesData = elem.getAttribute('data-binary-files');
    const fontFilesData = elem.getAttribute('data-font-files');
    const basePath = elem.getAttribute('data-base-path') || '';
    const pagePath = elem.getAttribute('data-page-path') || '';

    // Decode base64 with proper UTF-8 handling
    const decodeBase64 = (str) => {
      const binaryStr = atob(str);
      const bytes = Uint8Array.from(binaryStr, (c) => c.charCodeAt(0));
      return new TextDecoder('utf-8').decode(bytes);
    };

    const sourceFiles = sourceFilesData ? JSON.parse(decodeBase64(sourceFilesData)) : [];
    const binaryFiles = binaryFilesData ? JSON.parse(decodeBase64(binaryFilesData)) : [];
    const fontFiles = fontFilesData ? JSON.parse(decodeBase64(fontFilesData)) : [];

    new TypstEditor({
      elem,
      id,
      sourceFiles,
      binaryFiles,
      fontFiles,
      basePath,
      pagePath,
      renderer,
      exporter,
    });
  }

  return {};
})();
