/// <reference path="../hyperbook.types.js" />

/**
 * Blockflow player client script.
 * Resolves project URLs against the book page before opening the bundled player.
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
        var url = new URL(src, document.baseURI);
        var project = url.searchParams.get("project");
        if (project && !project.match(/^[a-z][a-z\d+.-]*:/i)) {
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
