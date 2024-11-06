hyperbook.download = (function () {
  function init() {
    const els = document.getElementsByClassName("directive-archive");
    for (let el of els) {
      const labelEl = el.getElementsByClassName("label")[0];

      const src = el.href;

      fetch(src).then((r) => {
        const isOnline = r.ok;
        if (isOnline) {
          labelEl.classList.remove("offline");
          labelEl.innerHTML.replace("(Offline)", "");
        } else {
          labelEl.classList.add("offline");
          labelEl.innerHTML += " (Offline)";
        }
      });
    }
  }

  init();
})();
