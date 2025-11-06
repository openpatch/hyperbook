hyperbook.readalong = (function () {
  /**
   * @typedef {Object} WordTimestamp
   * @property {string} word
   * @property {number} start
   * @property {number} end
   */

  /**
   * @typedef {Object} ReadalongConfig
   * @property {string} id
   * @property {WordTimestamp[]} timestamps
   * @property {boolean} autoGenerate
   * @property {number} speed
   * @property {string} text
   */

  /**
   * @typedef {Object} ReadalongInstance
   * @property {HTMLElement} container
   * @property {HTMLAudioElement} audio
   * @property {HTMLElement} textContainer
   * @property {ReadalongConfig} config
   * @property {number} currentWordIndex
   * @property {number} intervalId
   */

  /**
   * @type {Record<string, ReadalongInstance>}
   */
  const instances = {};

  /**
   * Format seconds to MM:SS
   * @param {number} seconds
   */
  function formatTime(seconds) {
    seconds = Math.floor(seconds);
    const m = Math.floor(seconds / 60);
    const s = seconds - m * 60;
    const tm = m < 10 ? "0" + m : m;
    const ts = s < 10 ? "0" + s : s;
    return tm + ":" + ts;
  }

  /**
   * Generate automatic timestamps based on text and speed
   * @param {string} text
   * @param {number} speed Words per minute
   * @param {number} duration Audio duration in seconds
   * @returns {WordTimestamp[]}
   */
  function generateTimestamps(text, speed, duration) {
    // Split text into words, keeping punctuation
    const words = text.match(/\S+/g) || [];
    const millisecondsPerWord = (60 / speed) * 1000;
    
    const timestamps = [];
    let currentTime = 0;
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordDuration = millisecondsPerWord;
      
      timestamps.push({
        word: word,
        start: currentTime / 1000,
        end: (currentTime + wordDuration) / 1000,
      });
      
      currentTime += wordDuration;
    }
    
    return timestamps;
  }

  /**
   * Wrap each word in the text container with a span
   * @param {HTMLElement} textContainer
   * @param {WordTimestamp[]} timestamps
   */
  function wrapWords(textContainer, timestamps) {
    // Get all text nodes
    const walker = document.createTreeWalker(
      textContainer,
      NodeFilter.SHOW_TEXT,
      null
    );

    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }

    let timestampIndex = 0;

    for (const textNode of textNodes) {
      const text = textNode.nodeValue || "";
      const words = text.match(/\S+|\s+/g) || [];
      const fragment = document.createDocumentFragment();

      for (const word of words) {
        if (word.trim()) {
          // It's a word, not whitespace
          const span = document.createElement("span");
          span.className = "readalong-word";
          span.textContent = word;
          
          if (timestamps[timestampIndex]) {
            span.setAttribute("data-start", timestamps[timestampIndex].start.toString());
            span.setAttribute("data-end", timestamps[timestampIndex].end.toString());
            span.setAttribute("data-index", timestampIndex.toString());
            
            // Make word clickable
            span.style.cursor = "pointer";
            span.onclick = function() {
              const start = parseFloat(this.getAttribute("data-start") || "0");
              const instance = instances[textContainer.getAttribute("data-id")];
              if (instance && instance.audio) {
                instance.audio.currentTime = start;
                if (instance.audio.paused) {
                  instance.audio.play();
                }
              }
            };
            
            timestampIndex++;
          }
          
          fragment.appendChild(span);
        } else {
          // It's whitespace, keep as text
          fragment.appendChild(document.createTextNode(word));
        }
      }

      textNode.parentNode.replaceChild(fragment, textNode);
    }
  }

  /**
   * Highlight the current word based on audio time
   * @param {string} id
   */
  function updateHighlight(id) {
    const instance = instances[id];
    if (!instance) return;

    const currentTime = instance.audio.currentTime;
    const words = instance.textContainer.querySelectorAll(".readalong-word");
    
    let foundActive = false;
    words.forEach((word, index) => {
      const start = parseFloat(word.getAttribute("data-start") || "0");
      const end = parseFloat(word.getAttribute("data-end") || "0");
      
      if (currentTime >= start && currentTime < end) {
        word.classList.add("active");
        foundActive = true;
        
        // Scroll into view if needed
        if (!isInViewport(word)) {
          word.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      } else {
        word.classList.remove("active");
      }
    });
  }

  /**
   * Check if element is in viewport
   * @param {HTMLElement} element
   */
  function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  /**
   * Update time display
   * @param {string} id
   */
  function updateTimeDisplay(id) {
    const instance = instances[id];
    if (!instance) return;

    const currentTimeEl = instance.container.querySelector(".current-time");
    const totalTimeEl = instance.container.querySelector(".total-time");
    
    if (currentTimeEl) {
      currentTimeEl.textContent = formatTime(instance.audio.currentTime);
    }
    if (totalTimeEl && !isNaN(instance.audio.duration)) {
      totalTimeEl.textContent = formatTime(instance.audio.duration);
    }
  }

  /**
   * Toggle play/pause
   * @param {string} id
   */
  function togglePlayPause(id) {
    const instance = instances[id];
    if (!instance) return;

    const button = instance.container.querySelector(".play-pause");
    
    if (instance.audio.paused) {
      instance.audio.play();
      button.classList.add("playing");
    } else {
      instance.audio.pause();
      button.classList.remove("playing");
    }
  }

  /**
   * Initialize a readalong instance
   * @param {string} id
   */
  function initInstance(id) {
    const container = document.querySelector(`.directive-readalong[data-id="${id}"]`);
    if (!container) return;

    const audio = container.querySelector(".readalong-audio");
    const textContainer = container.querySelector(".readalong-text");
    const configEl = container.querySelector(".readalong-config");
    
    if (!audio || !textContainer || !configEl) return;

    let config;
    try {
      config = JSON.parse(configEl.textContent || "{}");
    } catch (e) {
      console.error("Failed to parse readalong config", e);
      return;
    }

    const instance = {
      container,
      audio,
      textContainer,
      config,
      currentWordIndex: -1,
      intervalId: null,
    };

    instances[id] = instance;

    // Wait for audio metadata to load
    audio.addEventListener("loadedmetadata", function() {
      let timestamps = config.timestamps;
      
      // Generate timestamps if needed
      if (!timestamps && config.autoGenerate) {
        timestamps = generateTimestamps(
          config.text,
          config.speed || 150,
          audio.duration
        );
      }

      if (timestamps && timestamps.length > 0) {
        wrapWords(textContainer, timestamps);
      }

      updateTimeDisplay(id);
    });

    // Update on time update
    audio.addEventListener("timeupdate", function() {
      updateHighlight(id);
      updateTimeDisplay(id);
    });

    // Update button state on play/pause
    audio.addEventListener("play", function() {
      const button = container.querySelector(".play-pause");
      button.classList.add("playing");
    });

    audio.addEventListener("pause", function() {
      const button = container.querySelector(".play-pause");
      button.classList.remove("playing");
    });

    // Reset on end
    audio.addEventListener("ended", function() {
      const button = container.querySelector(".play-pause");
      button.classList.remove("playing");
      const words = textContainer.querySelectorAll(".readalong-word");
      words.forEach(word => word.classList.remove("active"));
    });
  }

  /**
   * Initialize all readalong instances on the page
   */
  function init() {
    const readalongElements = document.querySelectorAll(".directive-readalong");
    readalongElements.forEach(el => {
      const id = el.getAttribute("data-id");
      if (id) {
        initInstance(id);
      }
    });
  }

  // Initialize on load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return {
    togglePlayPause,
  };
})();
