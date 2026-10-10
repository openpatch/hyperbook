import {
  DownloadableElement,
  HyperbookContext,
  elementCdn,
} from "@hyperbook/types";
import excalidrawPackageJson from "../../web-component-excalidraw/package.json";
import runtimeAssets from "../runtime-assets.json";
import ideReleases from "../ide-releases.json";
import openscadConfig from "../openscad-config.json";

/** Hosted Blockflow app; the npm package does not include Blockflow's bundle. */
const blockflowCdn = "https://blockflow.openpatch.org/";

/** Resolve payload files; Hyperbook's integration scripts stay local. */
export function elementAssetUrl(
  ctx: HyperbookContext,
  element: DownloadableElement,
  file: string,
): string {
  const cdn = elementCdn(ctx.config, element);
  if (!cdn)
    return (
      ctx.makeUrl(
        [`directive-${element}`, ...file.split("/").filter(Boolean)],
        "assets",
        undefined,
        { versioned: false },
      ) + (file.endsWith("/") ? "/" : "")
    );
  if (typeof cdn === "string") {
    // Pyodide's public indexURL points directly at its distribution directory.
    return new URL(
      element === "pyide" ? file.replace(/^pyodide\//, "") : file,
      cdn,
    ).href;
  }
  if (element === "onlineide" || element === "sqlide") {
    return new URL(
      file,
      `https://cdn.openpatch.org/${element}/${ideReleases[element]}/`,
    ).href;
  }
  if (element === "openscad") {
    return new URL(
      file,
      `https://cdn.openpatch.org/openscad/${openscadConfig.wasmBuild.cdnVersion}/`,
    ).href;
  }
  if (element === "pyide") {
    const version = runtimeAssets
      .find((asset) => asset.target === "directive-pyide")!
      .url.match(/download\/([^/]+)\//)![1];
    return `https://cdn.jsdelivr.net/pyodide/v${version}/full/${file.replace(/^pyodide\//, "")}`;
  }
  if (element === "typst") {
    const asset = runtimeAssets.find(
      (asset) => asset.target === `directive-typst/${file}`,
    );
    if (asset) return asset.url;
    if (file === "fonts/") {
      const fonts = runtimeAssets.find(
        (asset) => asset.target === "directive-typst/fonts",
      )!;
      const tag = fonts.url.match(/tags\/([^/]+)\.tar\.gz$/)![1];
      return `https://cdn.jsdelivr.net/gh/typst/typst-assets@${tag}/files/fonts/`;
    }
  }
  if (element === "geogebra") {
    const version = runtimeAssets
      .find((asset) => asset.target === "directive-geogebra")!
      .url.match(/geogebra-math-apps-bundle-([\d-]+)\.zip$/)![1]
      .replaceAll("-", ".");
    const relative = file
      .replace(/^GeoGebra\/(?:HTML5\/)?/, "")
      .replace(/^5\.0\//, `${version}/`);
    return `https://www.geogebra.org/apps/${relative}`;
  }
  if (element === "blockflow") return new URL(file, blockflowCdn).href;
  if (element === "excalidraw") {
    // The npm package omits Excalidraw's fonts and bundle; use their own packages.
    if (file === "hyperbook-excalidraw.umd.js")
      return `https://unpkg.com/${excalidrawPackageJson.name}@${excalidrawPackageJson.version}/dist/index.umd.js`;
    const base = `https://unpkg.com/@excalidraw/excalidraw@${excalidrawPackageJson.dependencies["@excalidraw/excalidraw"]}/dist/prod/`;
    return file === "excalidraw.css"
      ? `${base}index.css`
      : new URL(file, base).href;
  }
  throw new Error(`No default CDN asset for ${element}/${file}`);
}
