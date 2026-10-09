/// <reference path="../hyperbook.types.js" />

window.EXCALIDRAW_ASSET_PATH =
  document
    .querySelector(".directive-excalidraw[data-asset-base]")
    ?.getAttribute("data-asset-base") ||
  window.HYPERBOOK_ASSETS + "directive-excalidraw/";

/**
 * Excalidraw whiteboard integration.
 * @type {HyperbookExcalidraw}
 * @memberof hyperbook
 */
hyperbook.excalidraw = (function () {
  const elems = document.getElementsByClassName("directive-excalidraw");

  return {};
})();
