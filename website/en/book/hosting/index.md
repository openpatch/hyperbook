---
name: Hosting
index: 5
---

# Hosting

Build your Hyperbook with `npx hyperbook build` and publish `.hyperbook/out` on
a static hosting service. Choose [GitHub Pages](/hosting/ghpages),
[GitLab Pages](/hosting/glpages), [Vercel](/hosting/vercel), or
[your own server](/hosting/custom).

PyIDE uses Pyodide's CDN by default to keep the exported book small. Readers
need access to that CDN. Set `elements.pyide.cdn` to `false` to host the full
runtime yourself; see [PyIDE](/elements/pyide).

See [Caching](/hosting/caching) for faster CI builds and cache headers that let
readers reuse large runtime files while receiving updated pages.
