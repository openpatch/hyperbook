---
"hyperbook": patch
---

Replace the deprecated H5P ZIP extraction dependency with `unzipper`, so H5P
assets no longer leave the initial development build pending under newer Node.js
versions.
