/**
 * The shell shared by Hyperbook's IDEs: a workspace of files shown as tabs in
 * one CodeMirror editor, saved to the `ide` table, plus the splitter,
 * fullscreen, reset, copy, upload and download every IDE has.
 *
 * A directive's client keeps only what is its own -- how to run or render the
 * files and show the result -- and asks the shell for the files.
 *
 * Exposes window.HyperbookIDE. Loaded in the head after the CodeMirror
 * bundle; nothing here touches the DOM or the store until mount() is called.
 */
import {
  decodeWorkspace,
  mergeWorkspace,
  savableFiles,
  checkNewPath,
  isEditable,
  isTextPath,
  mayChange,
  parseFileActions,
} from "./workspace.js";
import { previewKind, renderPreview } from "./preview.js";
import { icon } from "./icons.js";
import {
  compareImages,
  createComparison,
  loadImage,
  normalize,
} from "./compare.js";
import {
  setupSplitter,
  setupFullscreen,
  toggleFullscreen,
  updateFullscreenButtonState,
} from "./layout.js";

const t = (key, values) => hyperbook.i18n.get(key, values);

const triggerDownload = (blob, filename) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 0);
};

/** The last segment of a path, for a download name. */
const basename = (path) => path.split("/").pop() || path;

const readUpload = (file, asText) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    if (asText) reader.readAsText(file);
    else reader.readAsDataURL(file);
  });

/**
 * @typedef {object} MountOptions
 * @property {string} id Directive id; the key of the saved row.
 * @property {string} runtime The directive, e.g. "pyide".
 * @property {HTMLElement} editor Where the CodeMirror editor goes.
 * @property {string | null} [workspace] The `data-workspace` attribute.
 * @property {(path: string) => string} [lang] HyperbookCM language per file.
 * @property {object} [editorOptions] Extra HyperbookCM.create() options.
 * @property {{reset?: Element, copy?: Element, download?: Element, fullscreen?: Element}} [buttons]
 * @property {{container?: Element, editorContainer?: Element, splitter?: Element}} [layout]
 * @property {(ui: Record<string, number>, extra: Record<string, unknown>) => void} [onRestore]
 *   Called once the saved row is merged in, with its ui sizes and runtime state.
 * @property {(path: string | null) => void} [onChange]
 *   Called when a file's content changes, or (with null) when files are
 *   added, removed or renamed.
 *
 * What readers may do with files comes from the root's `data-files`
 * ("create,upload,rename,delete") and `data-accept` (extensions for new and
 * renamed text files) attributes, which the directive writes.
 */

/**
 * Mounts the shell on an IDE root element.
 * @param {HTMLElement} elem
 * @param {MountOptions} options
 */
const mount = (elem, options) => {
  const {
    id,
    runtime,
    editor,
    lang = () => "",
    editorOptions = {},
    buttons = {},
    layout = {},
    onRestore,
    onChange,
  } = options;

  const actions = parseFileActions(elem.getAttribute("data-files"));
  const accept = (elem.getAttribute("data-accept") || "")
    .split(",")
    .map((ext) => ext.trim())
    .filter(Boolean);
  const keepsOwnFiles =
    actions.create || actions.upload || actions.rename;

  const page = decodeWorkspace(options.workspace ?? null);
  /** @type {import("./workspace.js").IdeFile[]} */
  let files = page.files.map((file) => ({ ...file }));
  let active = page.main;
  /** Page files the reader deleted or renamed. */
  let removed = [];
  /** @type {Record<string, number>} */
  let ui = {};
  /** @type {Record<string, unknown>} */
  let extra = {};
  /** Kept from the restored row, so a converted row stays traceable. */
  let migratedFrom;
  /** path → CodeMirror document */
  const docs = new Map();
  // Programmatic edits of the open document must not count as the reader's.
  let applying = false;

  const fileAt = (path) => files.find((file) => file.path === path);
  const visibleFiles = () => files.filter((file) => !file.hidden);
  const isText = (file) => typeof file.content === "string";
  const canEdit = (file) => isEditable(file) || (file.created && isText(file));

  const save = () =>
    hyperbook.store.db.ide.put({
      id,
      runtime,
      files: savableFiles(files),
      active,
      ui,
      ...(removed.length > 0 ? { removed } : {}),
      ...(Object.keys(extra).length > 0 ? { extra } : {}),
      ...(migratedFrom ? { migratedFrom } : {}),
    });

  editor.textContent = "";
  const cm = HyperbookCM.create(editor, {
    ...editorOptions,
    lang: lang(page.main),
    value: fileAt(page.main)?.content ?? "",
    onChange: (code) => {
      const file = fileAt(active);
      if (!file) return;
      file.content = code;
      if (applying) return;
      void save();
      onChange?.(active);
    },
  });

  const docFor = (file) => {
    let doc = docs.get(file.path);
    if (!doc) {
      doc = cm.createDoc(file.content ?? "", {
        lang: lang(file.path),
        readOnly: !canEdit(file),
      });
      docs.set(file.path, doc);
    }
    return doc;
  };

  // The editor already shows the main file; adopt that document for it.
  docs.set(page.main, cm.currentDoc());

  // --- binary preview -------------------------------------------------------

  // Shown instead of the editor while a binary file's tab is open.
  const preview = document.createElement("div");
  preview.className = "ide-preview";
  preview.hidden = true;
  editor.after(preview);
  /** The text file the editor shows; the open tab may be a binary one. */
  let textActive = page.main;

  let stopPreview = () => {};

  const downloadFile = async (file) => {
    try {
      const response = await fetch(file.url);
      triggerDownload(await response.blob(), basename(file.path));
    } catch (error) {
      console.error(`Could not download ${file.path}:`, error);
    }
  };

  const showPreview = (file) => {
    stopPreview();
    stopPreview = renderPreview(preview, file, {
      onDownload: () => downloadFile(file),
    });
    preview.hidden = false;
    // A style, not `hidden`: the IDEs' stylesheets set the editor's display.
    editor.style.display = "none";
  };

  const hidePreview = () => {
    stopPreview();
    stopPreview = () => {};
    preview.hidden = true;
    editor.style.display = "";
  };

  // --- tabs -----------------------------------------------------------------

  const tabs = document.createElement("div");
  tabs.className = "ide-tabs";
  editor.before(tabs);

  /** The strip the tabs sit in; it scrolls once the files no longer fit. */
  const strip = document.createElement("div");
  strip.className = "ide-tabs-strip";
  strip.setAttribute("role", "tablist");
  strip.setAttribute("aria-label", t("ide-files"));
  tabs.appendChild(strip);

  /** The tab that is open: a text file in the editor, or a binary preview. */
  let openTab = page.main;

  const tabButton = (className, label, onClick) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.title = label;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      onClick();
    });
    return button;
  };

  const scrollStrip = (left) => strip.scrollBy({ left, behavior: "smooth" });

  const scrollBack = tabButton(
    "ide-tabs-scroll",
    t("ide-tabs-scroll-left"),
    () => scrollStrip(-strip.clientWidth * 0.8),
  );
  scrollBack.textContent = "‹";
  const scrollForward = tabButton(
    "ide-tabs-scroll",
    t("ide-tabs-scroll-right"),
    () => scrollStrip(strip.clientWidth * 0.8),
  );
  scrollForward.textContent = "›";
  tabs.append(scrollBack, strip, scrollForward);

  /** A wheel over the tabs scrolls the strip, not the page behind it. */
  strip.addEventListener(
    "wheel",
    (event) => {
      if (
        Math.abs(event.deltaY) <= Math.abs(event.deltaX) ||
        strip.scrollWidth <= strip.clientWidth
      ) {
        return;
      }
      event.preventDefault();
      strip.scrollLeft += event.deltaY;
    },
    { passive: false },
  );

  /** The scroll buttons show only while the strip overflows. */
  const syncScroll = () => {
    const overflows = strip.scrollWidth > strip.clientWidth + 1;
    scrollBack.hidden = !overflows;
    scrollForward.hidden = !overflows;
    scrollBack.disabled = strip.scrollLeft <= 1;
    scrollForward.disabled =
      strip.scrollLeft >= strip.scrollWidth - strip.clientWidth - 1;
  };
  strip.addEventListener("scroll", syncScroll, { passive: true });
  new ResizeObserver(syncScroll).observe(strip);

  /** Scrolls the open tab into view, for restored and keyboard-opened tabs. */
  const showOpenTab = () => {
    const tab = strip.querySelector(".ide-tab.active");
    if (!tab) return;
    const tabRect = tab.getBoundingClientRect();
    const stripRect = strip.getBoundingClientRect();
    if (tabRect.left < stripRect.left) {
      strip.scrollLeft -= stripRect.left - tabRect.left;
    } else if (tabRect.right > stripRect.right) {
      strip.scrollLeft += tabRect.right - stripRect.right;
    }
  };

  /** An icon-only button, labelled for screen readers. */
  const iconButton = (className, iconName, label, onClick) => {
    const button = tabButton(className, label, onClick);
    button.appendChild(icon(iconName));
    return button;
  };

  /** New and upload sit after the strip, so they never scroll away. */
  const tools = document.createElement("div");
  tools.className = "ide-tab-tools";
  if (actions.create) {
    tools.appendChild(iconButton("ide-tab-add", "plus", t("ide-add-file"), () => addFile()));
  }
  if (actions.upload) {
    tools.appendChild(
      iconButton("ide-tab-add", "upload", t("ide-upload-file"), () => uploadFile()),
    );
  }
  if (tools.childElementCount > 0) tabs.appendChild(tools);

  const renderTabs = () => {
    const shown = visibleFiles();
    // A single file needs no tabs; the IDE then looks as it always did.
    tabs.hidden = shown.length <= 1 && !actions.create && !actions.upload;
    strip.textContent = "";
    for (const file of shown) {
      const tab = document.createElement("div");
      tab.className = "ide-tab";
      tab.setAttribute("role", "tab");
      tab.tabIndex = 0;
      const isOpen = file.path === openTab;
      tab.setAttribute("aria-selected", String(isOpen));
      tab.classList.toggle("active", isOpen);

      // Binary files show what they are; locked files a lock.
      if (!isText(file)) {
        const kind = previewKind(file.path);
        const marker = icon(kind);
        marker.classList.add("ide-tab-kind");
        tab.appendChild(marker);
        tab.title = t(`ide-kind-${kind}`);
      } else if (!canEdit(file)) {
        const marker = icon("lock");
        marker.classList.add("ide-tab-kind");
        tab.appendChild(marker);
        tab.title = t("ide-readonly-file");
      }

      const label = document.createElement("span");
      label.className = "ide-tab-name";
      label.textContent = file.path;
      tab.appendChild(label);
      tab.addEventListener("click", () => open(file.path));
      tab.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open(file.path);
        }
      });

      if (mayChange(file, page.main, actions.rename)) {
        tab.appendChild(
          iconButton(
            "ide-tab-action",
            "rename",
            t("ide-rename-file", { file: file.path }),
            () => renameFile(file.path),
          ),
        );
      }
      if (mayChange(file, page.main, actions.delete)) {
        tab.appendChild(
          iconButton(
            "ide-tab-action",
            "close",
            t("ide-delete-file", { file: file.path }),
            () => deleteFile(file.path),
          ),
        );
      }
      strip.appendChild(tab);
    }
    syncScroll();
    showOpenTab();
  };

  const open = (path) => {
    const file = fileAt(path);
    if (!file) return;
    openTab = path;
    if (isText(file)) {
      hidePreview();
      active = path;
      textActive = path;
      cm.swapDoc(docFor(file));
      void save();
    } else {
      showPreview(file);
    }
    renderTabs();
  };

  const filesChanged = () => {
    renderTabs();
    void save();
    onChange?.(null);
  };

  /** Asks for a file name until it is valid, or the reader cancels. */
  const askPath = (suggestion, except, isTextFile) => {
    let value = suggestion;
    for (;;) {
      const path = window.prompt(t("ide-filename-prompt"), value);
      if (path === null) return null;
      const problem = checkNewPath(
        path,
        files,
        isTextFile ? accept : [],
        except,
      );
      if (!problem) return path.trim();
      window.alert(
        t(`ide-filename-${problem}`, { extensions: accept.join(", ") }),
      );
      value = path;
    }
  };

  const addFile = () => {
    const path = askPath(accept[0] ? `new${accept[0]}` : "", null, true);
    if (path === null) return;
    files.push({ path, content: "", created: true });
    open(path);
    filesChanged();
  };

  const uploadFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.addEventListener("change", async () => {
      const upload = input.files?.[0];
      if (!upload) return;
      const path = upload.name;
      const existing = fileAt(path);
      if (existing) {
        if (!existing.created) {
          window.alert(t("ide-filename-exists"));
          return;
        }
        if (!window.confirm(t("ide-file-replace", { file: path }))) return;
        files = files.filter((file) => file.path !== path);
        docs.delete(path);
      }
      const asText = isTextPath(path);
      const data = await readUpload(upload, asText);
      files.push(
        asText
          ? { path, content: data, created: true }
          : { path, url: data, created: true },
      );
      open(path);
      filesChanged();
    });
    input.click();
  };

  const renameFile = (path) => {
    const file = fileAt(path);
    if (!file) return;
    const newPath = askPath(path, path, isText(file));
    if (newPath === null || newPath === path) return;
    if (!file.created) {
      // The page's file is gone for this reader; theirs takes its place.
      removed = [...removed, path];
      file.created = true;
    }
    removed = removed.filter((p) => p !== newPath);
    file.path = newPath;
    const doc = docs.get(path);
    docs.delete(path);
    if (doc) docs.set(newPath, doc);
    if (active === path) active = newPath;
    if (textActive === path) textActive = newPath;
    if (openTab === path) openTab = newPath;
    filesChanged();
  };

  const deleteFile = (path) => {
    const file = fileAt(path);
    if (!file) return;
    if (!window.confirm(t("ide-delete-file-confirm", { file: path }))) return;
    if (!file.created) removed = [...removed, path];
    files = files.filter((f) => f.path !== path);
    docs.delete(path);
    if (openTab === path || active === path) open(page.main);
    filesChanged();
  };

  // The tabs appear once the saved row is merged in, so until then the editor
  // shows the main file and nothing else.
  tabs.hidden = true;

  // --- buttons and layout ---------------------------------------------------

  buttons.reset?.addEventListener("click", async () => {
    if (!window.confirm(t("ide-reset-prompt"))) return;
    await hyperbook.store.db.ide.delete(id);
    window.location.reload();
  });

  buttons.copy?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(fileAt(textActive)?.content ?? "");
    } catch (error) {
      console.error(error.message);
    }
  });

  buttons.download?.addEventListener("click", () => void download());

  /** Downloads the open file, or the whole workspace as a ZIP. */
  const download = async () => {
    const shown = visibleFiles();
    if (shown.length === 1 || typeof window.UZIP === "undefined") {
      const file = fileAt(textActive) ?? shown[0];
      triggerDownload(
        new Blob([file?.content ?? ""], { type: "text/plain" }),
        basename(file?.path ?? "file.txt"),
      );
      return;
    }
    const encoder = new TextEncoder();
    const zipFiles = {};
    for (const file of shown) {
      if (isText(file)) {
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
    triggerDownload(
      new Blob([window.UZIP.encode(zipFiles)], { type: "application/zip" }),
      `${runtime}-${id}.zip`,
    );
  };

  setupFullscreen(elem, buttons.fullscreen);

  const applyStoredSplitSize = setupSplitter(
    elem,
    layout.container,
    layout.editorContainer,
    layout.splitter,
    (sizes) => {
      ui = { ...ui, ...sizes };
      void save();
    },
  );

  // --- restore --------------------------------------------------------------

  const ready = hyperbook.store.db.ide.get(id).then((saved) => {
    const merged = mergeWorkspace(page, saved, { allowCreate: keepsOwnFiles });
    files = merged.files;
    removed = merged.removed;
    ui = { ...(saved?.ui || {}) };
    extra = { ...(saved?.extra || {}) };
    migratedFrom = saved?.migratedFrom;

    // Only the main file has a document yet, and it is the one on screen.
    const mainFile = fileAt(page.main);
    if (mainFile && saved && cm.getValue() !== mainFile.content) {
      applying = true;
      cm.setValue(mainFile.content ?? "");
      applying = false;
    } else if (mainFile) {
      // Nothing saved: keep whatever was typed while the row was loading.
      mainFile.content = cm.getValue();
    }
    if (merged.active !== page.main) open(merged.active);
    else renderTabs();

    for (const key of ["splitHorizontal", "splitVertical"]) {
      if (Number.isFinite(ui[key]) && ui[key] > 0) {
        elem.dataset[key] = String(Math.round(ui[key]));
      }
    }
    applyStoredSplitSize?.();
    onRestore?.(ui, extra);
  });

  return {
    cm,
    ready,
    get main() {
      return page.main;
    },
    get active() {
      return active;
    },
    /** All files with their current contents, hidden and test files included. */
    files() {
      return files.map((file) => ({ ...file }));
    },
    /** @param {string} path */
    content(path) {
      return fileAt(path)?.content;
    },
    /**
     * Replaces a text file's content from code, e.g. a parameter a reader set
     * in a form. Does not call onChange; the caller knows what changed.
     */
    setContent(path, content) {
      const file = fileAt(path);
      if (!file || !isText(file) || file.content === content) return;
      file.content = content;
      if (path === active) {
        applying = true;
        cm.setValue(content);
        applying = false;
      } else {
        docs.delete(path);
      }
      void save();
    },
    /** Remembers ui state, e.g. a runtime's own splitter sizes. */
    saveUi(sizes) {
      ui = { ...ui, ...sizes };
      return save();
    },
    /** Runtime state saved with the row, once the row was restored. */
    get extra() {
      return { ...extra };
    },
    /** Remembers runtime state, e.g. OpenSCAD's parameter values. */
    saveExtra(values) {
      extra = { ...extra, ...values };
      return save();
    },
    download,
    applyStoredSplitSize,
  };
};

window.HyperbookIDE = {
  mount,
  compare: { compareImages, createComparison, loadImage, normalize },
  setupSplitter,
  setupFullscreen,
  toggleFullscreen,
  updateFullscreenButtonState,
};
