hyperbook.protect = (function () {
  /**
   * @param {HTMLInputElement} inputEl
   * @param {HTMLElement} el
   */
  function onInputToast(inputEl, el) {
    const value = inputEl.value;
    const id = el.getAttribute("data-id");

    store.protect.put({ id, passwordHash: btoa(value) }).then(() => {
      const els = document.querySelectorAll(
        `input[data-id="${el.getAttribute("data-id")}"]`
      );
      els.forEach((el) => el.dispatchEvent(new Event("check")));
    });
  }

  /**
   * @param {HTMLInputElement} inputEl
   * @param {HTMLElement} el
   * @param {HTMLElement} hiddenEl
   */
  function onUpdateToast(inputEl, el, hiddenEl) {
    const id = el.getAttribute("data-id");
    store.protect.get(id).then((result) => {
      if (result) {
        const value = atob(result.passwordHash);
        inputEl.value = value;
        const toast = atob(el.getAttribute("data-toast"));

        if (toast === value) {
          while (el.lastElementChild) {
            el.removeChild(el.lastElementChild);
          }
          hiddenEl.classList.remove("hidden");
          el.appendChild(hiddenEl);
        }
      }
    });
  }

  /**
   * Initialize elements within the given root element.
   * @param {HTMLElement} root - The root element to initialize.
   */
  function init(root) {
    const els = root.getElementsByClassName("directive-protect");
    for (let el of els) {
      const inputEl = el.getElementsByTagName("input")[0];
      const id = el.getAttribute("data-id");

      if (!inputEl) continue;
      store.protect.get(id).then((result) => {
        if (result) {
          inputEl.value = atob(result.passwordHash);
        } else {
          inputEl.value = "";
        }
      });

      const hiddenEL = el.getElementsByClassName("hidden")[0];
      el.removeChild(hiddenEL);

      onUpdateToast(inputEl, el, hiddenEL);
      inputEl.addEventListener("input", () => onInputToast(inputEl, el));
      inputEl.addEventListener("check", () => {
        onUpdateToast(inputEl, el, hiddenEL);
      });
    }
  }

  // Initialize existing elements on document load
  document.addEventListener("DOMContentLoaded", () => {
    init(document);
  });

  // Observe for new elements added to the DOM
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          // Element node
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
