hyperbook.scratchblock = (function () {
  const init = () => {
    scratchblocks.renderMatching("pre.directive-scratchblock", {
      style: "scratch3",
      languages: [
        "en",
        "de",
        "es",
        "fr",
        "zh_cn",
        "pl",
        "ja",
        "nl",
        "pt",
        "it",
        "he",
        "ko",
        "nb",
        "tr",
        "el",
        "ru",
        "ca",
        "id",
      ],
      scale: 1,
    });
  };

  document.addEventListener("DOMContentLoaded", () => {
    init();
  });

  // Observe for new elements
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1 && node.matches("pre.directive-scratchblock")) {
          init();
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
