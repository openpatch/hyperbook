hyperbook.bookmarks = (function () {
  function update() {
    const bookmarks = JSON.parse(localStorage.getItem("bookmarks") || "{}");

    const containerEls = document.getElementsByClassName("directive-bookmarks");
    for (let containerEl of containerEls) {
      const elements = [];
      Object.entries(bookmarks).forEach(([key, label]) => {
        const bookmarkEl = document.createElement("li");
        const link = document.createElement("a");
        link.href = key;
        link.innerHTML = label;
        bookmarkEl.append(link);
        elements.push(bookmarkEl);
      });
      containerEl.replaceChildren(...elements);
    }
  }
  update();

  return {
    update,
  };
})();
