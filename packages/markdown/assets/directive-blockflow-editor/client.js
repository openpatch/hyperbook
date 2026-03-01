/// <reference path="../hyperbook.types.js" />

/**
 * Blockflow editor client script.
 * Prepends window.origin to relative project URLs so that
 * blockflow.openpatch.org can fetch them cross-origin.
 *
 * The ?project= parameter accepts:
 *   - A base64-encoded JSON string (no origin prepended)
 *   - A URL to a .json project file (origin prepended if relative)
 *   - A URL to an .sb3 Scratch project (origin prepended if relative)
 */
(function () {
  function isRelativeUrl(value) {
    return /\.(json|sb3)($|\?)/.test(value) || value.startsWith("/");
  }

  function fixIframes(root) {
    var iframes = root.querySelectorAll
      ? root.querySelectorAll(".directive-blockflow-editor iframe")
      : [];
    iframes.forEach(function (iframe) {
      var src = iframe.getAttribute("src");
      if (!src) return;
      try {
        var url = new URL(src);
        var project = url.searchParams.get("project");
        if (project && !project.match(/^https?:\/\//) && isRelativeUrl(project)) {
          url.searchParams.set("project", window.origin + project);
          iframe.setAttribute("src", url.toString());
        }
      } catch (e) {
        // ignore malformed URLs
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    fixIframes(document);
  });
})();
