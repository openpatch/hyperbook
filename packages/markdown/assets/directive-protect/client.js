hyperbook.protect = (function () {
  /**
   * @param {HTMLInputElement} inputEl
   * @param {HTMLElement} el
   */
  function onInputToast(inputEl, el) {
    const value = inputEl.value;
    setLocalStorage(el.getAttribute("data-id"), value);

    const els = document.querySelectorAll(
      `input[data-id="${el.getAttribute("data-id")}"]`,
    );
    els.forEach((el) => el.dispatchEvent(new Event("check")));
  }

  /**
   * @param {HTMLInputElement} inputEl
   * @param {HTMLElement} el
   * @param {HTMLElement} hiddenEl
   */
  function onUpdateToast(inputEl, el, hiddenEl) {
    const value = getLocalStorage(el.getAttribute("data-id"));
    const toast = atob(el.getAttribute("data-toast"));
    if (value) {
      inputEl.value = value;
    }
    if (toast === value) {
      while (el.lastElementChild) {
        el.removeChild(el.lastElementChild);
      }
      hiddenEl.classList.remove("hidden");
      el.appendChild(hiddenEl);
    }
  }

  /*
   * @param {string} id
   * @return {string | undefined} value
   */
  function getLocalStorage(id) {
    const protect = JSON.parse(localStorage.getItem("protect") || "{}");
    const value = protect[id];
    if (value) {
      return atob(value);
    }
    return undefined;
  }

  /*
   * @param {string} id
   * @param {string} value
   */
  function setLocalStorage(id, value) {
    const protect = JSON.parse(localStorage.getItem("protect") || "{}");
    protect[id] = btoa(value);
    localStorage.setItem("protect", JSON.stringify(protect));
  }

  function init() {
    const els = document.getElementsByClassName("directive-protect");
    for (let el of els) {
      const inputEl = el.getElementsByTagName("input")[0];

      if (!inputEl) continue;
      inputEl.value = getLocalStorage(el.getAttribute("data-id")) || "";

      const hiddenEL = el.getElementsByClassName("hidden")[0];
      el.removeChild(hiddenEL);

      onUpdateToast(inputEl, el, hiddenEL);
      inputEl.addEventListener("input", () => onInputToast(inputEl, el));
      inputEl.addEventListener("check", () => {
        console.log("update");
        onUpdateToast(inputEl, el, hiddenEL);
      });
    }
  }

  init();
})();
