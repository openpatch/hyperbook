hyperbook.download = (function () {
  const init = (root) => {
    const els = root.getElementsByClassName("directive-download");
    for (let el of els) {
      const labelEl = el.getElementsByClassName("label")[0];

      const src = el.href;

      fetch(src).then((r) => {
        const isOnline = r.ok;
        if (isOnline) {
          labelEl.classList.remove("offline");
          labelEl.innerHTML.replace(`(${i18n.get("download-offline")})`, "");
        } else {
          labelEl.classList.add("offline");
          labelEl.innerHTML += ` (${i18n.get("download-offline")})`;
        }
      });
    }
  };

  // Initialize existing elements on document load
  document.addEventListener("DOMContentLoaded", () => {
    init(document);
  });

  // Observe for new elements added to the DOM
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { // Element node
          init(node);
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  return {
    init,
  };
})();
