// Light or dark before the first paint, as src/web/lib/theme.ts decides it.
// A file, not inline: the platform may run under a CSP without inline scripts.
(() => {
  let mode = null;
  try {
    mode = localStorage.getItem("dark-mode-toggle");
  } catch {}
  const dark = mode === "dark" || (mode !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
})();
