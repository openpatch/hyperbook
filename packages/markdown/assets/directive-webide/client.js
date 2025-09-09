hyperbook.webide = (function () {
  window.codeInput?.registerTemplate(
    "webide-highlighted",
    codeInput.templates.prism(window.Prism, [
      new codeInput.plugins.AutoCloseBrackets(),
      new codeInput.plugins.Indent(true, 2),
    ]),
  );

  const elems = document.getElementsByClassName("directive-webide");

  for (let elem of elems) {
    const title = elem.getElementsByClassName("container-title")[0];
    /** @type {HTMLTextAreaElement | null} */
    const editorHTML = elem.querySelector(".editor.html");
    /** @type {HTMLTextAreaElement | null} */
    const editorCSS = elem.querySelector(".editor.css");
    /** @type {HTMLTextAreaElement | null} */
    const editorJS = elem.querySelector(".editor.js");
    /** @type {HTMLButtonElement | null} */
    const btnHTML = elem.querySelector("button.html");
    /** @type {HTMLButtonElement | null} */
    const btnCSS = elem.querySelector("button.css");
    /** @type {HTMLButtonElement | null} */
    const btnJS = elem.querySelector("button.js");

    const frame = elem.getElementsByTagName("iframe")[0];
    const template = elem.getAttribute("data-template");
    const id = elem.getAttribute("data-id");
    /** @type {HTMLButtonElement} */
    const resetEl = elem.querySelector("button.reset");
    /** @type {HTMLButtonElement} */
    const downloadEl = elem.querySelector("button.download");

    resetEl?.addEventListener("click", () => {
      if (window.confirm(i18n.get("webide-reset-prompt"))) {
        store.webide.delete(id);
        window.location.reload();
      }
    });

    btnHTML?.addEventListener("click", () => {
      btnHTML?.classList.add("active");
      btnCSS?.classList.remove("active");
      btnJS?.classList.remove("active");

      editorHTML?.classList.add("active");
      editorCSS?.classList.remove("active");
      editorJS?.classList.remove("active");
    });

    btnCSS?.addEventListener("click", () => {
      btnHTML?.classList.remove("active");
      btnCSS?.classList.add("active");
      btnJS?.classList.remove("active");

      editorHTML?.classList.remove("active");
      editorCSS?.classList.add("active");
      editorJS?.classList.remove("active");
    });

    btnJS?.addEventListener("click", () => {
      btnHTML?.classList.remove("active");
      btnCSS?.classList.remove("active");
      btnJS?.classList.add("active");

      editorHTML?.classList.remove("active");
      editorCSS?.classList.remove("active");
      editorJS?.classList.add("active");
    });

    const load = async () => {
      const result = await store.webide.get(id);
      if (!result) {
        return;
      }
      const website = template
        .replace("###HTML###", result.html)
        .replace("###CSS###", result.css)
        .replace("###JS###", result.js);
      frame.srcdoc = website;
    };

    load();

    const update = () => {
      store.webide.put({
        id,
        html: editorHTML?.value,
        css: editorCSS?.value,
        js: editorJS?.value,
      });
      const website = template
        .replace("###HTML###", editorHTML?.value)
        .replace("###CSS###", editorCSS?.value)
        .replace("###JS###", editorJS?.value);
      frame.srcdoc = website;
    };

    frame.addEventListener("load", () => {
      title.textContent = frame.contentDocument.title;
    });

    editorHTML?.addEventListener("code-input_load", async () => {
      const result = await store.webide.get(id);
      if (result) {
        editorHTML.value = result.html;
      }

      update();

      editorHTML.addEventListener("input", () => {
        update();
      });
    });

    editorCSS?.addEventListener("code-input_load", async () => {
      const result = await store.webide.get(id);
      if (result) {
        editorCSS.value = result.css;
      }

      update();

      editorCSS.addEventListener("input", () => {
        update();
      });
    });

    editorJS?.addEventListener("code-input_load", async () => {
      const result = await store.webide.get(id);
      if (result) {
        editorJS.value = result.js;
      }

      update();

      editorJS.addEventListener("input", () => {
        update();
      });
    });

    downloadEl?.addEventListener("click", async () => {
      const a = document.createElement("a");
      const website = frame.srcdoc;
      const blob = new Blob([website], { type: "text/html" });
      a.href = URL.createObjectURL(blob);
      a.download = `website-${id}.html`;
      a.click();
    });
  }
})();
