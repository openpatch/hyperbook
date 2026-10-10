import * as vscode from "vscode";
import path from "path";
import { AssetManager, AssetOptions, assetCacheDir } from "@hyperbook/fs";
import { DownloadableElement, elementCoreFiles } from "@hyperbook/types";

export const runtimeElements = Object.keys(
  elementCoreFiles,
) as DownloadableElement[];

export const runtimeLabels: Record<DownloadableElement, string> = {
  blockflow: "Blockflow",
  excalidraw: "Excalidraw",
  geogebra: "GeoGebra",
  onlineide: "Online IDE",
  openscad: "OpenSCAD",
  pyide: "PyIDE (Pyodide)",
  sqlide: "SQL IDE",
  typst: "Typst",
};

/** Where an element's runtime is available to the preview. */
export type RuntimeLocation =
  | { kind: "bundled" }
  | { kind: "cached"; directory: string }
  | { kind: "missing" };

/**
 * Element runtimes in the Hyperbook CLI's asset cache.
 *
 * The extension does not ship large runtimes. It shares the CLI's cache
 * folder and its verified, content-addressed bundles, so a runtime fetched by
 * `hyperbook assets fetch` is used here too, and the other way round.
 */
export default class RuntimeAssets {
  readonly cacheDir = assetCacheDir();
  private readonly options: AssetOptions;
  private readonly bundled: string;
  private readonly found = new Map<DownloadableElement, RuntimeLocation>();
  private readonly changed = new vscode.EventEmitter<void>();
  /** Fires after a download added runtimes to the cache. */
  readonly onDidChange = this.changed.event;

  constructor(extensionPath: string) {
    this.bundled = path.join(extensionPath, "assets", "hyperbook");
    this.options = {
      cacheDir: this.cacheDir,
      assetsPath: this.bundled,
      // Copied from the CLI build, which publishes the matching bundles.
      manifestPath: path.join(extensionPath, "out", "asset-manifest.json"),
      bundlesPath: path.join(extensionPath, "asset-bundles"),
    };
  }

  /** Looks the runtime up without downloading it. */
  async locate(element: DownloadableElement): Promise<RuntimeLocation> {
    const known = this.found.get(element);
    if (known) {
      return known;
    }
    let location: RuntimeLocation;
    try {
      const directory = await new AssetManager({
        ...this.options,
        offline: true,
      }).ensure(element);
      location =
        directory === path.join(this.bundled, `directive-${element}`)
          ? { kind: "bundled" }
          : directory
            ? { kind: "cached", directory }
            : { kind: "missing" };
    } catch {
      location = { kind: "missing" };
    }
    // A missing runtime is looked up again, since the CLI may fetch it.
    if (location.kind !== "missing") {
      this.found.set(element, location);
    }
    return location;
  }

  /** Downloads and verifies runtimes into the shared cache. */
  async download(elements: readonly DownloadableElement[]): Promise<boolean> {
    const pending: DownloadableElement[] = [];
    for (const element of elements) {
      if ((await this.locate(element)).kind === "missing") {
        pending.push(element);
      }
    }
    if (pending.length === 0) {
      vscode.window.showInformationMessage(
        "Hyperbook: The selected runtimes are already available.",
      );
      return true;
    }
    const failed: string[] = [];
    const manager = new AssetManager(this.options);
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Hyperbook: Downloading runtimes",
      },
      async (progress) => {
        for (const [index, element] of pending.entries()) {
          progress.report({
            message: `${runtimeLabels[element]} (${index + 1}/${pending.length})`,
            increment: index === 0 ? 0 : 100 / pending.length,
          });
          try {
            await manager.ensure(element);
          } catch (error: any) {
            failed.push(`${runtimeLabels[element]}: ${error.message}`);
          }
        }
      },
    );
    this.changed.fire();
    if (failed.length > 0) {
      vscode.window.showErrorMessage(
        `Hyperbook: Some runtimes could not be downloaded. The preview keeps loading them from their CDN. ${failed.join(" ")}`,
      );
      return false;
    }
    vscode.window.showInformationMessage(
      `Hyperbook: Downloaded ${pending.map((element) => runtimeLabels[element]).join(", ")} to ${this.cacheDir}.`,
    );
    return true;
  }
}
