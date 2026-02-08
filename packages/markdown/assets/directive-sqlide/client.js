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
