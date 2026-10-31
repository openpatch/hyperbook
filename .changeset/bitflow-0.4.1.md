---
"@hyperbook/markdown": patch
"@hyperbook/cloud": patch
---

Update `@bitflow/web-component` to 0.4.1 (from 0.4.0). The editor's graph chrome — React Flow's zoom buttons, minimap, dotted background and edges — now derives its `colorMode` from the container's used `color-scheme`, the same one bitflow's own `light-dark()` palette resolves against, and follows the host's theme changes. Before, the chrome stayed light whatever the host, so a dark page or a dark editor frame had light zoom buttons and a white minimap on the dark canvas. The element and event surface is unchanged, so no integration code changes were needed.
