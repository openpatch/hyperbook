/// <reference path="../hyperbook.types.js" />

/**
 * ABC music notation rendering and editing.
 * @type {HyperbookAbc}
 * @memberof hyperbook
 * @see hyperbook.store
 */
hyperbook.abc = (function () {
  const initABC = async (el) => {
    const tuneEl = el.getElementsByClassName("tune")[0];
    const playerEl = el.getElementsByClassName("player")[0];

    const tune = atob(el.getAttribute("data-tune"));
    const isEditor = el.getAttribute("data-editor") === "true";

    if (isEditor) {
      const editorEl = el.getElementsByClassName("editor")[0];
      const id = el.getAttribute("data-id") || editorEl.id;

      const copyEl = el.getElementsByClassName("copy")[0];
      const resetEl = el.getElementsByClassName("reset")[0];
      const downloadEl = el.getElementsByClassName("download")[0];

      // Restore saved tune or use default
      const storeResult = await hyperbook.store.db.abcMusic
        .where("id")
        .equals(id)
        .first();
      const initialTune = storeResult?.tune || tune;

      editorEl.textContent = "";
      const cm = HyperbookCM.create(editorEl, {
        lang: "default",
        value: initialTune,
        onChange: (code) => {
          hyperbook.store.db.abcMusic.put({ id, tune: code });
          renderAndPlay(code);
        },
      });

      copyEl?.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(cm.getValue());
        } catch (error) {
          console.error(error.message);
        }
      });

      resetEl?.addEventListener("click", () => {
        hyperbook.store.db.abcMusic.delete(id);
        window.location.reload();
      });

      downloadEl?.addEventListener("click", () => {
        const a = document.createElement("a");
        const blob = new Blob([cm.getValue()], { type: "text/plain" });
        a.href = URL.createObjectURL(blob);
        a.download = `tones-${id}.abc`;
        a.click();
      });

      // Render initial notation + player
      const renderAndPlay = (abcText) => {
        const visualObj = ABCJS.renderAbc(tuneEl, abcText, {
          responsive: "resize",
          selectTypes: false,
          selectionColor: "currentColor",
        })[0];
        if (ABCJS.synth.supportsAudio()) {
          if (!el._synthControl) {
            el._synthControl = new ABCJS.synth.SynthController();
            el._synthControl.load(playerEl, null, {
              displayRestart: true,
              displayPlay: true,
              displayProgress: true,
            });
          }
          el._synthControl.setTune(visualObj, false);
        } else {
          playerEl.innerHTML =
            "<div class='audio-error'>Audio is not supported in this browser.</div>";
        }
      };

      renderAndPlay(initialTune);
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
