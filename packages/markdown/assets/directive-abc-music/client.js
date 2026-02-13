/// <reference path="../hyperbook.types.js" />

/**
 * ABC music notation rendering and editing.
 * @type {HyperbookAbc}
 * @memberof hyperbook
 * @see hyperbook.store
 */
hyperbook.abc = (function () {
  window.codeInput?.registerTemplate(
    "abc-highlighted",
    codeInput.templates.prism(window.Prism, [
      new codeInput.plugins.Indent(true, 2),
    ])
  );

  const initABC = async (el) => {
    const tuneEl = el.getElementsByClassName("tune")[0];
    const playerEl = el.getElementsByClassName("player")[0];

    const tune = atob(el.getAttribute("data-tune"));
    const editor = el.getAttribute("data-editor");

    if (editor == "true") {
      /**
       * @type {HTMLTextAreaElement}
       */
      const editorEl = el.getElementsByClassName("editor")[0];
      const id = editorEl.id;

      const copyEl = el.getElementsByClassName("copy")[0];
      const resetEl = el.getElementsByClassName("reset")[0];
      const downloadEl = el.getElementsByClassName("download")[0];

      copyEl?.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(editor.value);
        } catch (error) {
          console.error(error.message);
        }
      });

      resetEl?.addEventListener("click", () => {
        hyperbook.store.abcMusic.delete(id);
        window.location.reload();
      });

      downloadEl?.addEventListener("click", () => {
        const a = document.createElement("a");
        const blob = new Blob([editor.value], { type: "text/plain" });
        a.href = URL.createObjectURL(blob);
        a.download = `tones-${id}.abc`;
        a.click();
      });

      editorEl.addEventListener("code-input_load", async () => {
        const storeResult = await hyperbook.store.abcMusic
          .where("id")
          .equals(editorEl.id)
          .first();
        editorEl.value = storeResult?.tune || tune;

        new ABCJS.Editor(editorEl.id, {
          canvas_id: tuneEl,
          synth: {
            el: playerEl,
            options: {
              displayRestart: true,
              displayPlay: true,
              displayProgress: true,
            },
          },
          abcjsParams: {
            responsive: "resize",
            selectTypes: false,
            selectionColor: "currentColor",
          },
        });

        editorEl.addEventListener("change", () => {
          hyperbook.store.abcMusic.put({
            id: editorEl.id,
            tune: editorEl.value,
          });
        });
      });
    } else {
      const visualObj = ABCJS.renderAbc(tuneEl, tune, {
        responsive: "resize",
      })[0];
      if (ABCJS.synth.supportsAudio()) {
        var synthControl = new ABCJS.synth.SynthController();
        synthControl.load(playerEl, null, {
          displayRestart: true,
          displayPlay: true,
          displayProgress: true,
        });
        synthControl.setTune(visualObj, false);
      } else {
        playerEl.innerHTML =
          "<div class='audio-error'>Audio is not supported in this browser.</div>";
      }
    }
  };

  const init = (root) => {
    const els = root.querySelectorAll(".directive-abc-music");
    els.forEach(initABC);
  };

  // Initialize existing elements on document load
  document.addEventListener("DOMContentLoaded", () => {
    init(document);
  });

  // Observe for new elements added to the DOM
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (
          node.nodeType === 1 &&
          node.classList.contains("directive-abc-music")
        ) {
          initABC(node);
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  return {
    init,
  };
})();
