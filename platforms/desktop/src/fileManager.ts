import { hyperbook, hyperproject, vfile, VFile } from "@hyperbook/fs";
import { BrowserWindow, ipcMain } from "electron";
import { Hyperproject } from "@hyperbook/types";
import { FSWatcher, watch } from "chokidar";
import { parseTocFromMarkdown } from "@hyperbook/toc";
import { FileChangedEvent, ConfigChangeEvent, OpenFileEvent } from "./events";

export class FileManager {
  watcher: FSWatcher;
  private _root: string;
  private _vfile: VFile | null;
  private _vfiles: VFile[];
  private _mainWindow: BrowserWindow;
  private _project: Hyperproject | null;
  private _activeRoot: string | null;

  constructor(path: string, mainWindow: BrowserWindow) {
    this._root = path;
    this._mainWindow = mainWindow;
    this._vfiles = [];
    this._vfile = null;
    this._project = null;
    this._activeRoot = null;

    this.watcher = watch(this._root, {
      ignored: /[\/\\]\./,
      persistent: true,
      followSymlinks: true,
    });
    this.watcher.on("add", () => this.onAdd());
    this.watcher.on("change", () => this.onChange());
    ipcMain.on("READY", () => this.start());
    ipcMain.on("OPEN_FILE", (_, args) => this.onOpenFile(args));
  }

  async start() {
    this._project = await hyperproject.get(this._root);
    if (this._project.type === "book") {
      this._activeRoot = this._project.src;
    } else if (this._project.type === "library") {
      this._activeRoot =
        this._project.projects.find((p) => p.basePath === "/")?.src ?? null;
    }

    if (this._activeRoot !== null) {
      this._vfiles = await vfile.list(this._activeRoot);
      this._vfile = this._vfiles.find((f) => f.path.href === "/") ?? null;

      this.emitFileChangedEvent();
      this.emitConfigChangedEvent();
    }
  }
  async onOpenFile(event: OpenFileEvent) {
    if (this._project?.type === "library") {
      const newActive = this._project.projects.find((p) => {
        if (event.path === "/" && p.basePath === "/") {
          return p;
        } else if (event.path === "/" + p.basePath) {
          return p;
        }
      });
      if (newActive && newActive.src !== this._activeRoot) {
        this._activeRoot = newActive.src;
        this._vfiles = await vfile.list(this._activeRoot);
        this._vfile = this._vfiles.find((f) => f.path.href === "/") ?? null;
        this.emitFileChangedEvent();
        this.emitConfigChangedEvent();
        return;
      }
    }

    this._vfile = this._vfiles.find((f) => f.path.href === event.path) ?? null;
    this.emitFileChangedEvent();
  }
  async onChange() {
    this.emitFileChangedEvent();
  }
  async onAdd() {
    if (this._activeRoot) {
      this._vfiles = await vfile.list(this._activeRoot);
      this.emitFileChangedEvent();
    }
  }

  async emitConfigChangedEvent() {
    if (this._activeRoot) {
      const config = await hyperbook.find(this._activeRoot);
      const links = [];
      if (config.links) {
        links.push(...config.links);
      }
      if (this._project && this._project.type === "library") {
        const link = await hyperproject.getLink(this._project, config.language);
        links.push(link);
      }

      this._mainWindow.webContents.send("CONFIG_CHANGE", {
        ...config,
        links,
      } as ConfigChangeEvent);
    }
  }
  async emitFileChangedEvent() {
    if (this._vfile && this._activeRoot) {
      const { content, data } = await vfile.getMarkdown(this._vfile);
      const navigation = await hyperbook.getNavigation(
        this._activeRoot,
        this._vfile
      );
      const toc = parseTocFromMarkdown(content);
      this._mainWindow.webContents.send("FILE_CHANGED", {
        content,
        data,
        navigation,
        toc,
        assetsPath: "hyperbook-public://" + this._activeRoot + "/",
      } as FileChangedEvent);
    }
  }
}
