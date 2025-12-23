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
   * @property {string} mode
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
   * @property {SpeechSynthesisUtterance} utterance
   * @property {number} startTime
   * @property {boolean} isPlaying
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
    
    // Scale timestamps to fit audio duration if provided
    if (duration && duration > 0) {
      const calculatedDuration = currentTime / 1000;
      const scale = duration / calculatedDuration;
      
      timestamps.forEach(ts => {
        ts.start *= scale;
        ts.end *= scale;
      });
    }
    
    return timestamps;
  }

  /**
   * Wrap each word in the text container with a span
   * @param {HTMLElement} textContainer
   * @param {WordTimestamp[]} timestamps
   * @param {string} mode
   */
  function wrapWords(textContainer, timestamps, mode) {
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
            
            // For TTS mode, store character index
            if (mode === "tts" && timestamps[timestampIndex].charIndex !== undefined) {
              span.setAttribute("data-char-index", timestamps[timestampIndex].charIndex.toString());
            }
            
            // Make word clickable
            span.style.cursor = "pointer";
            span.onclick = function() {
              const instance = instances[textContainer.getAttribute("data-id")];
              if (!instance) return;
              
              if (mode === "tts") {
                // For TTS, restart from this word
                const charIndex = parseInt(this.getAttribute("data-char-index") || "0");
                if (instance.utterance) {
                  speechSynthesis.cancel();
                }
                // Create new utterance starting from this character
                const text = instance.config.text;
                const remainingText = text.substring(charIndex);
                instance.utterance = new SpeechSynthesisUtterance(remainingText);
                instance.utterance.rate = instance.config.speed / 150;
                instance.startTime = Date.now();
                instance.isPlaying = true;
                speechSynthesis.speak(instance.utterance);
                const button = instance.container.querySelector(".play-pause");
                button.classList.add("playing");
              } else {
                // For manual mode, seek to timestamp
                const start = parseFloat(this.getAttribute("data-start") || "0");
                if (instance.audio) {
                  instance.audio.currentTime = start;
                  if (instance.audio.paused) {
                    instance.audio.play();
                  }
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
    
    if (instance.config.mode === "tts") {
      // For TTS, calculate elapsed time
      if (currentTimeEl && instance.isPlaying) {
        const elapsed = (Date.now() - instance.startTime) / 1000;
        currentTimeEl.textContent = formatTime(elapsed);
      }
      // Total time is estimated based on word count and speed
      if (totalTimeEl && !totalTimeEl.textContent.includes(":")) {
        const words = instance.config.text.match(/\S+/g) || [];
        const estimatedDuration = (words.length / instance.config.speed) * 60;
        totalTimeEl.textContent = formatTime(estimatedDuration);
      }
    } else {
      // For audio files
      if (currentTimeEl) {
        currentTimeEl.textContent = formatTime(instance.audio.currentTime);
      }
      if (totalTimeEl && !isNaN(instance.audio.duration)) {
        totalTimeEl.textContent = formatTime(instance.audio.duration);
      }
    }
  }

  /**
   * Generate timestamps from TTS word boundaries
   * @param {string} text
   * @returns {Promise<WordTimestamp[]>}
   */
  function generateTTSTimestamps(text) {
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }

      const words = text.match(/\S+/g) || [];
      const timestamps = [];
      let wordIndex = 0;
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      utterance.onboundary = function(event) {
        if (event.name === 'word' && wordIndex < words.length) {
          const start = event.elapsedTime / 1000;
          timestamps.push({
            word: words[wordIndex],
            start: start,
            end: start + 0.5, // Approximate end time
            charIndex: event.charIndex,
          });
          wordIndex++;
        }
      };

      utterance.onend = function() {
        // Update end times based on next word's start
        for (let i = 0; i < timestamps.length - 1; i++) {
          timestamps[i].end = timestamps[i + 1].start;
        }
        // Last word gets a reasonable end time
        if (timestamps.length > 0) {
          const lastTs = timestamps[timestamps.length - 1];
          lastTs.end = lastTs.start + 0.5;
        }
        resolve(timestamps);
      };

      utterance.onerror = function(event) {
        reject(event);
      };

      // Run speech synthesis silently to get timing
      utterance.volume = 0;
      speechSynthesis.speak(utterance);
    });
  }

  /**
   * Toggle play/pause for TTS mode
   * @param {string} id
   */
  function togglePlayPauseTTS(id) {
    const instance = instances[id];
    if (!instance) return;

    const button = instance.container.querySelector(".play-pause");
    
    if (instance.isPlaying) {
      // Pause
      speechSynthesis.cancel();
      instance.isPlaying = false;
      button.classList.remove("playing");
    } else {
      // Play
      if (!instance.utterance) {
        instance.utterance = new SpeechSynthesisUtterance(instance.config.text);
        instance.utterance.rate = instance.config.speed / 150; // Adjust rate based on speed
        
        instance.utterance.onboundary = function(event) {
          if (event.name === 'word') {
            // Highlight current word
            const words = instance.textContainer.querySelectorAll(".readalong-word");
            words.forEach((word, index) => {
              const charIndex = parseInt(word.getAttribute("data-char-index") || "-1");
              if (charIndex === event.charIndex) {
                word.classList.add("active");
                if (!isInViewport(word)) {
                  word.scrollIntoView({ behavior: "smooth", block: "center" });
                }
              } else {
                word.classList.remove("active");
              }
            });
          }
        };

        instance.utterance.onend = function() {
          instance.isPlaying = false;
          button.classList.remove("playing");
          const words = instance.textContainer.querySelectorAll(".readalong-word");
          words.forEach(word => word.classList.remove("active"));
        };

        instance.utterance.onerror = function(event) {
          console.error("TTS error:", event);
          instance.isPlaying = false;
          button.classList.remove("playing");
        };
      }
      
      instance.startTime = Date.now();
      instance.isPlaying = true;
      button.classList.add("playing");
      speechSynthesis.speak(instance.utterance);
      
      // Update time display while speaking
      const updateInterval = setInterval(() => {
        if (!instance.isPlaying) {
          clearInterval(updateInterval);
          return;
        }
        updateTimeDisplay(id);
      }, 100);
    }
  }

  /**
   * Toggle play/pause
   * @param {string} id
   */
  function togglePlayPause(id) {
    const instance = instances[id];
    if (!instance) return;

    // Use TTS mode if configured
    if (instance.config.mode === "tts") {
      togglePlayPauseTTS(id);
      return;
    }

    // Manual mode with audio file
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
    
    if (!textContainer || !configEl) return;

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
      utterance: null,
      startTime: 0,
      isPlaying: false,
    };

    instances[id] = instance;

    // Handle TTS mode
    if (config.mode === "tts") {
      // Check if speech synthesis is supported
      if (!('speechSynthesis' in window)) {
        console.error("Speech synthesis not supported in this browser");
        return;
      }

      // Generate timestamps from TTS
      generateTTSTimestamps(config.text)
        .then(timestamps => {
          if (timestamps && timestamps.length > 0) {
            wrapWords(textContainer, timestamps, "tts");
          }
          updateTimeDisplay(id);
        })
        .catch(err => {
          console.error("Failed to generate TTS timestamps:", err);
        });
      
      return;
    }

    // Manual mode with audio file
    if (!audio) return;

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
        wrapWords(textContainer, timestamps, "manual");
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
