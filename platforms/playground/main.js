import "./style.css";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { WebContainer } from "@webcontainer/api";
import { files as initialFiles } from "./files";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

// Setup Monaco workers
self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === "json") {
      return new jsonWorker();
    }
    if (label === "css" || label === "scss" || label === "less") {
      return new cssWorker();
    }
    if (label === "html" || label === "handlebars" || label === "razor") {
      return new htmlWorker();
    }
    if (label === "typescript" || label === "javascript") {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

/** @type {import('@webcontainer/api').WebContainer}  */
let webcontainerInstance;
let terminal;
let editor;
let currentFile = "hyperbook.json";
let projectFiles = {};
let collapsedFolders = new Set();

document.querySelector("#app").innerHTML = `
  <div class="container">
    <div class="panel files-panel">
      <div class="panel-header">
        <div class="panel-header-title">Files</div>
      </div>
      <div class="file-actions">
        <button class="btn" id="add-file-btn">+ File</button>
        <button class="btn btn-secondary" id="add-folder-btn">+ Folder</button>
        <button class="btn btn-secondary" id="upload-btn">📤 Upload</button>
        <input type="file" id="file-upload-input" style="display: none;" multiple accept="*/*" />
      </div>
      <div class="panel-content">
        <ul class="file-list" id="file-list"></ul>
      </div>
    </div>
    <div class="panel editor-panel">
      <div class="panel-header">
        <div class="panel-header-title" id="editor-title">hyperbook.json</div>
      </div>
      <div class="panel-content">
        <div id="editor"></div>
      </div>
    </div>
    <div class="panel preview">
      <div class="panel-header">
        <div class="panel-header-title">Preview</div>
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn btn-secondary" id="open-preview-btn" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">🔗 Open</button>
          <button class="btn btn-secondary" id="refresh-preview-btn" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">🔄 Refresh</button>
        </div>
      </div>
      <div class="panel-content" style="padding: 0;">
        <iframe src="loading.html"></iframe>
      </div>
    </div>
    <div class="panel terminal-panel">
      <div class="panel-header">
        <div class="panel-header-title">Terminal</div>
      </div>
      <div class="panel-content" style="padding: 0;">
        <div id="terminal"></div>
      </div>
    </div>
  </div>
  <div class="modal" id="file-modal">
    <div class="modal-content">
      <h3 class="modal-title" id="modal-title">Create New File</h3>
      <input type="text" class="modal-input" id="file-name-input" placeholder="Enter file path (e.g., book/page.md)" />
      <div class="modal-actions">
        <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
        <button class="btn" id="modal-confirm">Create</button>
      </div>
    </div>
  </div>
`;

/** @type {HTMLIFrameElement | null} */
const iframeEl = document.querySelector("iframe");

// Setup refresh button
const refreshBtn = document.getElementById("refresh-preview-btn");
refreshBtn.onclick = () => {
  if (iframeEl.src && iframeEl.src !== window.location.origin + "/loading.html") {
    terminal.writeln("🔄 Refreshing preview...\n");
    const currentSrc = iframeEl.src;
    iframeEl.src = "about:blank";
    setTimeout(() => {
      iframeEl.src = currentSrc;
    }, 100);
  } else {
    terminal.writeln("⚠️ No preview URL set yet. Wait for server to start.\n");
  }
};

// Setup open in new window button
const openBtn = document.getElementById("open-preview-btn");
openBtn.onclick = () => {
  if (iframeEl.src && iframeEl.src !== window.location.origin + "/loading.html") {
    terminal.writeln("🔗 Opening preview in new window...\n");
    window.open(iframeEl.src, '_blank');
  } else {
    terminal.writeln("⚠️ No preview URL set yet. Wait for server to start.\n");
  }
};

window.addEventListener("load", async () => {
  // Initialize Monaco Editor
  editor = monaco.editor.create(document.getElementById("editor"), {
    value: "",
    language: "json",
    theme: "vs-dark",
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 14,
  });

  // Load initial files into memory
  loadFilesFromTree(initialFiles, "");

  // Setup editor change listener
  editor.onDidChangeModelContent(() => {
    if (webcontainerInstance && currentFile && !editor.getOption(monaco.editor.EditorOption.readOnly)) {
      const content = editor.getValue();
      writeFile(currentFile, content);
    }
  });

  // Setup file list
  renderFileList();

  // Setup file modal
  setupFileModal();

  // Load first file
  loadFile("hyperbook.json");

  // Setup terminal
  terminal = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: '"Fira Code", Menlo, Monaco, "Courier New", monospace',
    theme: {
      background: "#1e1e1e",
      foreground: "#d4d4d4",
    },
    convertEol: true,
  });

  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(document.getElementById("terminal"));
  fitAddon.fit();

  window.addEventListener("resize", () => {
    fitAddon.fit();
  });

  terminal.writeln("🚀 Initializing Hyperbook Playground...\n");

  // Boot WebContainer
  terminal.writeln("⏳ Booting WebContainer...");
  webcontainerInstance = await WebContainer.boot();
  
  // Setup server-ready listener BEFORE mounting/installing
  webcontainerInstance.on("server-ready", async (port, url) => {
    terminal.writeln(`\n🎉 Server ready on port ${port}\n`);
    terminal.writeln(`📱 Preview URL: ${url}\n`);
    terminal.writeln(`📱 Waiting for build to complete...\n`);
    
    // Wait a bit for the initial build to complete
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    terminal.writeln(`📱 Loading preview...\n`);
    terminal.writeln(`💡 If preview is empty, the URL may not work in iframe.\n`);
    terminal.writeln(`   Try opening in new window with 🔗 Open button.\n`);
    console.log("Setting iframe src to:", url);
    
    // Set iframe src
    iframeEl.src = url;
    
    // Add load listener with timeout
    let loadTimeout = setTimeout(() => {
      terminal.writeln(`⚠️ Preview taking a while to load.\n`);
      terminal.writeln(`   Click 🔄 Refresh or 🔗 Open button.\n`);
    }, 5000);
    
    iframeEl.onload = () => {
      clearTimeout(loadTimeout);
      console.log("Iframe loaded successfully");
      terminal.writeln(`✅ Preview loaded!\n`);
      
      // Check if iframe has content
      try {
        const iframeDoc = iframeEl.contentDocument || iframeEl.contentWindow?.document;
        if (iframeDoc && iframeDoc.body && iframeDoc.body.innerHTML.length < 100) {
          terminal.writeln(`⚠️ Preview may be empty. Try 🔗 Open button.\n`);
        }
      } catch (e) {
        // Cross-origin, can't check content
        terminal.writeln(`ℹ️ Preview loaded (cross-origin). Use 🔗 Open if needed.\n`);
      }
    };
    
    iframeEl.onerror = (err) => {
      clearTimeout(loadTimeout);
      console.error("Iframe error:", err);
      terminal.writeln(`❌ Preview failed to load in iframe.\n`);
      terminal.writeln(`   Click 🔗 Open to view in new window.\n`);
    };
    
    console.log("Iframe src is now:", iframeEl.src);
  });
  
  await webcontainerInstance.mount(initialFiles);
  terminal.writeln("✅ WebContainer ready!\n");

  // Show file structure
  terminal.writeln("📁 Project structure:");
  terminal.writeln("  ├── hyperbook.json");
  terminal.writeln("  ├── package.json");
  terminal.writeln("  └── book/");
  terminal.writeln("      └── index.md\n");

  terminal.writeln("💡 Edit files to see live changes!\n");
  terminal.writeln("⏳ This may take a minute on first load...\n");

  // Install hyperbook and start dev server
  await installAndStartDev();

  terminal.writeln("---\n");

  // Setup terminal shell
  startShell();
});

// Helper functions
function loadFilesFromTree(tree, prefix) {
  for (const [name, node] of Object.entries(tree)) {
    const fullPath = prefix ? `${prefix}/${name}` : name;
    if (node.file) {
      projectFiles[fullPath] = node.file.contents;
    } else if (node.directory) {
      loadFilesFromTree(node.directory, fullPath);
    }
  }
}

function buildFileTree() {
  const tree = {};
  
  for (const filePath of Object.keys(projectFiles)) {
    const parts = filePath.split('/');
    let current = tree;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      
      if (isFile) {
        if (!current.__files) current.__files = [];
        current.__files.push(filePath);
      } else {
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part];
      }
    }
  }
  
  return tree;
}

function renderFileTree(tree, container, path = '') {
  // Render folders first
  const folders = Object.keys(tree).filter(k => k !== '__files').sort();
  for (const folderName of folders) {
    const folderPath = path ? `${path}/${folderName}` : folderName;
    const isCollapsed = collapsedFolders.has(folderPath);
    
    const folderItem = document.createElement('li');
    folderItem.className = `folder-item ${isCollapsed ? 'collapsed' : 'expanded'}`;
    
    const folderNameSpan = document.createElement('span');
    folderNameSpan.className = 'folder-item-name';
    folderNameSpan.textContent = folderName;
    folderNameSpan.onclick = () => toggleFolder(folderPath);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'file-delete';
    deleteBtn.textContent = '×';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      deleteFolder(folderPath);
    };
    
    folderItem.appendChild(folderNameSpan);
    folderItem.appendChild(deleteBtn);
    container.appendChild(folderItem);
    
    // Create children container
    const childrenUl = document.createElement('ul');
    childrenUl.className = `folder-children ${isCollapsed ? '' : 'expanded'}`;
    renderFileTree(tree[folderName], childrenUl, folderPath);
    container.appendChild(childrenUl);
  }
  
  // Render files
  if (tree.__files) {
    const sortedFiles = tree.__files.sort();
    for (const filePath of sortedFiles) {
      const fileName = filePath.split('/').pop();
      
      const li = document.createElement('li');
      li.className = `file-item ${currentFile === filePath ? 'active' : ''}`;
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'file-item-name';
      nameSpan.textContent = fileName;
      nameSpan.onclick = () => loadFile(filePath);
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'file-delete';
      deleteBtn.textContent = '×';
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        deleteFile(filePath);
      };
      
      li.appendChild(nameSpan);
      li.appendChild(deleteBtn);
      container.appendChild(li);
    }
  }
}

function renderFileList() {
  const fileList = document.getElementById("file-list");
  fileList.innerHTML = "";
  
  const tree = buildFileTree();
  renderFileTree(tree, fileList);
}

function toggleFolder(folderPath) {
  if (collapsedFolders.has(folderPath)) {
    collapsedFolders.delete(folderPath);
  } else {
    collapsedFolders.add(folderPath);
  }
  renderFileList();
}

function loadFile(filePath) {
  currentFile = filePath;
  const content = projectFiles[filePath] || "";
  
  // Check if it's a binary file
  if (content.startsWith('[Binary file:')) {
    // Show a message for binary files
    monaco.editor.setModelLanguage(editor.getModel(), "plaintext");
    editor.setValue(`# Binary File\n\nThis is a binary file (${filePath}) and cannot be edited in the text editor.\n\nYou can:\n- Delete it and upload a new version\n- Reference it in your markdown files\n\nFor images, use:\n![Alt text](./${filePath.split('/').pop()})`);
    editor.updateOptions({ readOnly: true });
  } else {
    editor.updateOptions({ readOnly: false });
    
    // Determine language
    let language = "plaintext";
    if (filePath.endsWith(".json")) language = "json";
    else if (filePath.endsWith(".md")) language = "markdown";
    else if (filePath.endsWith(".js")) language = "javascript";
    else if (filePath.endsWith(".ts")) language = "typescript";
    else if (filePath.endsWith(".html")) language = "html";
    else if (filePath.endsWith(".css")) language = "css";
    else if (filePath.endsWith(".yaml") || filePath.endsWith(".yml")) language = "yaml";
    else if (filePath.endsWith(".xml")) language = "xml";
    
    // Update editor
    monaco.editor.setModelLanguage(editor.getModel(), language);
    editor.setValue(content);
  }
  
  // Update UI
  document.getElementById("editor-title").textContent = filePath;
  renderFileList();
}

function setupFileModal() {
  const modal = document.getElementById("file-modal");
  const addFileBtn = document.getElementById("add-file-btn");
  const addFolderBtn = document.getElementById("add-folder-btn");
  const uploadBtn = document.getElementById("upload-btn");
  const fileUploadInput = document.getElementById("file-upload-input");
  const cancelBtn = document.getElementById("modal-cancel");
  const confirmBtn = document.getElementById("modal-confirm");
  const input = document.getElementById("file-name-input");
  const title = document.getElementById("modal-title");
  
  let isFolder = false;
  
  addFileBtn.onclick = () => {
    isFolder = false;
    title.textContent = "Create New File";
    input.placeholder = "Enter file path (e.g., book/page.md)";
    input.value = "";
    modal.classList.add("show");
    input.focus();
  };
  
  addFolderBtn.onclick = () => {
    isFolder = true;
    title.textContent = "Create New Folder";
    input.placeholder = "Enter folder path (e.g., book/chapter1)";
    input.value = "";
    modal.classList.add("show");
    input.focus();
  };
  
  uploadBtn.onclick = () => {
    fileUploadInput.click();
  };
  
  fileUploadInput.onchange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    for (const file of files) {
      await uploadFile(file);
    }
    
    // Clear input
    fileUploadInput.value = "";
  };
  
  cancelBtn.onclick = () => {
    modal.classList.remove("show");
  };
  
  confirmBtn.onclick = () => {
    const path = input.value.trim();
    if (path) {
      if (isFolder) {
        createFolder(path);
      } else {
        createFile(path);
      }
    }
    modal.classList.remove("show");
  };
  
  input.onkeydown = (e) => {
    if (e.key === "Enter") {
      confirmBtn.click();
    } else if (e.key === "Escape") {
      cancelBtn.click();
    }
  };
}

async function uploadFile(file) {
  // Default to book/images/ for images, book/assets/ for other files
  const isImage = file.type.startsWith('image/');
  const folder = isImage ? 'book/images' : 'book/assets';
  const filePath = `${folder}/${file.name}`;
  
  try {
    // Read file as ArrayBuffer for binary files, or text for text files
    const isTextFile = file.type.startsWith('text/') || 
                       file.name.endsWith('.md') || 
                       file.name.endsWith('.json') ||
                       file.name.endsWith('.js') ||
                       file.name.endsWith('.css') ||
                       file.name.endsWith('.html');
    
    if (isTextFile) {
      const content = await file.text();
      projectFiles[filePath] = content;
      await writeFile(filePath, content);
    } else {
      // For binary files (images, etc.)
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Store as base64 for display purposes
      projectFiles[filePath] = `[Binary file: ${file.type}]`;
      
      // Write binary file to WebContainer
      if (webcontainerInstance) {
        const parts = filePath.split("/");
        if (parts.length > 1) {
          let currentPath = "";
          for (let i = 0; i < parts.length - 1; i++) {
            currentPath += (currentPath ? "/" : "") + parts[i];
            try {
              await webcontainerInstance.fs.mkdir(currentPath, { recursive: true });
            } catch (e) {
              // Directory might already exist
            }
          }
        }
        await webcontainerInstance.fs.writeFile(`/${filePath}`, uint8Array);
      }
    }
    
    renderFileList();
    
    if (isTextFile) {
      loadFile(filePath);
    }
    
    terminal.writeln(`✅ Uploaded: ${filePath}\n`);
  } catch (error) {
    terminal.writeln(`❌ Failed to upload ${file.name}: ${error.message}\n`);
    console.error('Upload error:', error);
  }
}

async function createFile(filePath) {
  if (!projectFiles[filePath]) {
    projectFiles[filePath] = "";
    await writeFile(filePath, "");
    renderFileList();
    loadFile(filePath);
  }
}

async function createFolder(folderPath) {
  // Create a .gitkeep file in the folder
  const gitkeepPath = `${folderPath}/.gitkeep`;
  if (!projectFiles[gitkeepPath]) {
    projectFiles[gitkeepPath] = "";
    await writeFile(gitkeepPath, "");
    renderFileList();
  }
}

async function deleteFolder(folderPath) {
  const filesToDelete = Object.keys(projectFiles).filter(f => f.startsWith(folderPath + '/'));
  
  if (filesToDelete.length === 0) {
    return;
  }
  
  if (confirm(`Delete folder "${folderPath}" and ${filesToDelete.length} file(s)?`)) {
    for (const filePath of filesToDelete) {
      delete projectFiles[filePath];
      if (webcontainerInstance) {
        try {
          await webcontainerInstance.fs.rm(filePath);
        } catch (e) {
          console.error("Failed to delete file:", e);
        }
      }
    }
    
    renderFileList();
    
    // Load a different file if current was deleted
    if (filesToDelete.includes(currentFile)) {
      const remainingFiles = Object.keys(projectFiles);
      if (remainingFiles.length > 0) {
        loadFile(remainingFiles[0]);
      } else {
        editor.setValue("");
        currentFile = null;
      }
    }
  }
}

async function deleteFile(filePath) {
  if (confirm(`Delete ${filePath}?`)) {
    delete projectFiles[filePath];
    if (webcontainerInstance) {
      try {
        await webcontainerInstance.fs.rm(filePath);
      } catch (e) {
        console.error("Failed to delete file:", e);
      }
    }
    renderFileList();
    
    // Load a different file if current was deleted
    if (currentFile === filePath) {
      const remainingFiles = Object.keys(projectFiles);
      if (remainingFiles.length > 0) {
        loadFile(remainingFiles[0]);
      } else {
        editor.setValue("");
        currentFile = null;
      }
    }
  }
}

async function installAndStartDev() {
  terminal.writeln("📦 Installing hyperbook...");

  const installProcess = await webcontainerInstance.spawn("npm", [
    "install",
    "hyperbook@latest",
  ]);

  installProcess.output.pipeTo(
    new WritableStream({
      write(data) {
        terminal.write(data);
      },
    }),
  );

  const exitCode = await installProcess.exit;

  if (exitCode !== 0) {
    terminal.writeln("\n❌ Failed to install hyperbook\n");
    return;
  }

  terminal.writeln("\n✅ Hyperbook installed!\n");
  terminal.writeln("🚀 Starting hyperbook dev server...\n");

  // Start hyperbook dev server and stream output
  const devProcess = await webcontainerInstance.spawn("npx", [
    "hyperbook",
    "dev",
  ]);

  // Stream the output to the terminal
  devProcess.output.pipeTo(
    new WritableStream({
      write(data) {
        terminal.write(data);
      },
    }),
  ).catch((err) => {
    terminal.writeln(`\n❌ Dev server stream error: ${err}\n`);
  });
}

async function startShell() {
  const shellProcess = await webcontainerInstance.spawn("jsh", {
    terminal: {
      cols: terminal.cols,
      rows: terminal.rows,
    },
  });

  shellProcess.output.pipeTo(
    new WritableStream({
      write(data) {
        terminal.write(data);
      },
    }),
  );

  const input = shellProcess.input.getWriter();
  terminal.onData((data) => {
    input.write(data);
  });

  return shellProcess;
}

/**
 * @param {string} path
 * @param {string} content
 */
async function writeFile(path, content) {
  projectFiles[path] = content;
  if (webcontainerInstance) {
    // Create directory structure if needed
    const parts = path.split("/");
    if (parts.length > 1) {
      let currentPath = "";
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath += (currentPath ? "/" : "") + parts[i];
        try {
          await webcontainerInstance.fs.mkdir(currentPath, { recursive: true });
        } catch (e) {
          // Directory might already exist
        }
      }
    }
    await webcontainerInstance.fs.writeFile(`/${path}`, content);
  }
}
