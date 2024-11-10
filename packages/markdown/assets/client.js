var hyperbook = (function () {
  const collapsibles = document.getElementsByClassName("collapsible");
  const animationDelay = 100;
  const calcMaxHeight = (elem) => {
    const content = elem.nextElementSibling;
    if (content) {
      if (elem.classList.contains("expanded")) {
        content.style.maxHeight = content.scrollHeight + "px";
      } else {
        content.style.maxHeight = "0";
      }
    }
    const nextParentContent = elem.closest(".collapsible-content");
    if (nextParentContent !== null) {
      const nextParentCollapsible = nextParentContent.previousElementSibling;
      setTimeout(function () {
        calcMaxHeight(nextParentCollapsible);
      }, animationDelay);
    }
  };
  for (let collapsible of collapsibles) {
    collapsible.addEventListener("click", () => {
      collapsible.classList.toggle("expanded");
      calcMaxHeight(collapsible);
    });

    if (collapsible.classList.contains("expanded")) {
      calcMaxHeight(collapsible);
    }
  }

  function tocToggle() {
    const tocDrawerEl = document.getElementById("toc-drawer");
    tocDrawerEl.open = !tocDrawerEl.open;
  }

  function qrcodeOpen() {
    const qrCodeDialog = document.getElementById("qrcode-dialog");
    const qrcodeEls = qrCodeDialog.getElementsByClassName("make-qrcode");
    const urlEls = qrCodeDialog.getElementsByClassName("url");
    const qrcodeEl = qrcodeEls[0];
    const urlEl = urlEls[0];
    const qrcode = new window.QRCode({
      content: window.location.href,
      padding: 0,
      join: true,
      color: "var(--color-text)",
      container: "svg-viewbox",
      background: "var(--color-background)",
      ecl: "M",
    });
    qrcodeEl.innerHTML = qrcode.svg();
    urlEl.innerHTML = window.location.href;

    qrCodeDialog.showModal();
  }

  function qrcodeClose() {
    const qrCodeDialog = document.getElementById("qrcode-dialog");
    qrCodeDialog.close();
  }

  function navToggle() {
    const navDrawerEl = document.getElementById("nav-drawer");
    navDrawerEl.open = !navDrawerEl.open;
  }

  /**
   * @param {string} key
   * @param {string} label
   */
  function toggleBookmark(key, label) {
    const bookmarks = JSON.parse(localStorage.getItem("bookmarks") || "{}");
    const el = document.querySelectorAll(`.bookmark[data-key="${key}"]`);
    if (bookmarks[key]) {
      delete bookmarks[key];
      el.forEach((e) => e.classList.remove("active"));
    } else {
      bookmarks[key] = label;
      el.forEach((e) => e.classList.add("active"));
    }
    localStorage.setItem("bookmarks", JSON.stringify(bookmarks));

    if (hyperbook.bookmarks) {
      hyperbook.bookmarks.update();
    }
  }

  function initBookmarks() {
    const bookmarkEls = document.getElementsByClassName("bookmark");
    const bookmarks = JSON.parse(localStorage.getItem("bookmarks") || "{}");
    for (let bookmarkEl of bookmarkEls) {
      const key = bookmarkEl.getAttribute("data-key");
      if (bookmarks[key]) {
        bookmarkEl.classList.add("active");
      }
    }
  }
  initBookmarks();

  /**
   * @param {HTMLElement} el
   */
  function toggleLightbox(el) {
    el.parentElement.classList.toggle("lightbox");
    el.parentElement.classList.toggle("normal");
  }
  return {
    toggleLightbox,
    toggleBookmark,
    navToggle,
    tocToggle,
    qrcodeOpen,
    qrcodeClose,
  };
})();
