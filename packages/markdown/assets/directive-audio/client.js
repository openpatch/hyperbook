/// <reference path="../hyperbook.types.js" />

/**
 * Audio player with playback controls and state persistence.
 * @type {HyperbookAudio}
 * @memberof hyperbook
 * @see hyperbook.store
 */
hyperbook.audio = (function () {
  /**
   * @param {number} seconds
   */
  function secondsToTimestamp(seconds) {
    seconds = Math.floor(seconds);
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds - h * 3600) / 60);
    var s = seconds - h * 3600 - m * 60;

    let th = h < 10 ? "0" + h : h;
    let tm = m < 10 ? "0" + m : m;
    let ts = s < 10 ? "0" + s : s;
    if (h > 0) {
      return th + ":" + tm + ":" + ts;
    }

    return tm + ":" + ts;
  }

  /**
   * @type {Record<string, import("wavesurfer.js").WaveSurfer>}
   */
  const wavesurferInstances = {};

  function initElement(el) {
    const src = el.getAttribute("data-src");
    const id = el.id;

    if (wavesurferInstances[id]) return;

    const wavesurfer = window.WaveSurfer.create({
      container: el,
      cursorWidth: 4,
      barWidth: 4,
      barGap: 5,
      barRadius: 2,
      height: 64,
      url: src,
    });
    wavesurfer.on("ready", () => update(id));
    wavesurfer.on("audioprocess", () => update(id));
    wavesurfer.on("pause", () => update(id));
    wavesurfer.on("finish", () => update(id));
    wavesurfer.on("play", () => update(id));
    wavesurferInstances[id] = wavesurfer;

    hyperbook.store.audio.get(id).then((result) => {
      if (result) {
        wavesurfer.setTime(result.time);
      }
    });
  }

  function init(root) {
    const els = root.getElementsByClassName("wave");
    for (let el of els) {
      initElement(el);
    }
  }

  // Initialize existing elements on document load
  document.addEventListener("DOMContentLoaded", () => {
    init(document);
  });

  // Observe for new elements added to the DOM
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          if (node.classList.contains("wave")) {
            initElement(node);
          } else {
            const waves = node.getElementsByClassName?.("wave");
            if (waves) {
              for (let el of waves) {
                initElement(el);
              }
            }
          }
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  /**
   * @param {string} id
   */
  function update(id) {
    const el = document.getElementById(id);
    const ws = wavesurferInstances[id];
    if (!el || !ws) return;

    const playerEl = el.parentElement;
    const directiveEl = playerEl.parentElement;
    const playEl = playerEl.getElementsByClassName("play")[0];
    const durationEl = directiveEl.getElementsByClassName("duration")[0];

    const duration = ws.getDuration();
    const time = ws.getCurrentTime();
    const isPlaying = ws.isPlaying();

    if (isPlaying) {
      playEl.classList.add("playing");
    } else {
      playEl.classList.remove("playing");
    }

    hyperbook.store.audio.put({ id, time });

    durationEl.innerHTML = ` ${secondsToTimestamp(time)}/${secondsToTimestamp(duration)}`;
  }

  /**
   * @param {string} id
   */
  function togglePlayPause(id) {
    if (wavesurferInstances[id]) {
      wavesurferInstances[id].playPause();
      update(id);
    }
  }

  return {
    togglePlayPause,
  };
})();
