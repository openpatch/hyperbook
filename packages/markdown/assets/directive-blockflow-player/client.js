/// <reference path="../hyperbook.types.js" />

/**
 * Blockflow player client script.
 * Prepends window.origin to relative project URLs so that
 * blockflow.openpatch.org can fetch them cross-origin.
 */
(function () {
  function fixIframes(root) {
    var iframes = root.querySelectorAll
      ? root.querySelectorAll(".directive-blockflow-player iframe")
      : [];
    iframes.forEach(function (iframe) {
      var src = iframe.getAttribute("src");
      if (!src) return;
      try {
        var url = new URL(src);
        var project = url.searchParams.get("project");
        if (project && !project.match(/^https?:\/\//)) {
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
