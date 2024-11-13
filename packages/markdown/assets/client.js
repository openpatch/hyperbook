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
  // search

  const searchInputEl = document.getElementById("search-input");
  searchInputEl.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      search();
    }
  });

  function searchToggle() {
    const searchDrawerEl = document.getElementById("search-drawer");
    searchDrawerEl.open = !searchDrawerEl.open;
  }

  function search() {
    const resultsEl = document.getElementById("search-results");
    resultsEl.innerHTML = "";
    const query = searchInputEl.value;
    const idx = window.lunr.Index.load(LUNR_INDEX);
    const documents = SEARCH_DOCUMENTS;
    const results = idx.search(query);
    for (let result of results) {
      const doc = documents[result.ref];

      const container = document.createElement("a");
      container.href = doc.href;
      container.classList.add("search-result");
      const heading = document.createElement("div");
      heading.textContent = doc.heading;
      heading.classList.add("search-result-heading");
      const content = document.createElement("div");
      content.classList.add("search-result-content");
      const href = document.createElement("div");
      href.classList.add("search-result-href");
      href.textContent = doc.href;

      let contentHTML = "";
      const terms = Object.keys(result.matchData.metadata);
      const term = terms[0];
      if (result?.matchData?.metadata?.[term]?.content?.position?.length > 0) {
        const pos = result.matchData.metadata[term].content.position[0];
        const start = pos[0];
        const len = pos[1];
        let cutoffBefore = start - 50;
        if (cutoffBefore < 0) {
          cutoffBefore = 0;
        } else {
          contentHTML += "...";
        }
        contentHTML += doc.content.slice(cutoffBefore, start);

        contentHTML += `<mark>${doc.content.slice(start, start + len)}</mark>`;
        let cutoffAfter = start + len + 50;

        contentHTML += doc.content.slice(start + len, cutoffAfter);
        if (cutoffAfter < doc.content.length) {
          contentHTML += "...";
        }
      }

      content.innerHTML = contentHTML;

      container.appendChild(heading);
      container.appendChild(content);
      container.appendChild(href);
      resultsEl.appendChild(container);
    }
  }

  function qrcodeOpen() {
    const qrCodeDialog = document.getElementById("qrcode-dialog");
    const qrcodeEls = qrCodeDialog.getElementsByClassName("make-qrcode");
    const urlEls = qrCodeDialog.getElementsByClassName("url");
    const qrcodeEl = qrcodeEls[0];
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
    for (let urlEl of urlEls[0].children) {
      const href = urlEl.getAttribute("data-href");
      urlEl.innerHTML = `${window.location.origin}${href}`;
    }

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
    searchToggle,
    search,
    qrcodeOpen,
    qrcodeClose,
  };
})();
