/// <reference path="../hyperbook.types.js" />
window.hyperbook = window.hyperbook || {};

hyperbook.kiri = hyperbook.kiri || {};

// Kiri:Moto Frame API - required for communication with Kiri iframe
hyperbook.kiri.frameAPI = (function () {
  "use strict";

  let KIRI = (window.kiri = window.kiri || {});
  let frame,
    cwin,
    onevent = {},
    targetOrigin = "https://grid.space";

  function $(id) {
    return document.getElementById(id);
  }

  function setFrame(fo) {
    frame = fo;
    cwin = fo.contentWindow;
  }

  function send(msg) {
    if (cwin) {
      cwin.postMessage(msg, targetOrigin);
    }
  }

  function recv(msg) {
    let { data } = msg;
    let efn = onevent[data.event];
    if (efn) {
      efn(data.data, data.event);
    }
  }

  function onMessage(msg) {
    let { origin, source, data } = msg;
    if (source === cwin) {
      recv(msg);
    }
  }

  let API = (KIRI.frame = {
    setFrame: function (io, target) {
      let type = typeof io;
      targetOrigin = target || "https://grid.space";
      switch (type) {
        case "string":
          setFrame($(io));
          break;
        case "object":
          setFrame(io);
          break;
        default:
          throw "invalid frame type " + type;
      }
      window.removeEventListener("message", onMessage);
      window.addEventListener("message", onMessage);
    },

    send: send,

    load: function (load) {
      send({ load: load });
    },

    clear: function () {
      send({ clear: true });
    },

    parse: function (data, type) {
      send({ parse: data, type: type });
    },

    get: function (scope) {
      send({ get: scope });
    },

    set: function (scope, data) {
      send({ set: scope, data: data });
    },

    setMode: function (mode) {
      send({ mode: mode });
    },

    setDevice: function (device) {
      send({ device: device });
    },

    setProcess: function (process) {
      send({ process: process });
    },

    setFeatures: function (features) {
      send({ features: features });
    },

    setController: function (controller) {
      send({ controller: controller });
    },

    slice: function () {
      send({ function: "slice", callback: true });
    },

    prepare: function () {
      send({ function: "prepare", callback: true });
    },

    export: function (cb) {
      send({ function: "export", callback: cb ? true : false });
    },

    onmessage: function () {},

    progress: function (progress, message) {
      send({ progress: progress, message: message });
    },

    alert: function (alert, time) {
      send({ alert: alert, time: time });
    },

    emit: function (emit, message) {
      send({ emit: emit, message: message });
    },

    onevent: function (event, fn) {
      onevent[event] = fn;
      send({ event: event });
    },
  });

  API.on = API.onevent;

  return API;
})();

// Initialize Kiri directive
hyperbook.kiri.init = (function () {
  "use strict";

  /**
   * Initialize all Kiri directive instances on the page
   */
  function init(root) {
    const wrappers = root.querySelectorAll
      ? root.querySelectorAll(".directive-kiri")
      : [];

    wrappers.forEach(function (wrapper) {
      initWrapper(wrapper);
    });
  }

  /**
   * Initialize a single Kiri directive wrapper
   */
  function initWrapper(wrapper) {
    if (wrapper.getAttribute("data-kiri-initialized")) return;
    wrapper.setAttribute("data-kiri-initialized", "true");

    const iframe = wrapper.querySelector(".kiri-iframe");
    const statusDiv = wrapper.querySelector(".kiri-status");

    if (!iframe) {
      if (statusDiv) {
        statusDiv.textContent = "Error: Kiri iframe not found";
      }
      return;
    }

    // Get configuration from data attributes
    const id = wrapper.getAttribute("data-id");
    let src = wrapper.getAttribute("data-src") || "";

    function isRelativeUrl(value) {
      return /\.(stl)($|\?)/.test(value) || value.startsWith("/");
    }

    if (src && !src.match(/^https?:\/\//) && isRelativeUrl(src)) {
      src = window.origin + src;
    }
    const mode = wrapper.getAttribute("data-mode") || "FDM";
    const device = wrapper.getAttribute("data-device") || "";

    // Wait for iframe to load
    iframe.addEventListener("load", function () {
      if (statusDiv) {
        statusDiv.textContent = "Initializing Kiri:Moto...";
      }

      // Setup Kiri frame API
      try {
        const frameId = `kiri-frame-${id}`;
        const api = window.kiri.frame;

        // Initialize the frame
        api.setFrame(frameId, "https://grid.space");

        // Set mode
        api.setMode(mode);

        // Set device if provided
        if (device) {
          try {
            const deviceConfig = JSON.parse(device);
            api.setDevice(deviceConfig);
          } catch (e) {
            // Device is not JSON, might be a URL - pass as string
            api.setDevice(device);
          }
        }

        // Clear workspace
        api.clear();

        // Load the model
        if (src) {
          if (statusDiv) {
            statusDiv.textContent = "Loading model...";
          }
          api.load(src);

          // Set up event listeners
          api.onevent("loaded", function () {
            if (statusDiv) {
              statusDiv.textContent = "Model loaded. Slicing...";
            }
            api.slice();
          });

          api.onevent("slice.done", function () {
            if (statusDiv) {
              statusDiv.textContent = "Slicing complete. Preparing...";
            }
            api.prepare();
          });

          api.onevent("prepare.done", function () {
            if (statusDiv) {
              statusDiv.textContent = "Preparation complete. Ready!";
              setTimeout(function () {
                if (statusDiv) {
                  statusDiv.style.display = "none";
                }
              }, 2000);
            }
          });

          api.onevent("error", function (data) {
            if (statusDiv) {
              statusDiv.textContent =
                "Error: " + (data.message || "Unknown error");
            }
          });
        } else {
          if (statusDiv) {
            //statusDiv.textContent = "No model source specified";
          }
        }
      } catch (e) {
        if (statusDiv) {
          statusDiv.textContent = "Error initializing Kiri: " + e.message;
        }
        console.error("Error initializing Kiri directive:", e);
      }
    });

    iframe.addEventListener("error", function () {
      if (statusDiv) {
        statusDiv.textContent =
          "Error loading Kiri:Moto. Please check the URL.";
      }
    });
  }

  // Initialize on DOMContentLoaded
  document.addEventListener("DOMContentLoaded", function () {
    init(document);
  });

  // Observe dynamically added content
  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (node.nodeType === 1) {
          init(node);
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return {
    init: init,
    initWrapper: initWrapper,
  };
})();
