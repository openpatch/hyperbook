/// <reference path="../hyperbook.types.js" />

const KIRI_BASE = "https://grid.space/kiri/";

/**
 * Convert any URL (relative, root-relative, or absolute) to the format
 * kiri expects in its load/wrk params.
 *
 * Kiri's parseOpt splits on ":" to separate key from value, so the value
 * must NOT contain colons (e.g. "localhost:8080" would break it).
 * Kiri then prepends `${location.protocol}//` to reconstruct the full URL.
 *
 * For relative/root-relative paths we resolve against the current origin.
 * For absolute URLs we strip the protocol prefix.
 *
 * @param {string} url
 * @returns {string}
 */
function toKiriUrlParam(url) {
  const absolute = new URL(url, window.location.href).href;
  return absolute.replace(/^https?:\/\//, "");
}

/**
 * Build the kiri:moto iframe URL from directive options.
 *
 * Kiri reads URL params via parseOpt which uses "key:value" pairs
 * separated by commas (NOT the standard "key=value&key2=value2" format):
 *   ?mode:FDM              → api.mode.set(mode)
 *   ?load:host/path        → api.platform.load_url(`${proto}//${value}`)
 *   ?wrk:host/path         → set_ctrl.import_url(`${proto}//${value}`)
 *
 * Shared settings are loaded via the URL hash fragment (not a query param):
 *   #setting/key           → restore saved settings by key
 *
 * @param {{ mode?: string, model?: string, workspace?: string, settings?: string }} opts
 * @returns {string}
 */
function buildKiriUrl({ mode, model, workspace, settings }) {
  const parts = [];

  if (mode) {
    parts.push(`mode:${encodeURIComponent(mode)}`);
  }

  if (model) {
    parts.push(`load:${toKiriUrlParam(model)}`);
  }

  if (workspace) {
    parts.push(`wrk:${toKiriUrlParam(workspace)}`);
  }

  let url = KIRI_BASE;
  if (parts.length) {
    url += `?${parts.join(",")}`;
  }
  if (settings) {
    url += `#${settings}`;
  }
  return url;
}

/**
 * Set up one .directive-kirimoto element.
 * @param {HTMLElement} el
 */
function initDirective(el) {
  const iframe = el.querySelector("iframe");
  if (!iframe) return;

  const mode = el.dataset.mode || null;
  const model = el.dataset.model || null;
  const workspace = el.dataset.workspace || null;
  const settings = el.dataset.settings || null;

  iframe.src = buildKiriUrl({ mode, model, workspace, settings });
}

/**
 * Kiri:Moto directive integration.
 * @memberof hyperbook
 */
hyperbook.kirimoto = (function () {
  /**
   * @param {HTMLElement} el - the Fullscreen button element
   */
  function openFullscreen(el) {
    const iframe = el.closest(".directive-kirimoto").querySelector("iframe");
    if (iframe) {
      iframe.requestFullscreen();
    }
  }

  document.querySelectorAll(".directive-kirimoto").forEach(initDirective);

  return { openFullscreen };
})();
