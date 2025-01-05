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

  function init() {
    const els = document.getElementsByClassName("wave");
    for (let el of els) {
      const src = el.getAttribute("data-src");
      const id = el.id;

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

      store.audio.get(id).then((result) => {
        if (result) {
          wavesurfer.setTime(result.time);
        }
      });
    }
  }

  init();

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

    store.audio.put({ id, time });

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
