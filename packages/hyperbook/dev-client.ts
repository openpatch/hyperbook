/**
 * The script every page of the dev server loads. It keeps a socket to the
 * server and reloads the page when the book changes. A reload rather than a
 * swap of <main>: directives initialise on DOMContentLoaded or from observers
 * that a swapped-in tree never triggers, so only a real load brings them up
 * as readers will see them. The reader's place survives it: the scroll
 * position is kept per page and put back once the reloaded page has its fonts.
 */
export function devClient(port: number): string {
  return `
var __hbPort = ${port};
var __hbSocket = null;
var __hbReconnectDelay = 1000;
var __hbConnected = false;

// Keeps the reader's place across reloads. Hyperbook pages scroll in <main>,
// some layouts scroll the window, so both are kept. Only a reload puts the
// place back: following a link to a page read earlier starts at its top.
(function() {
  var key = "hb-dev-scroll:" + location.pathname;
  var scroller = function() { return document.querySelector("main"); };
  var restoring = true;
  var keep = function() {
    if (restoring) return;
    try {
      var m = scroller();
      sessionStorage.setItem(key, JSON.stringify([scrollY, m ? m.scrollTop : 0]));
    } catch (e) {}
  };
  addEventListener("pagehide", keep);
  addEventListener("scroll", keep, { capture: true, passive: true });
  var navigation = performance.getEntriesByType
    ? performance.getEntriesByType("navigation")[0]
    : null;
  var saved = null;
  if (navigation && navigation.type === "reload") {
    try { saved = JSON.parse(sessionStorage.getItem(key)); } catch (e) {}
  }
  var restore = function() {
    if (!saved || location.hash) return;
    scrollTo(0, saved[0]);
    var m = scroller();
    if (m) m.scrollTop = saved[1];
  };
  restore();
  addEventListener("load", function() {
    restore();
    var fonts = document.fonts && document.fonts.ready
      ? document.fonts.ready
      : Promise.resolve();
    fonts.catch(function() {}).then(function() {
      restore();
      requestAnimationFrame(function() {
        requestAnimationFrame(function() { restoring = false; });
      });
    });
  });
})();

// Same origin as the page, so the dev server is still reachable when the book
// is opened from another device or through a proxy rather than on localhost.
function __hbWsUrl() {
  var protocol = window.location.protocol === "https:" ? "wss://" : "ws://";
  return protocol + (window.location.host || "localhost:" + __hbPort);
}

function __hbConnect() {
  __hbSocket = new WebSocket(__hbWsUrl());

  __hbSocket.addEventListener("open", function() {
    __hbConnected = true;
    __hbReconnectDelay = 1000;
    __hbSocket.send(JSON.stringify({ type: "page", href: window.location.pathname }));
    __hbUpdateConnStatus();
  });

  __hbSocket.addEventListener("close", function() {
    __hbConnected = false;
    __hbUpdateConnStatus();
    // Exponential backoff with cap at 10s
    setTimeout(__hbConnect, __hbReconnectDelay);
    __hbReconnectDelay = Math.min(__hbReconnectDelay * 2, 10000);
  });

  __hbSocket.addEventListener("error", function() {
    // The close handler will trigger reconnect
  });

  __hbSocket.addEventListener("message", __hbHandleMessage);
}

// A build that fails as a whole (a library) is shown over the content; the
// last good page would otherwise stay up as if nothing happened.
function __hbShowError(message) {
  var overlay = document.getElementById("__hb_error");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "__hb_error";
    overlay.style.cssText = "position:fixed;inset:0;z-index:100000;"
      + "background:rgba(20,20,20,0.94);color:#f7f7f7;padding:2rem;"
      + "font:14px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;"
      + "overflow:auto;white-space:pre-wrap;word-break:break-word;";
    document.body.appendChild(overlay);
  }
  var heading = document.createElement("div");
  heading.textContent = "Build failed";
  heading.style.cssText = "color:#ff6b6b;font-weight:bold;font-size:1.1rem;margin-bottom:1rem;";
  var body = document.createElement("div");
  body.textContent = message;
  var hint = document.createElement("div");
  hint.textContent = "This overlay clears on the next successful build.";
  hint.style.cssText = "margin-top:1.5rem;opacity:0.6;";
  overlay.replaceChildren(heading, body, hint);
}

function __hbHideError() {
  var overlay = document.getElementById("__hb_error");
  if (overlay) overlay.remove();
}

function __hbStopSpinner() {
  var btn = document.getElementById("__hb_reload_btn");
  if (btn) {
    btn.style.animation = "none";
    btn.disabled = false;
    delete btn.dataset.spinning;
    btn.style.opacity = "0.6";
  }
}

function __hbUpdateConnStatus() {
  var dot = document.getElementById("__hb_conn_dot");
  if (dot) {
    dot.style.background = __hbConnected ? "#4ade80" : "#f87171";
  }
}

// Check whether the current page path matches one of the changed pages.
function __hbShouldReload(changedPages) {
  var currentPath = window.location.pathname;
  if (changedPages === "*") return true;
  return changedPages.some(function(p) {
    if (p === "/" && (currentPath === "/" || currentPath === "/index.html")) {
      return true;
    }
    return currentPath === p || currentPath === p + "/" || currentPath === p + ".html"
      || currentPath === p + "/index.html" || currentPath.startsWith(p + "/");
  });
}

function __hbHandleMessage(event) {
  var msg;
  try {
    msg = JSON.parse(event.data);
  } catch (e) {
    return;
  }

  if (msg.type === "rebuilding") {
    __hbHideError();
    var btn = document.getElementById("__hb_reload_btn");
    if (btn) {
      btn.style.opacity = "1";
      btn.style.animation = "__hb_spin 0.8s linear infinite";
      btn.disabled = true;
      btn.dataset.spinning = "1";
    }
  }

  if (msg.type === "rebuild-error") {
    __hbStopSpinner();
    __hbShowError(msg.message);
  }

  if (msg.type === "rebuild-complete") {
    __hbStopSpinner();
  }

  if (msg.type === "reload") {
    __hbStopSpinner();
    if (__hbShouldReload(msg.changedPages)) window.location.reload();
  }
}

window.addEventListener("DOMContentLoaded", function() {
  // Inject keyframes for spinner
  var style = document.createElement("style");
  style.textContent = "@keyframes __hb_spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }";
  document.head.appendChild(style);

  // Connection status dot
  var dot = document.createElement("div");
  dot.id = "__hb_conn_dot";
  dot.style.cssText = "position:fixed;bottom:18px;right:62px;z-index:99999;"
    + "width:10px;height:10px;border-radius:50%;background:#f87171;"
    + "transition:background 0.3s;";
  document.body.appendChild(dot);

  // Force full rebuild button
  var btn = document.createElement("button");
  btn.id = "__hb_reload_btn";
  btn.type = "button";
  btn.innerHTML = "&#x21bb;";
  btn.title = "Rebuild from scratch";
  btn.style.cssText = "position:fixed;bottom:16px;right:16px;z-index:99999;"
    + "width:40px;height:40px;border-radius:50%;border:none;cursor:pointer;"
    + "background:#333;color:#fff;font-size:20px;line-height:1;"
    + "box-shadow:0 2px 8px rgba(0,0,0,0.3);opacity:0.6;transition:opacity 0.2s;";
  btn.addEventListener("mouseenter", function() { btn.style.opacity = "1"; });
  btn.addEventListener("mouseleave", function() { if (!btn.dataset.spinning) btn.style.opacity = "0.6"; });
  btn.addEventListener("click", function() {
    if (__hbSocket && __hbSocket.readyState === WebSocket.OPEN) {
      btn.style.opacity = "1";
      btn.style.animation = "__hb_spin 0.8s linear infinite";
      btn.disabled = true;
      btn.dataset.spinning = "1";
      __hbSocket.send(JSON.stringify({ type: "force-reload" }));
    }
  });
  document.body.appendChild(btn);

  __hbConnect();
});
`;
}
