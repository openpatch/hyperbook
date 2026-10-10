---
name: Hosting
---

# Hosting

Baue dein Hyperbook mit `npx hyperbook build` und veröffentliche `.hyperbook/out`
auf einem statischen Hosting-Dienst. Wähle [GitHub Pages](/hosting/ghpages),
[GitLab Pages](/hosting/glpages), [Vercel](/hosting/vercel) oder
[einen eigenen Server](/hosting/custom).

PyIDE verwendet standardmäßig das Pyodide-CDN, damit das exportierte Buch klein
bleibt. Leser benötigen Zugriff auf dieses CDN. Setze `elements.pyide.cdn` auf
`false`, um die vollständige Laufzeitumgebung selbst zu hosten; siehe
[PyIDE](/elements/pyide).

Unter [Caching](/hosting/caching) erfährst du, wie CI-Builds schneller werden und
Leser große Dateien wiederverwenden, während sie aktualisierte Seiten erhalten.
