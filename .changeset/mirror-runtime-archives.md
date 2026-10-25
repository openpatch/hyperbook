---
"@hyperbook/markdown": patch
---

Runtime asset archives for GeoGebra and the OpenSCAD libraries and fonts now download from cdn.openpatch.org under `runtime-archives/<element>/<version>/` instead of download.geogebra.org and ochafik.com. A release is published once per version: publishing again while that version is already on the CDN is a no-op, and downloads retry transient failures. The mirrors are published with the new `scripts/publish-runtime-archive.mjs`.
