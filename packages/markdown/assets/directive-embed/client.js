/// <reference path="../hyperbook.types.js" />
window.hyperbook = window.hyperbook || {};

hyperbook.embed = hyperbook.embed || {};

hyperbook.embed.consent = (function () {
  function getDomain(url) {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return url;
    }
  }

  async function isAllowed(consentId) {
    try {
      var entry = await hyperbook.store.consent.get(consentId);
      return entry?.allowed === true;
    } catch (e) {
      return false;
    }
  }

  async function allow(consentId) {
    await hyperbook.store.consent.put({ id: consentId, allowed: true });
  }

  function loadContent(wrapper) {
    var banner = wrapper.querySelector(".directive-embed-consent-banner");
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

    var consentSrc = wrapper.getAttribute("data-consent-src");
    var domain = getDomain(consentSrc);
    var consentId = "domain:" + domain;

    var allowed = await isAllowed(consentId);
    if (allowed) {
      loadContent(wrapper);
      return;
    }

    var btn = wrapper.querySelector(".directive-embed-consent-accept-btn");
    var checkbox = wrapper.querySelector(
      ".directive-embed-consent-always-checkbox"
    );
    if (btn) {
      btn.addEventListener("click", async function () {
        if (checkbox && checkbox.checked) {
          await allow(consentId);
        }
        loadContent(wrapper);
        if (checkbox && checkbox.checked) {
          document
            .querySelectorAll(".directive-embed-consent")
            .forEach(function (el) {
              var elSrc = el.getAttribute("data-consent-src");
              if (getDomain(elSrc) === domain) {
                loadContent(el);
              }
            });
        }
      });
    }
  }

  function init(root) {
    var wrappers = root.querySelectorAll
      ? root.querySelectorAll(".directive-embed-consent")
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
