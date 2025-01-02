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

  let callback = null;
  /**
   * @type Uint8Array
   */
  let interruptBuffer;
  /**
   * @type Int32Array
   */
  let stdinBuffer;
  if (window.crossOriginIsolated) {
    interruptBuffer = new Uint8Array(new SharedArrayBuffer(1));
    stdinBuffer = new Int32Array(new SharedArrayBuffer(1024));
    pyodideWorker.postMessage({
      type: "setStdinBuffer",
      payload: { stdinBuffer },
    });
    pyodideWorker.postMessage({
      type: "setInterruptBuffer",
      payload: { interruptBuffer },
    });
  } else {
    interruptBuffer = new ArrayBuffer(1);
    pyodideWorker.postMessage({
      type: "setInterruptBuffer",
      payload: { interruptBuffer },
    });
  }

  const asyncRun = (id, type) => {
    if (callback) return;

    interruptBuffer[0] = 0;
    return (script, context) => {
      return new Promise((onSuccess) => {
        callback = onSuccess;
        updateRunning(id, type);
        pyodideWorker.postMessage({
          type: "run",
          payload: {
            ...context,
            python: script,
          },
          id,
        });
      });
    };
  };

  function interruptExecution() {
    // 2 stands for SIGINT.
    interruptBuffer[0] = 2;
  }

  const updateRunning = (id, type) => {
    for (let elem of elems) {
      const run = elem.getElementsByClassName("run")[0];
      const test = elem.getElementsByClassName("test")[0];
      if (callback) {
        if (elem.id === id && type === "run") {
          run.textContent = "Running (Click to stop) ...";
          run.addEventListener("click", interruptExecution);
        } else if (test && elem.id === id && type === "test") {
          test.textContent = "Testing (Click to stop) ...";
          test.addEventListener("click", interruptExecution);
        } else {
          run.classList.add("running");
          run.disabled = true;
          if (test) {
            test.classList.add("running");
            test.disabled = true;
          }
        }
      } else {
        run.classList.remove("running");
        run.textContent = "Run";
        run.disabled = false;
        run.removeEventListener("click", interruptExecution);
        if (test) {
          test.classList.remove("running");
          test.textContent = "Test";
          test.disabled = false;
          test.removeEventListener("click", interruptExecution);
        }
      }
    }
  };

  pyodideWorker.onmessage = (event) => {
    const { id, type, payload } = event.data;
    switch (type) {
      case "stdout": {
        const output = document
          .getElementById(id)
          .getElementsByClassName("output")[0];
        output.appendChild(document.createTextNode(payload + "\n"));
        break;
      }
      case "error": {
        const onSuccess = callback;
        onSuccess({ error: payload });
        break;
      }
      case "success": {
        const onSuccess = callback;
        onSuccess({ results: payload });
        break;
      }
    }
  };

  const elems = document.getElementsByClassName("directive-pyide");

  for (let elem of elems) {
    const editor = elem.getElementsByClassName("editor")[0];
    const run = elem.getElementsByClassName("run")[0];
    const test = elem.getElementsByClassName("test")[0];
    const output = elem.getElementsByClassName("output")[0];
    const input = elem.getElementsByClassName("input")[0];
    const outputBtn = elem.getElementsByClassName("output-btn")[0];
    const inputBtn = elem.getElementsByClassName("input-btn")[0];
    const id = elem.id;
    let tests = [];
    try {
      tests = JSON.parse(atob(elem.getAttribute("data-tests")));
    } catch (e) {}

    function showInput() {
      outputBtn.classList.remove("active");
      inputBtn.classList.add("active");
      output.classList.add("hidden");
      input.classList.remove("hidden");
    }
    function showOutput() {
      outputBtn.classList.add("active");
      inputBtn.classList.remove("active");
      output.classList.remove("hidden");
      input.classList.add("hidden");
    }

    outputBtn?.addEventListener("click", showOutput);
    inputBtn?.addEventListener("click", showInput);

    test?.addEventListener("click", async () => {
      showOutput();
      if (callback) return;

      output.innerHTML = "";

      const script = editor.value;
      for (let test of tests) {
        const testCode = test.code.replace("#SCRIPT#", script);

        const heading = document.createElement("div");
        console.log(test);
        heading.innerHTML = `== Test ${test.name} ==`;
        heading.classList.add("test-heading");
        output.appendChild(heading);

        await asyncRun(id, "test")(testCode, {})
          .then(({ results, error }) => {
            if (results) {
              output.textContent += results;
            } else if (error) {
              output.textContent += error;
            }
            callback = null;
            updateRunning(id, "test");
          })
          .catch((e) => {
            output.textContent = `Error: ${e}`;
            console.log(e);
            callback = null;
            updateRunning(id, "test");
          });
      }
    });

    run?.addEventListener("click", async () => {
      showOutput();
      if (callback) return;

      const script = editor.value;
      output.innerHTML = "";
      asyncRun(id, "run")(script, {
        inputs: input.value.split("\n"),
      })
        .then(({ results, error }) => {
          if (results) {
            output.textContent += results;
          } else if (error) {
            output.textContent += error;
          }
          callback = null;
          updateRunning(id, "run");
        })
        .catch((e) => {
          output.textContent = `Error: ${e}`;
          console.log(e);
          callback = null;
          updateRunning(id, "run");
        });
    });
  }
})();
