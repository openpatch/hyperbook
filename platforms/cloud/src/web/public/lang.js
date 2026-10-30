// The UI language before the app boots; src/web/i18n.tsx takes over after.
// A file, not inline: the platform may run under a CSP without inline scripts.
(() => {
  let locale = null;
  try {
    locale = localStorage.getItem("locale");
  } catch {}
  if (!locale) locale = (navigator.language || "en").slice(0, 2).toLowerCase();
  if (locale === "en" || locale === "de") document.documentElement.lang = locale;
})();
