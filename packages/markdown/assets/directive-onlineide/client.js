hyperbook.onlineide = (function () {
  /**
   * @param {HTMLElement} el
   */
  function openFullscreen(el) {
    const iframeEl =
      el.parentElement.parentElement.getElementsByTagName("iframe")[0];
    iframeEl.requestFullscreen();
  }

  return {
    openFullscreen,
  };
})();
