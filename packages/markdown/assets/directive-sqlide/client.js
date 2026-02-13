/// <reference path="../hyperbook.types.js" />

/**
 * SQL IDE integration.
 * @type {HyperbookSqlide}
 * @memberof hyperbook
 */
hyperbook.sqlide = (function () {
  /**
   * @param {HTMLElement} el
   */
  function openFullscreen(el) {
    const frameEl =
      el.parentElement.parentElement.getElementsByClassName("sql-online")[0];
    frameEl.requestFullscreen();
  }

  return {
    openFullscreen,
  };
})();
