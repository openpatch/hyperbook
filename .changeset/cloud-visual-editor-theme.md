---
"@hyperbook/cloud": patch
---

The visual editors' frame follows the theme again, and keeps following it when it changes. It now declares a `color-scheme` per theme and loads the light design tokens, which the dark ones build on — without them bitflow resolved its whole `light-dark()` palette light whatever the theme, so in dark mode its editor came out as white cards with near-invisible text on the dark canvas. The frame also gets the app's page font and colours, and the iframe behind it is no longer hardcoded white while an editor loads. Toggling the theme now reaches the frame live (through the same `storage` event that keeps tabs in step) instead of only when it first opens.
