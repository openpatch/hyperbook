hyperbook.slideshow = (function () {
  /**
   * @param {string} id
   */
  const update = (id) => {
    const el = document.querySelector(`.slideshow[data-id="${id}"]`);
    let active = Number(el.getAttribute("data-active"));
    const dots = document.querySelectorAll(`.dot[data-id="${id}"]`);
    const images = document.querySelectorAll(
      `.image-container[data-id="${id}"]`,
    );
    dots.forEach((dot) => {
      dot.className = dot.className.replace(" active", "");
      if (dot.getAttribute("data-index") == active) {
        dot.className += " active";
      }
    });
    images.forEach((e) => {
      e.className = e.className.replace(" active", "");
      if (e.getAttribute("data-index") == active) {
        e.className += " active";
      }
    });
  };

  /**
   * @param {string} id
   * @param {number} steps
   */
  const moveBy = (id, steps) => {
    const el = document.querySelector(`.slideshow[data-id="${id}"]`);
    const images = document.querySelectorAll(`.dot[data-id="${id}"]`);
    let active = Number(el.getAttribute("data-active"));
    active += steps;
    active = ((active % images.length) + images.length) % images.length;
    el.setAttribute("data-active", active);
    window.hyperbook.slideshow.update(id);
  };

  /**
   * @param {string} id
   * @param {number} index
   */
  const setActive = (id, index) => {
    const el = document.querySelector(`.slideshow[data-id="${id}"]`);
    const images = document.querySelectorAll(`.dot[data-id="${id}"]`);
    if (index >= 0 && index < images.length) {
      el.setAttribute("data-active", index);
    }
    window.hyperbook.slideshow.update(id);
  };

  const init = (root) => {
    const slideshows = root.getElementsByClassName("slideshow");
    for (let slideshow of slideshows) {
      const id = slideshow.getAttribute("data-id");
      update(id);
    }
  };

  // Initialize existing slideshows on document load
  document.addEventListener("DOMContentLoaded", () => {
    init(document);
  });

  // Observe for new slideshows added to the DOM
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
    update,
    moveBy,
    setActive,
    init,
  };
})();
