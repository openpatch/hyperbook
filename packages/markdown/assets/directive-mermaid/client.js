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
            element.innerHTML = element.getAttribute("data-mermaid");
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
    const colorSchemeQueryList = window.matchMedia(
      "(prefers-color-scheme: dark)",
    );

    const setColorScheme = (e) => {
      if (e.matches) {
        resetProcessed().then(loadMermaid("dark")).catch(console.error);
      } else {
        resetProcessed().then(loadMermaid("default")).catch(console.error);
      }
    };

    if (colorSchemeQueryList.matches) {
      resetProcessed().then(loadMermaid("dark")).catch(console.error);
    } else {
      resetProcessed().then(loadMermaid("default")).catch(console.error);
    }
    colorSchemeQueryList.addEventListener("change", setColorScheme);
  };

  init();
})();
