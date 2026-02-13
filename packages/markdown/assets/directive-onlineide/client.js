/// <reference path="../hyperbook.types.js" />

/**
 * Online IDE integration.
 * @type {HyperbookOnlineide}
 * @memberof hyperbook
 */
hyperbook.onlineide = (function () {
  /**
   * @param {HTMLElement} el
   */
  function openFullscreen(el) {
    const frameEl =
      el.parentElement.parentElement.getElementsByClassName("java-online")[0];
    frameEl.requestFullscreen();
  }

  return {
    openFullscreen,
  };
})();
