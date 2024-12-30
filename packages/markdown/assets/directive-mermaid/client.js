hyperbook.mermaid = (function () {
  const elementCode = ".directive-mermaid";
  const loadMermaid = function (theme) {
    window.mermaid.initialize({ theme });
    window.mermaid.init({ theme }, document.querySelectorAll(elementCode));
  };
  const resetProcessed = function () {
    return new Promise((resolve, reject) => {
      try {
        var els = document.querySelectorAll(elementCode),
          count = els.length;
        els.forEach((element) => {
          if (element.getAttribute("data-mermaid") != null) {
            element.removeAttribute("data-processed");
            const data = atob(element.getAttribute("data-mermaid"));
            const escapedData = data
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#39;");
            element.innerHTML = escapedData;
          }
          count--;
          if (count == 0) {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  };

  const init = () => {
    const toggle = document.querySelector("dark-mode-toggle");
    if (toggle?.mode == "dark") {
      resetProcessed().then(loadMermaid("dark")).catch(console.error);
    } else {
      resetProcessed().then(loadMermaid("default")).catch(console.error);
    }

    document.addEventListener("colorschemechange", (e) => {
      if (e.detail.colorScheme === "dark") {
        resetProcessed().then(loadMermaid("dark")).catch(console.error);
      } else {
        resetProcessed().then(loadMermaid("default")).catch(console.error);
      }
    });
  };

  init();
})();
