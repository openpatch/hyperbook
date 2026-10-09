import {
  DownloadableElement,
  HyperbookContext,
  elementCdn,
} from "@hyperbook/types";
import packageJson from "../package.json";
import runtimeAssets from "../runtime-assets.json";

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
  return `https://unpkg.com/@hyperbook/markdown@${packageJson.version}/dist/assets/directive-${element}/${file}`;
}
