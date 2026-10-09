/// <reference path="../hyperbook.types.js" />

/**
 * Blockflow editor client script.
 * Resolves project URLs against the book page before opening the bundled editor.
 *
 * The ?project= parameter accepts:
 *   - A base64-encoded JSON string (no origin prepended)
 *   - A URL to a .json project file
 *   - A URL to an .sb3 Scratch project
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
        var url = new URL(src, document.baseURI);
        var project = url.searchParams.get("project");
        if (project && !project.match(/^[a-z][a-z\d+.-]*:/i) && isRelativeUrl(project)) {
          url.searchParams.set("project", new URL(project, document.baseURI).href);
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
