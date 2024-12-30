hyperbook.abc = (function () {
  const els = document.querySelectorAll(".directive-abc-music");
  window.codeInput?.registerTemplate(
    "abc-highlighted",
    codeInput.templates.prism(window.Prism, [
      new codeInput.plugins.Indent(true, 2),
    ])
  );

  for (let el of els) {
    const tuneEl = el.getElementsByClassName("tune")[0];
    const playerEl = el.getElementsByClassName("player")[0];

    const tune = atob(el.getAttribute("data-tune"));
    const editor = el.getAttribute("data-editor");

    if (editor == "true") {
      const editorEl = el.getElementsByClassName("editor")[0];

      const setupEditor = () => {
        try {
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
              selectionColor: "currentColor"
            },
          });
        } catch (e) {
          setTimeout(() => {
            setupEditor();
          }, 1000);
        }
      };

      setupEditor();
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
  }
})();
