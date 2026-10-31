---
"@hyperbook/markdown": patch
---

Fixed the Online IDE runtime download in `postbuild.mjs` pinning a stale release (`v2.2.1-hyperbook.12`) instead of the version declared in `ide-releases.json`. Builds now download `dist-embedded.zip` from the pinned `ideReleases.onlineide` release, matching the `sqlide` flow, so `scripts/verify-default-cdns.mjs` compares the published CDN manifest against the same runtime the CDN was published from.
