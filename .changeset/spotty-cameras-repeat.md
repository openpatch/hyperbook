---
"@hyperbook/markdown": minor
"@hyperbook/types": minor
"@hyperbook/fs": minor
"hyperbook": minor
---

Encrypt protected content, and add page, section and registry level passwords.

`:::protect` used to embed both the content and the password in the built page,
so anyone could read either from the HTML source. The content is now encrypted
at build time with AES-256-GCM under a key derived from the password with
PBKDF2, and the browser decrypts it once the password is entered. Nested
protect blocks are encrypted innermost first, so an outer password reveals only
the outer layer.

Protected content also no longer leaks into the search index or `llms.txt`, and
headings inside a protect block stay out of the table of contents. This was a
live bug: `search.js` contained the full plaintext of every protected section.

Because decryption needs the Web Crypto API, which browsers only expose over
`https` or on `localhost`, books distributed as folders can opt out with
`protect.mode: "obfuscate"` in `hyperbook.json`, which restores the old
behaviour. Unlocking is now an explicit action — an Unlock button or Enter —
because deriving the key takes a moment.

New alongside it:

- `protect` in page and section frontmatter, protecting the whole page. A
  section passes it down to everything inside it, and one password opens the
  whole section: the unlock is keyed on whichever page or section declared the
  `protect`, so readers do not re-enter it on every page. Protected entries are
  marked with a lock in the navigation.
- A password registry in its own `passwords.json`, so passwords can be named,
  reused via `:::protect{use="..."}`, and kept out of the repository. Values can
  come from `HYPERBOOK_PASSWORDS_FILE`, `HYPERBOOK_PASSWORDS` or
  `HYPERBOOK_PASSWORD_<KEY>` instead. A name with no value fails the build
  rather than falling back to an empty password.
- `hyperbook passwords list|init|check` to see every password a book uses,
  scaffold the registry, and verify in CI that nothing is missing.
- A `::passwordlist` directive that puts the same overview on a page.
