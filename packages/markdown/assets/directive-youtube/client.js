/// <reference path="../hyperbook.types.js" />
window.hyperbook = window.hyperbook || {};

hyperbook.youtube = hyperbook.youtube || {};

hyperbook.youtube.consent = (function () {
  var CONSENT_ID = "youtube";

  async function isAllowed() {
    try {
      var entry = await hyperbook.store.consent.get(CONSENT_ID);
      return entry?.allowed === true;
    } catch (e) {
      return false;
    }
  }

  async function allow() {
    await hyperbook.store.consent.put({ id: CONSENT_ID, allowed: true });
  }

  function loadContent(wrapper) {
    var banner = wrapper.querySelector(".directive-youtube-consent-banner");
    if (banner) {
      banner.remove();
    }
    var iframe = wrapper.querySelector("iframe");
    if (iframe) {
      var src = iframe.getAttribute("data-consent-src");
      if (src) {
        iframe.setAttribute("src", src);
        iframe.removeAttribute("data-consent-src");
        iframe.style.display = "";
      }
    }
  }

  async function initWrapper(wrapper) {
    if (wrapper.getAttribute("data-consent-initialized")) return;
    wrapper.setAttribute("data-consent-initialized", "true");

    var allowed = await isAllowed();
    if (allowed) {
      loadContent(wrapper);
      return;
    }

    var btn = wrapper.querySelector(".directive-youtube-consent-accept-btn");
    var checkbox = wrapper.querySelector(
      ".directive-youtube-consent-always-checkbox"
    );
    if (btn) {
      btn.addEventListener("click", async function () {
        if (checkbox && checkbox.checked) {
          await allow();
        }
        loadContent(wrapper);
        if (checkbox && checkbox.checked) {
          document
            .querySelectorAll(".directive-youtube-consent")
            .forEach(function (el) {
              loadContent(el);
            });
        }
      });
    }
  }

  function init(root) {
    var wrappers = root.querySelectorAll
      ? root.querySelectorAll(".directive-youtube-consent")
      : [];
    wrappers.forEach(function (w) {
      initWrapper(w);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    init(document);
  });

  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (node.nodeType === 1) {
          init(node);
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  return {
    isAllowed: isAllowed,
    allow: allow,
    init: init,
  };
})();
