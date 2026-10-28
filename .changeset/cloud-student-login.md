---
"@hyperbook/markdown": minor
"@hyperbook/types": minor
"hyperbook": minor
---

Books connect to the new Hyperbook Cloud. A book the platform hosts gets `"cloud": { "sameOrigin": true }` and logs students in with a cookie on its own address; a book hosted elsewhere sets `cloud.url` to its address on the platform (for example `https://physics.example.page`) and uses a token. The login form has a "shared device" option, a scanned QR code logs a student in directly, and a teacher's read-only view of a student's work is recognized from the platform's session instead of a token's contents. A refused save (403) no longer logs the student out. The API of the previous, retired cloud server is no longer supported.
