/*
 * Small pages of the platform on a book's host: the student login (also the
 * target of printed QR codes), the hand-off for teachers viewing a student's
 * work, and the one into a book's preview. They are the platform's, not the book's, and need no build.
 *
 * Secrets travel in the fragment (#k=, #c=), which never reaches the server's
 * logs or the Referer header; the script reads it and posts it.
 */

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

const STYLE = `
:root{color-scheme:light dark;--brand:#007864;--text:#1f2328;--muted:#5f6670;--bg:#fff;--line:#d0d7de}
@media (prefers-color-scheme:dark){:root{--text:#e6e6e6;--muted:#a0a7b0;--bg:#1b1d20;--line:#3a3f45;--brand:#4fb8a3}}
*{box-sizing:border-box}
body{margin:0;font-family:Roboto,system-ui,sans-serif;background:var(--bg);color:var(--text)}
main{max-width:22rem;margin:12vh auto;padding:0 1rem}
h1{font-size:1.4rem;font-weight:500;margin:0 0 .25rem;color:var(--brand)}
p{color:var(--muted);margin:0 0 1.5rem}
label{display:block;font-size:.9rem;margin:0 0 .25rem}
input[type=text],input[type=password]{width:100%;padding:.6rem .7rem;margin:0 0 1rem;font:inherit;color:inherit;background:transparent;border:1px solid var(--line);border-radius:8px}
.check{display:flex;gap:.5rem;align-items:center;margin:0 0 1.25rem;font-size:.9rem}
button{width:100%;padding:.65rem;font:inherit;font-weight:500;color:#fff;background:var(--brand);border:0;border-radius:8px;cursor:pointer}
button:disabled{opacity:.6}
.error{color:#c62828;min-height:1.5rem;margin:.75rem 0 0}
[hidden]{display:none}
footer{display:flex;justify-content:center;gap:1rem;margin:2rem 0;font-size:.85rem}
footer a{color:var(--muted)}
`;

const STRINGS = {
  en: {
    login: "Log in",
    username: "Username",
    password: "Password",
    shared: "This is a shared device (log out when the browser closes)",
    loggingIn: "Logging in…",
    opening: "Opening the student's work…",
    wrong: "Something went wrong. Try again.",
    private: "This book is only for its students. Log in with the account your teacher gave you.",
    welcome: "Log in with the account your teacher gave you.",
    imprint: "Imprint",
    privacy: "Privacy",
    openingPreview: "Opening the preview…",
    previewBlocked: "Your browser does not let the preview log in inside the editor. Open it with “Open in a new tab” in the editor.",
  },
  de: {
    login: "Anmelden",
    username: "Benutzername",
    password: "Passwort",
    shared: "Gemeinsam genutztes Gerät (beim Schließen des Browsers abmelden)",
    loggingIn: "Anmeldung läuft …",
    opening: "Die Arbeit der Schülerin oder des Schülers wird geöffnet …",
    wrong: "Etwas ist schiefgegangen. Bitte versuche es noch einmal.",
    private: "Dieses Buch ist nur für seine Schülerinnen und Schüler. Melde dich mit dem Zugang an, den du von deiner Lehrkraft bekommen hast.",
    welcome: "Melde dich mit dem Zugang an, den du von deiner Lehrkraft bekommen hast.",
    imprint: "Impressum",
    privacy: "Datenschutz",
    openingPreview: "Die Vorschau wird geöffnet …",
    previewBlocked: "Dein Browser lässt die Vorschau im Editor nicht zu. Öffne sie mit „In neuem Tab öffnen“ im Editor.",
  },
};

/** Picks the strings in the page itself, by the browser's language. */
const PICK_STRINGS = `
const ALL = ${JSON.stringify(STRINGS)};
const T = ALL[(navigator.language || "en").slice(0, 2)] || ALL.en;
document.querySelectorAll("[data-t]").forEach((el) => {
  const text = T[el.dataset.t];
  if (text) el.textContent = text;
});
`;

/** The instance's imprint and privacy policy, as full URLs ("" for none). */
export type LegalLinks = { imprint: string; privacy: string };

function footer(legal?: LegalLinks) {
  if (!legal || (!legal.imprint && !legal.privacy)) return "";
  const link = (href: string, key: string) =>
    href ? `<a href="${escapeHtml(href)}" data-t="${key}"></a>` : "";
  return `<footer>${link(legal.imprint, "imprint")}${link(legal.privacy, "privacy")}</footer>`;
}

function shell(title: string, body: string, script: string, legal?: LegalLinks) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer"><meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title><style>${STYLE}</style></head>
<body><main>${body}</main>${footer(legal)}<script>${PICK_STRINGS}${script}</script></body></html>`;
}

export function loginPage(bookTitle: string, isPrivate: boolean, legal?: LegalLinks) {
  const body = `
<h1>${escapeHtml(bookTitle)}</h1>
<p data-t="${isPrivate ? "private" : "welcome"}"></p>
<form id="form">
  <label for="username" data-t="username"></label>
  <input id="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required>
  <label for="password" data-t="password"></label>
  <input id="password" type="password" autocomplete="current-password" required>
  <div class="check"><input id="shared" type="checkbox"><label for="shared" data-t="shared" style="margin:0"></label></div>
  <button id="submit" type="submit" data-t="login"></button>
</form>
<p id="busy" data-t="loggingIn" hidden></p>
<p id="error" class="error" role="alert"></p>`;
  const script = `
const params = new URLSearchParams(location.search);
// Only paths on this host, never another site.
let next = params.get("next") || "/";
if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\\\")) next = "/";
const form = document.getElementById("form");
const busy = document.getElementById("busy");
const error = document.getElementById("error");

async function login(path, body) {
  const res = await fetch("/_hyperbook/api/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) {
    location.replace(next);
    return;
  }
  let message = T.wrong;
  try { message = (await res.json()).error || message; } catch {}
  throw new Error(message);
}

function fail(e) {
  form.hidden = false;
  busy.hidden = true;
  document.getElementById("submit").disabled = false;
  error.textContent = e.message;
}

const key = new URLSearchParams(location.hash.slice(1)).get("k");
if (key) {
  history.replaceState(null, "", location.pathname + location.search);
  form.hidden = true;
  busy.hidden = false;
  login("login/key", { key }).catch(fail);
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  error.textContent = "";
  document.getElementById("submit").disabled = true;
  login("login", {
    username: document.getElementById("username").value,
    password: document.getElementById("password").value,
    sharedDevice: document.getElementById("shared").checked,
  }).catch(fail);
});`;
  return shell(bookTitle, body, script, legal);
}

export function impersonatePage(bookTitle: string) {
  const body = `
<h1>${escapeHtml(bookTitle)}</h1>
<p id="busy" data-t="opening"></p>
<p id="error" class="error" role="alert"></p>`;
  const script = `
const code = new URLSearchParams(location.hash.slice(1)).get("c");
history.replaceState(null, "", location.pathname);
fetch("/_hyperbook/api/impersonate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ code: code || "" }),
}).then(async (res) => {
  if (res.ok) return location.replace("/");
  let message = T.wrong;
  try { message = (await res.json()).error || message; } catch {}
  document.getElementById("busy").hidden = true;
  document.getElementById("error").textContent = message;
});`;
  return shell(bookTitle, body, script);
}

/** `adminOrigin` frames the preview and hears when its login is done. */
export function previewPage(bookTitle: string, adminOrigin: string) {
  const body = `
<h1>${escapeHtml(bookTitle)}</h1>
<p id="busy" data-t="openingPreview"></p>
<p id="error" class="error" role="alert"></p>`;
  const script = `
const params = new URLSearchParams(location.hash.slice(1));
history.replaceState(null, "", location.pathname);
let next = params.get("next") || "/";
if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\\\")) next = "/";
function fail(message) {
  document.getElementById("busy").hidden = true;
  document.getElementById("error").textContent = message;
}
fetch("/_hyperbook/api/preview", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ code: params.get("c") || "" }),
}).then(async (res) => {
  if (!res.ok) {
    let message = T.wrong;
    try { message = (await res.json()).error || message; } catch {}
    return fail(message);
  }
  // A browser that blocks cookies inside frames drops the session silently.
  const check = await fetch("/_hyperbook/api/preview");
  if (!check.ok) return fail(T.previewBlocked);
  if (parent !== window) parent.postMessage({ hyperbookPreview: "ready" }, ${JSON.stringify(adminOrigin)});
  location.replace(next);
}, () => fail(T.wrong));`;
  return shell(bookTitle, body, script);
}
