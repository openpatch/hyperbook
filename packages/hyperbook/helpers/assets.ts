import path from "path";
import {
  AssetManager as SharedAssetManager,
  AssetOptions as SharedAssetOptions,
  assetCacheDir,
} from "@hyperbook/fs";
import remoteDirectives from "../asset-bundles.json";

export { assetCacheDir };
export type { AssetBundle, AssetManifest } from "@hyperbook/fs";

export type AssetOptions = Partial<Omit<SharedAssetOptions, "elements">>;

/** Large assets live outside the installation, so global and npx installs work too. */
export class AssetManager extends SharedAssetManager {
  constructor(options: AssetOptions = {}) {
    // helpers/ is flattened into dist/ by ncc. Source runs use the package root.
    const fromSource = path.basename(__dirname) === "helpers";
    const packagePath = fromSource ? path.dirname(__dirname) : __dirname;
    super({
      ...options,
      elements: remoteDirectives,
      assetsPath: options.assetsPath || path.join(packagePath, "assets"),
      manifestPath:
        options.manifestPath ||
        path.join(
          packagePath,
          ...(fromSource ? ["dist"] : []),
          "asset-manifest.json",
        ),
      bundlesPath:
        options.bundlesPath ||
        path.join(
          fromSource ? packagePath : path.dirname(packagePath),
          ".cache",
          "asset-bundles",
        ),
    });
  }
}
