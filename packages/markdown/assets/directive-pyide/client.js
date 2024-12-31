hyperbook.python = (function () {
  window.codeInput?.registerTemplate(
    "pyide-highlighted",
    codeInput.templates.prism(window.Prism, [
      new codeInput.plugins.AutoCloseBrackets(),
      new codeInput.plugins.Indent(true, 2),
    ])
  );

  const pyodideWorker = new Worker(
    `${HYPERBOOK_ASSETS}directive-pyide/webworker.js`
  );

  const callbacks = {};
  let isRunning = false;

  const asyncRun = (id) => {
    if (isRunning) return;

    isRunning = true;
    updateRunning();
    return (script, context) => {
      // the id could be generated more carefully
      return new Promise((onSuccess) => {
        callbacks[id] = onSuccess;
        pyodideWorker.postMessage({
          ...context,
          python: script,
          id,
        });
      });
    };
  };

  const updateRunning = () => {
    for (let elem of elems) {
      const run = elem.getElementsByClassName("run")[0];
      if (isRunning) {
        run.classList.add("running");
        run.textContent = "Running ...";
      } else {
        run.classList.remove("running");
        run.textContent = "Run";
      }
      run.disabled = isRunning;
    }
  };

  pyodideWorker.onmessage = (event) => {
    const { id, ...data } = event.data;
    if (data.type === "stdout") {
      const output = document
        .getElementById(id)
        .getElementsByClassName("output")[0];
      output.appendChild(document.createTextNode(data.message + "\n"));
      return;
    }
    const onSuccess = callbacks[id];
    delete callbacks[id];
    isRunning = false;
    updateRunning();
    onSuccess(data);
  };

  const elems = document.getElementsByClassName("directive-pyide");

  for (let elem of elems) {
    const editor = elem.getElementsByClassName("editor")[0];
    const run = elem.getElementsByClassName("run")[0];
    const output = elem.getElementsByClassName("output")[0];
    const id = elem.id;

    run?.addEventListener("click", () => {
      const script = editor.value;
      output.innerHTML = "";
      asyncRun(id)(script, {})
        .then(({ results, error }) => {
          if (results) {
            output.textContent = results;
          } else if (error) {
            output.textContent = error;
          }
        })
        .catch((e) => {
          output.textContent = `Error: ${e}`;
        });
    });
  }
})();
