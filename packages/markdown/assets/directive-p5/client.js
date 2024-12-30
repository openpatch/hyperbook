hyperbook.p5 = (function () {
  window.codeInput?.registerTemplate(
    "p5-highlighted",
    codeInput.templates.prism(window.Prism, [
      new codeInput.plugins.AutoCloseBrackets(),
      new codeInput.plugins.Indent(true, 2),
    ])
  );

  const elems = document.getElementsByClassName("directive-p5");

  const wrapSketch = (sketchCode) => {
    if (sketchCode !== "" && !sketchCode?.includes("setup")) {
      return `
      function setup() {
        createCanvas(100, 100);
        background(200);
        ${sketchCode}
      }`;
    }
    return sketchCode;
  };

  for (let elem of elems) {
    const editor = elem.getElementsByClassName("editor")[0];
    const update = elem.getElementsByClassName("update")[0];
    const frame = elem.getElementsByTagName("iframe")[0];
    const template = elem.getAttribute("data-template");

    update.addEventListener("click", () => {
      const code = editor.value;
      frame.srcdoc = template.replace("###SLOT###", wrapSketch(code));
    });
  }
})();
